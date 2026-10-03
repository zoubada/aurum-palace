import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TrackSpline } from '../TrackSpline';
import type { Lamp } from '../roadBuilder';
import { asphaltTextures, concreteTexture, radialTexture } from '../../render/textures';
import { NEON_SIGNS, drawLed, ledScreen, neonTexture } from './textures';

/**
 * Procedural night city around the circuit (SPEC §5, circuit 1): street grid, river and quays,
 * towers with lit windows (shader, no textures to stream), neon signs, LED screens, the
 * cable-stayed bridge, viaduct piers, street lamps with light pools, decorative traffic,
 * pedestrians and traffic lights. Everything heavy is instanced.
 */

export const RIVER = { x0: 880, x1: 1150, level: -3 };
const BLOCK = 92;
const STREET = 18;
const PITCH = BLOCK + STREET;

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Grid hash of track samples for fast "is this near the circuit?" queries. */
export class TrackIndex {
  private readonly cells = new Map<string, number[]>();
  private readonly size = 30;
  constructor(private readonly track: TrackSpline) {
    for (let i = 0; i < track.count; i += 3) {
      const p = track.samples[i].p;
      const key = `${Math.floor(p.x / this.size)},${Math.floor(p.z / this.size)}`;
      const list = this.cells.get(key);
      if (list) list.push(i);
      else this.cells.set(key, [i]);
    }
  }
  /** Nearest sample within `radius` (m) of (x, z), or null. */
  near(x: number, z: number, radius: number): { i: number; d: number } | null {
    const r = Math.ceil(radius / this.size);
    const cx = Math.floor(x / this.size);
    const cz = Math.floor(z / this.size);
    let best: { i: number; d: number } | null = null;
    for (let a = cx - r; a <= cx + r; a++)
      for (let b = cz - r; b <= cz + r; b++) {
        for (const i of this.cells.get(`${a},${b}`) ?? []) {
          const p = this.track.samples[i].p;
          const d = Math.hypot(p.x - x, p.z - z);
          if (d < radius && (!best || d < best.d)) best = { i, d };
        }
      }
    return best;
  }
}

export interface CityBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CityBuild {
  group: THREE.Group;
  /** Animated parts updated every frame. */
  update(dt: number, time: number): void;
  lampPools: THREE.InstancedMesh;
}

function inRiver(x: number, pad = 0): boolean {
  return x > RIVER.x0 - pad && x < RIVER.x1 + pad;
}

// -----------------------------------------------------------------------------

export function buildCity(track: TrackSpline, lamps: Lamp[], holes: Array<Array<[number, number]>>, maxAnisotropy: number, density: number): CityBuild {
  const group = new THREE.Group();
  group.name = 'city';
  const index = new TrackIndex(track);
  const rand = rng(2024);
  const bounds: CityBounds = { minX: -900, maxX: 2300, minZ: -1250, maxZ: 850 };
  const animated: Array<(dt: number, time: number) => void> = [];

  /** Free of the circuit (with clearance) at ground level? Elevated / underground track is fine above some height. */
  const clearOfTrack = (x: number, z: number, clearance: number, allowUnderDeck = false) => {
    const hit = index.near(x, z, clearance + 12);
    if (!hit) return true;
    const smp = track.samples[hit.i];
    if (hit.d > smp.wallL + clearance && hit.d > smp.wallR + clearance) return true;
    if (allowUnderDeck && (smp.p.y > 7 || (smp.zone === 'tunnel' && smp.p.y < -6))) return true;
    return false;
  };

  buildGround(group, bounds, holes, maxAnisotropy);
  buildRiver(group, bounds);
  const towers = buildBuildings(group, bounds, clearOfTrack, rand, density);
  buildSigns(group, towers, track, index, rand, animated);
  buildBridgeAndPiers(group, track, animated);
  const lampPools = buildLamps(group, track, lamps);
  buildTraffic(group, bounds, clearOfTrack, rand, animated, density);

  return {
    group,
    lampPools,
    update(dt, time) {
      for (const f of animated) f(dt, time);
    },
  };
}

// -----------------------------------------------------------------------------
// Ground: street grid painted on a canvas covering the whole map, holes for open cuts/river.
// -----------------------------------------------------------------------------

function buildGround(group: THREE.Group, b: CityBounds, holes: Array<Array<[number, number]>>, maxAniso: number): void {
  const W = b.maxX - b.minX;
  const H = b.maxZ - b.minZ;
  const res = 2048;
  const sx = res / W;
  const sz = res / H;
  const toPx = (x: number, z: number): [number, number] => [(x - b.minX) * sx, (z - b.minZ) * sz];

  const c = document.createElement('canvas');
  c.width = c.height = res;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5c5a56'; // pavements and plazas
  g.fillRect(0, 0, res, res);
  g.fillStyle = '#2e2f31'; // streets
  for (let x = Math.floor(b.minX / PITCH) * PITCH; x < b.maxX; x += PITCH) {
    const [px] = toPx(x - STREET / 2, 0);
    g.fillRect(px, 0, STREET * sx, res);
  }
  for (let z = Math.floor(b.minZ / PITCH) * PITCH; z < b.maxZ; z += PITCH) {
    const [, pz] = toPx(0, z - STREET / 2);
    g.fillRect(0, pz, res, STREET * sz);
  }
  // Lane centre lines.
  g.strokeStyle = 'rgba(220,200,120,0.55)';
  g.lineWidth = 0.6;
  g.setLineDash([3, 4]);
  for (let x = Math.floor(b.minX / PITCH) * PITCH; x < b.maxX; x += PITCH) {
    const [px] = toPx(x, 0);
    g.beginPath();
    g.moveTo(px, 0);
    g.lineTo(px, res);
    g.stroke();
  }
  for (let z = Math.floor(b.minZ / PITCH) * PITCH; z < b.maxZ; z += PITCH) {
    const [, pz] = toPx(0, z);
    g.beginPath();
    g.moveTo(0, pz);
    g.lineTo(res, pz);
    g.stroke();
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, maxAniso);

  // Alpha mask: holes for the river and the open cuts of the tunnel.
  const m = document.createElement('canvas');
  m.width = m.height = 1024;
  const mg = m.getContext('2d')!;
  const ms = 1024 / res;
  mg.fillStyle = '#fff';
  mg.fillRect(0, 0, 1024, 1024);
  mg.fillStyle = '#000';
  const [r0] = toPx(RIVER.x0, 0);
  const [r1] = toPx(RIVER.x1, 0);
  mg.fillRect(r0 * ms, 0, (r1 - r0) * ms, 1024);
  for (const hole of holes) {
    mg.beginPath();
    hole.forEach(([x, z], i) => {
      const [px, pz] = toPx(x, z);
      if (i === 0) mg.moveTo(px * ms, pz * ms);
      else mg.lineTo(px * ms, pz * ms);
    });
    mg.closePath();
    mg.fill();
  }
  const alpha = new THREE.CanvasTexture(m);
  alpha.colorSpace = THREE.NoColorSpace;

  const detail = asphaltTextures(512);
  detail.map.repeat.set(W / 6, H / 6);
  const mat = new THREE.MeshStandardMaterial({ map, alphaMap: alpha, alphaTest: 0.5, roughness: 0.92 });
  // Fine asphalt grain multiplied over the painted streets.
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.detailMap = { value: detail.map };
    shader.uniforms.detailRepeat = { value: new THREE.Vector2(W / 6, H / 6) };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D detailMap;\nuniform vec2 detailRepeat;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= texture2D(detailMap, vMapUv * detailRepeat).rgb * 2.2;');
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((b.minX + b.maxX) / 2, -0.04, (b.minZ + b.maxZ) / 2);
  ground.receiveShadow = true;
  ground.castShadow = true; // keeps moonlight out of the tunnel
  group.add(ground);
}

// -----------------------------------------------------------------------------

function buildRiver(group: THREE.Group, b: CityBounds): void {
  const len = b.maxZ - b.minZ;
  // Ripples: a tiling normal map from a few sine waves.
  const n = 256;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = (x / n) * Math.PI * 2;
      const v = (y / n) * Math.PI * 2;
      const dx = Math.cos(u * 3 + v) * 0.3 + Math.cos(u * 7 - v * 2) * 0.15;
      const dy = Math.cos(v * 4 - u) * 0.3 + Math.cos(v * 9 + u * 3) * 0.12;
      const i = (y * n + x) * 4;
      data[i] = (dx * 0.5 + 0.5) * 255;
      data[i + 1] = (dy * 0.5 + 0.5) * 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
  const normal = new THREE.DataTexture(data, n, n);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(12, len / 25);
  normal.needsUpdate = true;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(RIVER.x1 - RIVER.x0 + 4, len),
    new THREE.MeshPhysicalMaterial({ color: 0x03070b, roughness: 0.06, metalness: 0.1, normalMap: normal, normalScale: new THREE.Vector2(0.25, 0.25), clearcoat: 1 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set((RIVER.x0 + RIVER.x1) / 2, RIVER.level, (b.minZ + b.maxZ) / 2);
  water.receiveShadow = true;
  group.add(water);
  // Stone quay walls and railings.
  const stone = new THREE.MeshStandardMaterial({ map: concreteTexture(256), color: 0x8a8378, roughness: 0.9 });
  for (const x of [RIVER.x0, RIVER.x1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4, len), stone);
    wall.position.set(x + (x === RIVER.x0 ? -0.75 : 0.75), -1.9, (b.minZ + b.maxZ) / 2);
    wall.receiveShadow = true;
    group.add(wall);
  }
  (normal as unknown as { userData: object }).userData = {};
  group.userData.waterNormal = normal;
}

// -----------------------------------------------------------------------------
// Towers: instanced boxes; windows computed in the shader from world position.
// -----------------------------------------------------------------------------

export interface Tower {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

function windowMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.55 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSeed;\nvarying float vSeed;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vSeed = aSeed;
        vec4 cityWorld = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        vWPos = cityWorld.xyz;
        vWNrm = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSeed;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float side = step(0.5, abs(vWNrm.x));
          float roof = step(0.5, vWNrm.y);
          float u = mix(vWPos.x, vWPos.z, side) / 3.2;
          float v = vWPos.y / 3.6;
          vec2 cell = floor(vec2(u, v));
          vec2 f = fract(vec2(u, v));
          // Window size varies per tower (narrow strips to wide glazing).
          float ww = 0.1 + 0.18 * fract(vSeed * 7.7);
          float wh = 0.18 + 0.12 * fract(vSeed * 5.3);
          float win = step(ww, f.x) * step(f.x, 1.0 - ww) * step(wh, f.y) * step(f.y, 0.86);
          float h = fract(sin(dot(cell + vSeed * 31.7, vec2(12.9898, 78.233))) * 43758.5453);
          // Late evening: a minority of offices still lit, more in some towers than others.
          float lit = step(0.6 + 0.3 * fract(vSeed * 3.1), h);
          vec3 warm = vec3(1.0, 0.68, 0.38);
          vec3 cool = vec3(0.62, 0.78, 1.0);
          vec3 wc = mix(warm, cool, step(0.72, fract(h * 7.31)));
          // Ground floor: shop fronts, some lit (warm), some closed (dark shutters).
          float shopOpen = step(0.45, fract(h * 13.1));
          float shop = (1.0 - step(1.0, v)) * step(0.3, f.y) * step(0.08, f.x) * step(f.x, 0.92) * shopOpen;
          vec3 shopCol = mix(vec3(1.0, 0.8, 0.55), vec3(0.75, 0.9, 1.0), step(0.7, fract(h * 5.9)));
          vec3 glow = (win * lit * wc * (0.3 + 0.8 * fract(h * 3.7)) * step(1.0, v) + shop * shopCol * 0.45) * (1.0 - roof);
          totalEmissiveRadiance += glow;
          diffuseColor.rgb *= mix(1.0, 0.25, win);
        }`,
      );
  };
  return mat;
}

function buildBuildings(
  group: THREE.Group,
  b: CityBounds,
  clear: (x: number, z: number, c: number) => boolean,
  rand: () => number,
  density: number,
): Tower[] {
  const towers: Tower[] = [];
  const downtown = new THREE.Vector2(470, -160);
  for (let bx = Math.floor(b.minX / PITCH) * PITCH; bx < b.maxX; bx += PITCH) {
    for (let bz = Math.floor(b.minZ / PITCH) * PITCH; bz < b.maxZ; bz += PITCH) {
      // Block interior (between the streets).
      const x0 = bx + STREET / 2;
      const z0 = bz + STREET / 2;
      const lots = rand() < 0.5 ? 2 : 3;
      const lw = BLOCK / lots;
      for (let i = 0; i < lots; i++)
        for (let j = 0; j < 2; j++) {
          if (rand() > density) continue;
          const w = lw - 4 - rand() * 6;
          const d = BLOCK / 2 - 4 - rand() * 6;
          const x = x0 + lw * (i + 0.5);
          const z = z0 + (BLOCK / 2) * (j + 0.5);
          const r = Math.hypot(w, d) / 2;
          if (inRiver(x, r + 25) || !clear(x, z, r + 8)) continue;
          const dist = Math.hypot(x - downtown.x, z - downtown.y);
          const tall = 1 + 5.5 * Math.exp(-((dist / 420) ** 2));
          let h = (10 + rand() * 26) * tall;
          if (rand() < 0.08) h *= 1.6;
          towers.push({ x, z, w, d, h: Math.min(h, 230) });
        }
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const mat = windowMaterial();
  const mesh = new THREE.InstancedMesh(geo, mat, towers.length * 2);
  const seeds = new Float32Array(towers.length * 2);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  let k = 0;
  for (const t of towers) {
    // Tower, plus a setback crown on tall ones.
    const parts: Array<[number, number, number, number, number]> = [[t.x, 0, t.w, t.h, t.d]];
    if (t.h > 70) parts.push([t.x, t.h, t.w * 0.7, t.h * 0.18, t.d * 0.7]);
    for (const [x, y, w, h, d] of parts) {
      m.compose(new THREE.Vector3(x, y, t.z), q, new THREE.Vector3(w, h, d));
      mesh.setMatrixAt(k, m);
      const tone = 0.12 + rand() * 0.22;
      col.setRGB(tone, tone * (0.95 + rand() * 0.1), tone * (1 + rand() * 0.15));
      mesh.setColorAt(k, col);
      seeds[k] = rand() * 100;
      k++;
    }
  }
  mesh.count = k;
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);

  // Red aviation lights on the tallest towers (blink).
  const tall = towers.filter((t) => t.h > 90);
  const redMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.2, 0.1) });
  const reds = new THREE.InstancedMesh(new THREE.SphereGeometry(0.6, 8, 6), redMat, tall.length);
  tall.forEach((t, i) => reds.setMatrixAt(i, m.compose(new THREE.Vector3(t.x, t.h * 1.18 + 0.8, t.z), q, new THREE.Vector3(1, 1, 1))));
  group.add(reds);
  group.userData.aviation = redMat;
  return towers;
}

// -----------------------------------------------------------------------------

function buildSigns(
  group: THREE.Group,
  towers: Tower[],
  track: TrackSpline,
  index: TrackIndex,
  rand: () => number,
  animated: Array<(dt: number, time: number) => void>,
): void {
  // Neon signs on towers facing the circuit.
  const neonMats = NEON_SIGNS.map(
    ([text, color]) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: neonTexture(text, color), emissiveIntensity: 4, transparent: true, alphaMap: neonTexture(text, '#ffffff') }),
  );
  const leds = [ledScreen(), ledScreen()];
  const ledMats = leds.map((l) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: l.texture, emissiveIntensity: 2.2 }));
  let neon = 0;
  let led = 0;
  for (const t of towers) {
    const hit = index.near(t.x, t.z, Math.max(t.w, t.d) / 2 + 45);
    if (!hit) continue;
    const p = track.samples[hit.i].p;
    // Face of the tower that looks towards the track.
    const dx = p.x - t.x;
    const dz = p.z - t.z;
    const alongX = Math.abs(dx) / t.w > Math.abs(dz) / t.d;
    const nx = alongX ? Math.sign(dx) : 0;
    const nz = alongX ? 0 : Math.sign(dz);
    const half = alongX ? t.w / 2 : t.d / 2;
    const faceW = alongX ? t.d : t.w;
    const yaw = Math.atan2(nx, nz);
    if (t.h > 50 && led < 8 && rand() < 0.35) {
      const w = Math.min(faceW * 0.8, 22);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), ledMats[led % 2]);
      screen.position.set(t.x + nx * (half + 0.3), 18 + rand() * 20, t.z + nz * (half + 0.3));
      screen.rotation.y = yaw;
      group.add(screen);
      led++;
    } else if (neon < 60 && rand() < 0.6) {
      const mat = neonMats[Math.floor(rand() * neonMats.length)];
      const w = 7 + rand() * 4;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), mat);
      sign.position.set(t.x + nx * (half + 0.25), 6 + rand() * 14, t.z + nz * (half + 0.25));
      sign.rotation.y = yaw;
      group.add(sign);
      neon++;
    }
  }
  let acc = 0;
  animated.push((dt, time) => {
    acc += dt;
    if (acc < 0.1) return;
    acc = 0;
    leds.forEach((l, i) => {
      drawLed(l.canvas, time, i);
      l.texture.needsUpdate = true;
    });
    // Occasional neon flicker.
    for (const mtl of neonMats) mtl.emissiveIntensity = Math.random() < 0.015 ? 0.6 : 4;
  });
}

// -----------------------------------------------------------------------------

function buildBridgeAndPiers(group: THREE.Group, track: TrackSpline, animated: Array<(dt: number, time: number) => void>): void {
  const concrete = new THREE.MeshStandardMaterial({ map: concreteTexture(256), color: 0xb5b2aa, roughness: 0.85 });
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  // Piers under every elevated section, every 32 m.
  const piers: THREE.Matrix4[] = [];
  for (let i = 0; i < track.count; i += 32) {
    const smp = track.samples[i];
    if (smp.p.y < 3 || smp.zone === 'tunnel') continue;
    const groundY = inRiver(smp.p.x) ? RIVER.level : 0;
    const top = smp.p.y - 1.4;
    const h = top - groundY;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), smp.heading);
    piers.push(new THREE.Matrix4().compose(new THREE.Vector3(smp.p.x, groundY + h / 2, smp.p.z), q, new THREE.Vector3(smp.wallL + smp.wallR - 2, h, 2.2)));
  }
  const pierMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), concrete, piers.length);
  piers.forEach((pm, i) => pierMesh.setMatrixAt(i, pm));
  pierMesh.castShadow = pierMesh.receiveShadow = true;
  group.add(pierMesh);

  // Cable-stayed bridge: two pylons over the river, fans of stay cables to the deck edges.
  const steel = new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.35, metalness: 0.7 });
  const pylonLight = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x9fd0ff, emissiveIntensity: 2.5 });
  const cables: THREE.Matrix4[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (const x of [930, 1110]) {
    const q0 = track.project(x, -600);
    const smp = q0.sample;
    const lh = Math.hypot(smp.left.x, smp.left.z);
    const lx = smp.left.x / lh;
    const lz = smp.left.z / lh;
    const deckY = smp.p.y;
    const topY = deckY + 62;
    for (const side of [1, -1]) {
      const off = side * (smp.wallL + 1.6);
      const base = new THREE.Vector3(smp.p.x + lx * off, 0, smp.p.z + lz * off);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(2.4, topY - RIVER.level, 3.2), concrete);
      leg.position.set(base.x, (topY + RIVER.level) / 2, base.z);
      leg.rotation.y = smp.heading;
      leg.castShadow = true;
      group.add(leg);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.25, topY - deckY - 4, 0.25), pylonLight);
      strip.position.set(base.x - lx * side * 1.25, (topY + deckY) / 2, base.z - lz * side * 1.25);
      group.add(strip);
      // Stay cables: from the pylon top to the deck edge every 12 m, both directions.
      for (const dir of [1, -1]) {
        for (let k = 1; k <= 8; k++) {
          const s = q0.s + dir * k * 12;
          const anchor = track.pointAt(s, side * (smp.wallL + 0.8));
          const top = new THREE.Vector3(base.x, topY - k * 1.6, base.z);
          const len = top.distanceTo(anchor);
          const mid = top.clone().add(anchor).multiplyScalar(0.5);
          const dirV = anchor.clone().sub(top).normalize();
          q.setFromUnitVectors(up, dirV);
          cables.push(new THREE.Matrix4().compose(mid, q.clone(), new THREE.Vector3(1, len, 1)));
        }
      }
    }
    // Cross beam at the top.
    const beam = new THREE.Mesh(new THREE.BoxGeometry(smp.wallL + smp.wallR + 3.2, 2.5, 3), concrete);
    beam.position.set(smp.p.x, topY - 1.2, smp.p.z);
    beam.rotation.y = smp.heading + Math.PI / 2;
    group.add(beam);
  }
  const cableMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 6), steel, cables.length);
  cables.forEach((cm, i) => cableMesh.setMatrixAt(i, cm));
  group.add(cableMesh);
  void m;
  void animated;
}

// -----------------------------------------------------------------------------

function buildLamps(group: THREE.Group, track: TrackSpline, lamps: Lamp[]): THREE.InstancedMesh {
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.7 });
  const pole = new THREE.CylinderGeometry(0.12, 0.18, 9, 8);
  pole.translate(0, 4.5, 0);
  const arm = new THREE.BoxGeometry(0.12, 0.12, 3.4);
  arm.translate(0, 9, 1.7);
  const poleGeo = mergeGeometries([pole, arm]);
  const head = new THREE.BoxGeometry(0.5, 0.14, 0.9);
  const poles = new THREE.InstancedMesh(poleGeo, metal, lamps.length);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffe2b8, emissiveIntensity: 9 });
  const heads = new THREE.InstancedMesh(head, headMat, lamps.length);
  // Light pools on the road (additive decals) for every lamp; the nearest lamps also get a
  // real spotlight from the dynamic light pool.
  const poolMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1, 0.76, 0.5).multiplyScalar(0.3),
    alphaMap: radialTexture(128, 0.1),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -6,
  });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolMat, lamps.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  lamps.forEach((l, i) => {
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), l.toRoad);
    poles.setMatrixAt(i, m.compose(l.base, q, new THREE.Vector3(1, 1, 1)));
    heads.setMatrixAt(i, m.compose(l.head.clone().setY(l.head.y - 0.12), q, new THREE.Vector3(1, 1, 1)));
    const ground = track.project(l.head.x, l.head.z);
    pools.setMatrixAt(i, m.compose(new THREE.Vector3(l.head.x, ground.height + 0.05, l.head.z), new THREE.Quaternion(), new THREE.Vector3(17, 1, 17)));
  });
  poles.castShadow = true;
  pools.renderOrder = 2;
  group.add(poles, heads, pools);
  return pools;
}

// -----------------------------------------------------------------------------
// Decorative traffic, pedestrians and traffic lights on the street grid.
// -----------------------------------------------------------------------------

interface Lane {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  len: number;
}

function buildTraffic(
  group: THREE.Group,
  b: CityBounds,
  clear: (x: number, z: number, c: number, under?: boolean) => boolean,
  rand: () => number,
  animated: Array<(dt: number, time: number) => void>,
  density: number,
): void {
  // Runs of grid streets that never cross the circuit at street level nor the river.
  const lanes: Lane[] = [];
  const addRuns = (horizontal: boolean, c: number, from: number, to: number) => {
    let start: number | null = null;
    for (let t = from; t <= to; t += 8) {
      const x = horizontal ? t : c;
      const z = horizontal ? c : t;
      const ok = t < to && !inRiver(x, 6) && clear(x, z, 8, true);
      if (ok && start === null) start = t;
      if (!ok && start !== null) {
        if (t - start > 120) {
          for (const side of [1, -1]) {
            const o = side * 2.6;
            const [a, bb] = side > 0 ? [start, t - 8] : [t - 8, start];
            lanes.push(
              horizontal
                ? { ax: a, az: c + o, bx: bb, bz: c + o, len: Math.abs(bb - a) }
                : { ax: c + o, az: a, bx: c + o, bz: bb, len: Math.abs(bb - a) },
            );
          }
        }
        start = null;
      }
    }
  };
  for (let x = Math.floor(b.minX / PITCH) * PITCH; x < b.maxX; x += PITCH) addRuns(false, x, b.minZ, b.maxZ);
  for (let z = Math.floor(b.minZ / PITCH) * PITCH; z < b.maxZ; z += PITCH) addRuns(true, z, b.minX, b.maxX);

  const total = lanes.reduce((a, l) => a + l.len, 0);
  const count = Math.min(260, Math.floor((total / 90) * density));
  const cars: Array<{ lane: Lane; t: number; speed: number }> = [];
  for (let i = 0; i < count; i++) {
    let pick = rand() * total;
    let lane = lanes[0];
    for (const l of lanes) {
      pick -= l.len;
      if (pick <= 0) {
        lane = l;
        break;
      }
    }
    cars.push({ lane, t: rand(), speed: 11 + rand() * 6 });
  }
  const body = mergeGeometries([new THREE.BoxGeometry(1.8, 0.75, 4.4).translate(0, 0.55, 0), new THREE.BoxGeometry(1.6, 0.6, 2.2).translate(0, 1.2, -0.3)]);
  const bodies = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.5 }), cars.length);
  const head = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.6, 4) }), cars.length);
  const tail = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.1, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.1, 0.05) }), cars.length);
  const col = new THREE.Color();
  cars.forEach((_, i) => bodies.setColorAt(i, col.setHSL(rand(), 0.2 + rand() * 0.4, 0.08 + rand() * 0.3)));
  for (const im of [bodies, head, tail]) {
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false;
  }
  bodies.castShadow = true;
  group.add(bodies, head, tail);

  // Pedestrians on the pavements along the same streets (far from the circuit).
  const walkers = Array.from({ length: Math.floor(140 * density) }, () => {
    const lane = lanes[Math.floor(rand() * lanes.length)];
    return { lane, t: rand(), speed: 1.1 + rand() * 0.5, side: rand() < 0.5 ? 8.5 : -8.5 };
  });
  const people = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.22, 1.2, 3, 6).translate(0, 0.85, 0), new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.9 }), walkers.length);
  people.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  people.frustumCulled = false;
  group.add(people);

  // Traffic lights at the lane ends (red/green cycle).
  const lightPos = lanes.filter((_, i) => i % 3 === 0).map((l) => new THREE.Vector3(l.bx + 3, 0, l.bz + 3));
  const poleMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 6).translate(0, 2, 0), new THREE.MeshStandardMaterial({ color: 0x222428 }), lightPos.length);
  const lampMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), lightPos.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  lightPos.forEach((p, i) => {
    poleMesh.setMatrixAt(i, m.compose(p, q, one));
    lampMesh.setMatrixAt(i, m.compose(p.clone().setY(3.8), q, one));
  });
  group.add(poleMesh, lampMesh);
  const red = new THREE.Color(5, 0.15, 0.1);
  const green = new THREE.Color(0.1, 4, 1.2);

  const pos = new THREE.Vector3();
  animated.push((dt, time) => {
    cars.forEach((c, i) => {
      const l = c.lane;
      c.t = (c.t + (c.speed * dt) / l.len) % 1;
      pos.set(l.ax + (l.bx - l.ax) * c.t, 0, l.az + (l.bz - l.az) * c.t);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(l.bx - l.ax, l.bz - l.az));
      bodies.setMatrixAt(i, m.compose(pos, q, one));
      const fx = Math.sin(Math.atan2(l.bx - l.ax, l.bz - l.az));
      const fz = Math.cos(Math.atan2(l.bx - l.ax, l.bz - l.az));
      head.setMatrixAt(i, m.compose(new THREE.Vector3(pos.x + fx * 2.22, 0.62, pos.z + fz * 2.22), q, one));
      tail.setMatrixAt(i, m.compose(new THREE.Vector3(pos.x - fx * 2.22, 0.7, pos.z - fz * 2.22), q, one));
    });
    walkers.forEach((w, i) => {
      const l = w.lane;
      w.t = (w.t + (w.speed * dt) / l.len) % 1;
      const nx = l.az === l.bz ? 0 : 1;
      const nz = 1 - nx;
      people.setMatrixAt(i, m.compose(pos.set(l.ax + (l.bx - l.ax) * w.t + nx * w.side, 0.15, l.az + (l.bz - l.az) * w.t + nz * w.side), q.identity(), one));
    });
    lightPos.forEach((_, i) => lampMesh.setColorAt(i, Math.floor(time / 9 + i) % 2 ? red : green));
    for (const im of [bodies, head, tail, people]) im.instanceMatrix.needsUpdate = true;
    if (lampMesh.instanceColor) lampMesh.instanceColor.needsUpdate = true;
  });
}
