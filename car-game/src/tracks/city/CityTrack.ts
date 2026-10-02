import * as THREE from 'three';
import type { QualitySettings } from '../../core/quality';
import { NightEnvironment } from '../../render/NightEnvironment';
import { Rain } from '../../render/Rain';
import { asphaltTextures, concreteTexture, radialTexture } from '../../render/textures';
import { SplineSurface, type Racer } from '../../game-modes/RaceWorld';
import { RacingLine } from '../../ai/RacingLine';
import { TrackSpline } from '../TrackSpline';
import { buildRoad, type RoadMaterials } from '../roadBuilder';
import { gridSlot } from '../grid';
import type { TrackScene, TrackView } from '../TrackScene';
import { buildCity, type CityBuild } from './cityBuilder';
import { CITY_LAYOUT, CITY_SECTORS } from './layout';
import { chequerTexture, kerbTexture, sponsorTexture, tunnelTileTexture } from './textures';

/**
 * Circuit 1 — "Métropole de nuit" (SPEC §5): assembles the spline road, the procedural city,
 * the night sky and the lighting:
 *  - every street lamp lights the road with a light pool (cheap decal); the lamps nearest the
 *    camera are replaced by real spotlights (count set by the quality preset), which also light
 *    the cars and their reflections;
 *  - the tunnel has its own fixtures, sky light fades out inside, and the camera exposure adapts
 *    on the way in and out;
 *  - optional rain: wet road (darker, glossy, reflections), lower grip, falling rain, fog.
 */

/** Rain: grip of wet asphalt relative to dry (≈ 0.75–0.8 for road tires). */
export const WET_GRIP = 0.78;
/** Camera exposure outdoors at night and inside the (brighter) tunnel. */
const NIGHT_EXPOSURE = 1.35;
const TUNNEL_EXPOSURE = 0.9;
const LAMP_INTENSITY = 650;
const TUNNEL_INTENSITY = 110;
const LAMP_COLOR = new THREE.Color(0xffd9ad);
const TUNNEL_COLOR = new THREE.Color(0xfff0d8);
const TUNNEL_HEIGHT = 6.5;

interface LightSpot {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  tunnel: boolean;
  /** Index of the lamp's light-pool decal (lamps only). */
  pool: number;
}

interface PoolLight {
  light: THREE.SpotLight;
  spot: LightSpot | null;
  level: number;
}

function cityMaterials(rain: boolean, aniso: number): RoadMaterials {
  const asphalt = asphaltTextures(1024);
  for (const t of [asphalt.map, asphalt.roughness, asphalt.bump]) t.anisotropy = aniso;
  const road = new THREE.MeshStandardMaterial({
    map: asphalt.map,
    roughnessMap: asphalt.roughness,
    bumpMap: asphalt.bump,
    bumpScale: rain ? 0.4 : 1,
    roughness: rain ? 0.32 : 1,
    envMapIntensity: rain ? 1.8 : 1,
  });
  if (rain) road.color.setScalar(0.55);
  const ds = THREE.DoubleSide;
  const concrete = concreteTexture(512);
  const paint = new THREE.MeshStandardMaterial({ color: 0xe6e6de, roughness: rain ? 0.3 : 0.65, side: ds, polygonOffset: true, polygonOffsetFactor: -2 });
  const sponsor = sponsorTexture();
  const fenceTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#fff';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(64, 64);
    g.moveTo(64, 0);
    g.lineTo(0, 64);
    g.moveTo(0, 1);
    g.lineTo(64, 1);
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(8, 6);
    t.colorSpace = THREE.NoColorSpace;
    return t;
  })();
  const tile = tunnelTileTexture();
  return {
    road,
    line: paint,
    kerb: new THREE.MeshStandardMaterial({ map: kerbTexture(), roughness: rain ? 0.3 : 0.55, side: ds, polygonOffset: true, polygonOffsetFactor: -2 }),
    chequer: new THREE.MeshStandardMaterial({ map: chequerTexture(), roughness: 0.6, side: ds, polygonOffset: true, polygonOffsetFactor: -3 }),
    wall: new THREE.MeshStandardMaterial({ map: concrete, color: 0xc4c0b8, roughness: 0.85, side: ds }),
    // Backlit ad boards: a little emission so they read at night.
    sponsor: new THREE.MeshStandardMaterial({ map: sponsor, emissiveMap: sponsor, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.4, side: ds }),
    fence: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.7, roughness: 0.4, alphaMap: fenceTex, alphaTest: 0.5, side: ds }),
    sidewalk: new THREE.MeshStandardMaterial({ map: concrete, color: 0x9a968e, roughness: rain ? 0.4 : 0.9, side: ds }),
    deck: new THREE.MeshStandardMaterial({ map: concrete, color: 0xa29f97, roughness: 0.85, side: ds }),
    tunnel: new THREE.MeshStandardMaterial({ map: tile, emissiveMap: tile, emissive: 0xffe6c4, emissiveIntensity: 0.06, roughness: 0.3, side: ds }),
    tunnelLight: new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 6.4, 5.2) }),
    rail: new THREE.MeshStandardMaterial({ color: 0xb4b8be, metalness: 0.85, roughness: 0.3, side: ds }),
  };
}

export class CityTrack implements TrackScene {
  readonly id = 'city';
  readonly name = 'Métropole de nuit';
  readonly spline: TrackSpline;
  readonly surface: SplineSurface;
  readonly sectors = CITY_SECTORS;
  readonly racingLine: RacingLine;
  readonly grip: number;
  readonly night = true;
  exposure = NIGHT_EXPOSURE;
  enclosure = 0;
  private readonly group = new THREE.Group();
  private readonly env: NightEnvironment;
  private readonly city: CityBuild;
  private readonly rain: Rain | null = null;
  private readonly spots: LightSpot[] = [];
  private readonly pool: PoolLight[] = [];
  private readonly lampPools: THREE.InstancedMesh;
  private readonly poolFade: Float32Array;
  private lineMesh: THREE.Mesh | null = null;
  private lightTimer = 0;
  private poolsDirty = true;
  private camHint = -1;
  private readonly tmp = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3();
  private readonly col = new THREE.Color();

  constructor(
    private readonly scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    quality: QualitySettings,
    maxAnisotropy: number,
    readonly wet: boolean,
  ) {
    this.grip = wet ? WET_GRIP : 1;
    this.spline = new TrackSpline(CITY_LAYOUT, 1);
    this.surface = new SplineSurface(this.spline);
    this.racingLine = new RacingLine(this.spline);
    this.group.name = 'city-track';
    scene.add(this.group);

    this.env = new NightEnvironment(scene, renderer, quality);
    this.env.setRain(wet);

    const aniso = Math.min(quality.anisotropy, maxAnisotropy);
    const road = buildRoad(this.spline, cityMaterials(wet, aniso));
    this.group.add(road.group);
    this.city = buildCity(this.spline, road.lamps, road.groundHoles, aniso, quality.cityDensity);
    this.group.add(this.city.group);

    // Light pools fade per lamp (instance colour) when a real spotlight takes over.
    this.lampPools = this.city.lampPools;
    this.poolFade = new Float32Array(road.lamps.length).fill(1);
    for (let i = 0; i < road.lamps.length; i++) this.lampPools.setColorAt(i, this.col.setScalar(1));

    // Candidate positions for the real lights: every lamp, and every other tunnel fixture pair.
    road.lamps.forEach((l, i) => {
      const ground = this.spline.project(l.head.x, l.head.z);
      this.spots.push({
        pos: l.head.clone(),
        target: new THREE.Vector3(l.head.x + l.toRoad.x * 2, ground.height, l.head.z + l.toRoad.z * 2),
        tunnel: false,
        pool: i,
      });
    });
    const tl = road.tunnelLights;
    for (let k = 0; k + 1 < tl.length; k += 4) {
      const mid = tl[k].clone().add(tl[k + 1]).multiplyScalar(0.5);
      mid.y -= 0.3;
      this.spots.push({ pos: mid, target: mid.clone().setY(mid.y - TUNNEL_HEIGHT), tunnel: true, pool: -1 });
    }
    this.buildTunnelPools(tl);

    if (wet) {
      this.rain = new Rain(quality.rainDrops);
      this.group.add(this.rain.mesh);
    }
    this.applyQuality(quality);

    // Bake the lit city into the reflections (cars, wet road) from above the boulevard.
    if (this.rain) this.rain.mesh.visible = false;
    this.env.captureCity(new THREE.Vector3(120, 14, -10));
    if (this.rain) this.rain.mesh.visible = true;
  }

  /** Long light pools on the tunnel road under the fixtures. */
  private buildTunnelPools(lights: THREE.Vector3[]): void {
    const mat = new THREE.MeshBasicMaterial({
      color: TUNNEL_COLOR.clone().multiplyScalar(0.09),
      alphaMap: radialTexture(128, 0.15),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -6,
    });
    const count = Math.floor(lights.length / 4);
    const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let k = 0; k < count; k++) {
      const a = lights[k * 4];
      const b = lights[k * 4 + 1];
      const x = (a.x + b.x) / 2;
      const z = (a.z + b.z) / 2;
      const p = this.spline.project(x, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.sample.heading);
      inst.setMatrixAt(k, m.compose(new THREE.Vector3(x, p.height + 0.05, z), q, new THREE.Vector3(p.sample.wallL + p.sample.wallR + 2, 1, 16)));
    }
    inst.renderOrder = 2;
    this.group.add(inst);
  }

  // ---------------------------------------------------------------------------

  placeOnGrid(r: Racer, slot: number): void {
    const g = gridSlot(this.spline, slot, r.car.visual.frontOverhangFromCg);
    this.surface.place(r, g.s, g.d);
  }

  recover(r: Racer): void {
    const smp = this.spline.sample(this.spline.indexAt(r.s));
    const d = THREE.MathUtils.clamp(r.lateral, -smp.hw + 2, smp.hw - 2);
    this.surface.place(r, r.s, d);
  }

  minimap(): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < this.spline.count; i += 8) {
      const p = this.spline.samples[i].p;
      out.push([p.x, p.z]);
    }
    return out;
  }

  /** Ideal line on the road, coloured by what the car should do (green: accelerate, red: brake). */
  setRacingLine(profile: Float64Array | null): void {
    if (this.lineMesh) {
      this.lineMesh.removeFromParent();
      this.lineMesh.geometry.dispose();
      (this.lineMesh.material as THREE.Material).dispose();
      this.lineMesh = null;
    }
    if (!profile) return;
    const line = this.racingLine;
    const M = line.count;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const c = new THREE.Color();
    for (let k = 0; k <= M; k++) {
      const i = k % M;
      const p = line.points[i];
      const smp = this.spline.sample(this.spline.indexAt(p.s));
      const ahead = profile[(i + 4) % M];
      const decel = (profile[i] - ahead) / Math.max(1, profile[i]);
      if (decel > 0.02) c.setRGB(0.9, 0.06, 0.04);
      else if (decel > 0.004) c.setRGB(0.9, 0.6, 0.05);
      else c.setRGB(0.08, 0.75, 0.22);
      for (const side of [1, -1]) {
        const off = p.offset + side * 0.25;
        this.spline.pointAt(p.s, off, this.tmp);
        this.tmp.addScaledVector(smp.up, 0.03);
        pos.push(this.tmp.x, this.tmp.y, this.tmp.z);
        col.push(c.r, c.g, c.b);
      }
      if (k > 0) {
        const v = k * 2;
        idx.push(v - 2, v - 1, v, v - 1, v + 1, v);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -10,
    });
    this.lineMesh = new THREE.Mesh(g, mat);
    this.lineMesh.renderOrder = 3;
    this.lineMesh.frustumCulled = false;
    this.group.add(this.lineMesh);
  }

  // ---------------------------------------------------------------------------

  applyQuality(q: QualitySettings): void {
    this.env.applyQuality(q);
    // Changing the number of lights recompiles the shaders: only when the preset changes.
    while (this.pool.length > q.dynamicLights) {
      const p = this.pool.pop()!;
      if (p.spot && p.spot.pool >= 0) this.poolFade[p.spot.pool] = 1;
      this.poolsDirty = true;
      p.light.removeFromParent();
      p.light.target.removeFromParent();
      p.light.dispose();
    }
    while (this.pool.length < q.dynamicLights) {
      const light = new THREE.SpotLight(LAMP_COLOR, 0, 48, 1.05, 0.75, 2);
      light.castShadow = false;
      this.scene.add(light, light.target);
      this.pool.push({ light, spot: null, level: 0 });
    }
    this.lightTimer = 0;
  }

  update(dt: number, view: TrackView): void {
    const cam = view.camera;
    const v = view.player.vehicle;
    this.city.update(dt, view.time);
    this.env.follow(this.tmp.set(v.x, v.y, v.z));

    // --- Inside the tunnel? (camera under the tunnel roof)
    const q = this.spline.project(cam.position.x, cam.position.z, this.camHint);
    this.camHint = q.index;
    const smp = q.sample;
    const inside =
      smp.zone === 'tunnel' &&
      Math.abs(q.lateral) < Math.max(smp.wallL, smp.wallR) + 0.5 &&
      cam.position.y < q.height + TUNNEL_HEIGHT &&
      cam.position.y > q.height - 1;
    this.enclosure += ((inside ? 1 : 0) - this.enclosure) * Math.min(1, dt * 4);
    this.env.setEnclosure(this.enclosure);
    // Eyes adapt quickly to light, more slowly to the dark.
    const target = THREE.MathUtils.lerp(NIGHT_EXPOSURE, TUNNEL_EXPOSURE, this.enclosure);
    const rate = target < this.exposure ? 2.2 : 0.8;
    this.exposure += (target - this.exposure) * Math.min(1, dt * rate);

    this.rain?.update(view.time, cam, this.enclosure);

    // --- Animated details.
    const aviation = this.city.group.userData.aviation as THREE.MeshBasicMaterial | undefined;
    if (aviation) aviation.color.setRGB(view.time % 1.6 < 0.25 ? 6 : 0.05, 0.12, 0.08);
    const water = this.city.group.userData.waterNormal as THREE.Texture | undefined;
    if (water) water.offset.set(view.time * 0.004, view.time * 0.011);

    this.updateLights(dt, cam);
  }

  /** Give the real spotlights to the lamps nearest to where the camera looks. */
  private updateLights(dt: number, cam: THREE.PerspectiveCamera): void {
    this.lightTimer -= dt;
    if (this.lightTimer <= 0 && this.pool.length) {
      this.lightTimer = 0.2;
      cam.getWorldDirection(this.fwd);
      this.fwd.y = 0;
      this.fwd.normalize();
      const fx = cam.position.x + this.fwd.x * 16;
      const fy = cam.position.y;
      const fz = cam.position.z + this.fwd.z * 16;
      const ranked = this.spots
        .map((sp) => ({ sp, d: (sp.pos.x - fx) ** 2 + ((sp.pos.y - fy) * 3) ** 2 + (sp.pos.z - fz) ** 2 }))
        .filter((e) => e.d < 110 * 110)
        .sort((a, b) => a.d - b.d)
        .slice(0, this.pool.length)
        .map((e) => e.sp);
      // Keep lights already on a wanted spot; free the others.
      const wanted = new Set(ranked);
      for (const p of this.pool) {
        if (p.spot && wanted.has(p.spot)) wanted.delete(p.spot);
        else if (p.spot) {
          if (p.spot.pool >= 0) this.poolFade[p.spot.pool] = 1;
          p.spot = null;
          p.level = 0;
          this.poolsDirty = true;
        }
      }
      for (const p of this.pool) {
        if (p.spot) continue;
        const next = wanted.values().next();
        if (next.done) break;
        const sp = next.value;
        wanted.delete(sp);
        p.spot = sp;
        p.level = 0;
        p.light.position.copy(sp.pos);
        p.light.target.position.copy(sp.target);
        p.light.target.updateMatrixWorld();
        p.light.color.copy(sp.tunnel ? TUNNEL_COLOR : LAMP_COLOR);
        p.light.angle = sp.tunnel ? 1.15 : 1.05;
        p.light.distance = sp.tunnel ? 26 : 48;
      }
    }
    // Cross-fade: the decal fades out while the real light fades in (no popping).
    let poolsDirty = this.poolsDirty;
    this.poolsDirty = false;
    for (const p of this.pool) {
      if (!p.spot) {
        // Never toggle `visible`: a change in the light count recompiles every shader.
        p.light.intensity = 0;
        continue;
      }
      p.level = Math.min(1, p.level + dt * 3);
      p.light.intensity = (p.spot.tunnel ? TUNNEL_INTENSITY : LAMP_INTENSITY) * p.level;
      if (p.spot.pool >= 0) {
        this.poolFade[p.spot.pool] = 1 - p.level;
        poolsDirty = true;
      }
    }
    if (poolsDirty) {
      for (let i = 0; i < this.poolFade.length; i++) this.lampPools.setColorAt(i, this.col.setScalar(this.poolFade[i]));
      if (this.lampPools.instanceColor) this.lampPools.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    this.env.dispose();
    this.rain?.dispose();
    for (const p of this.pool) p.light.dispose();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mt of mats) {
        for (const v of Object.values(mt)) if (v instanceof THREE.Texture) v.dispose();
        mt.dispose();
      }
    });
  }
}
