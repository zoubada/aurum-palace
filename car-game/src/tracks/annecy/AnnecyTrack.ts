import * as THREE from 'three';
import type { QualitySettings } from '../../core/quality';
import { Environment } from '../../render/Environment';
import { Rain } from '../../render/Rain';
import { sunPosition } from '../../render/sun';
import { asphaltTextures, concreteTexture, grassTexture } from '../../render/textures';
import { SplineSurface, type Racer } from '../../game-modes/RaceWorld';
import { RacingLine } from '../../ai/RacingLine';
import { TrackSpline } from '../TrackSpline';
import type { TrackScene, TrackView } from '../TrackScene';
import { racingLineMesh } from '../racingLineMesh';
import { TIMES, type TimeOfDay } from '../../game-modes/options';
import { ANNECY_BASE, annecyControlPoints, type AnnecyTrackData } from './data';
import { Terrain, loadFar, type FarTerrain } from './terrain';
import { Lake } from './lake';
import { buildRuralRoad, type RuralMaterials } from './roadside';
import { setBuildingLights } from './objects';
import { chequerTexture } from '../city/textures';

/**
 * Circuit 2 — "Tour du lac d'Annecy" (SPEC §5), built from real open data: the roads of the
 * tour (D1508 on the west shore, D909/D909A on the east shore) and the lake from OpenStreetMap,
 * the relief, aerial photographs, trees and building heights from the IGN. The terrain is
 * streamed in 1 km tiles around the camera; the mountains around the lake are a low-resolution
 * backdrop. Time of day (real sun position for Annecy in June) and weather are chosen in the
 * garage; the full 37.5 km lap or one shore as a sprint.
 */

/** Wet asphalt grip relative to dry. */
const WET_GRIP = 0.78;
const LAT = 45.86;
const LON = 6.17;

export interface AnnecyBundle {
  data: AnnecyTrackData;
  far: FarTerrain;
}

/** Download what the circuit needs before the start (track, far terrain). */
export async function loadAnnecy(maxAniso: number, base = ANNECY_BASE): Promise<AnnecyBundle> {
  const res = await fetch(`${base}track.json`);
  if (!res.ok) throw new Error(`track.json: ${res.status}`);
  const [data, far] = await Promise.all([res.json() as Promise<AnnecyTrackData>, loadFar(base, maxAniso)]);
  return { data, far };
}

function materials(rain: boolean, aniso: number): RuralMaterials {
  const asphalt = asphaltTextures(1024);
  for (const t of [asphalt.map, asphalt.roughness, asphalt.bump]) t.anisotropy = aniso;
  const road = new THREE.MeshStandardMaterial({
    map: asphalt.map,
    roughnessMap: asphalt.roughness,
    bumpMap: asphalt.bump,
    bumpScale: rain ? 0.4 : 1,
    roughness: rain ? 0.3 : 1,
    envMapIntensity: rain ? 1.6 : 1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
  if (rain) road.color.setScalar(0.55);
  const ds = THREE.DoubleSide;
  const grass = grassTexture(512);
  grass.anisotropy = aniso;
  const concrete = concreteTexture(512);
  return {
    road,
    line: new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: rain ? 0.3 : 0.6, side: ds, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 }),
    verge: new THREE.MeshStandardMaterial({ map: grass, color: 0xb8b8a8, roughness: 0.95, side: ds, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -3 }),
    sidewalk: new THREE.MeshStandardMaterial({ map: concrete, color: 0xa8a49c, roughness: rain ? 0.4 : 0.9, side: ds, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -3 }),
    kerb: new THREE.MeshStandardMaterial({ map: concrete, color: 0xd0ccc4, roughness: 0.8, side: ds }),
    rail: new THREE.MeshStandardMaterial({ color: 0xc4c8cc, metalness: 0.85, roughness: 0.35, side: ds }),
    post: new THREE.MeshStandardMaterial({ color: 0x9a9fa5, metalness: 0.6, roughness: 0.5 }),
    wall: new THREE.MeshStandardMaterial({ map: concrete, color: 0xc9c2b4, roughness: 0.9, side: ds }),
    deck: new THREE.MeshStandardMaterial({ map: concrete, color: 0xa29f97, roughness: 0.85, side: ds }),
    chequer: new THREE.MeshStandardMaterial({ map: chequerTexture(), roughness: 0.6, side: ds, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -8 }),
  };
}

export class AnnecyTrack implements TrackScene {
  readonly id = 'annecy';
  readonly name: string;
  readonly spline: TrackSpline;
  readonly surface: SplineSurface;
  readonly sectors: number[];
  readonly racingLine: RacingLine;
  readonly grip: number;
  readonly night = false;
  readonly exposure: number;
  readonly enclosure = 0;
  readonly viewDistance = 42000;
  readonly sprint: { from: number; to: number } | null;
  readonly ambience = 'nature' as const;
  readonly credits = 'Données : © contributeurs OpenStreetMap (ODbL) · IGN RGE ALTI, BD ORTHO (Licence Ouverte)';
  private readonly group = new THREE.Group();
  private readonly env: Environment;
  private readonly terrain: Terrain;
  private readonly lake: Lake;
  private readonly rain: Rain | null = null;
  private readonly start: number;
  private lineMesh: THREE.Mesh | null = null;
  private readonly tmp = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    quality: QualitySettings,
    maxAnisotropy: number,
    bundle: AnnecyBundle,
    options: { variant: string; time: TimeOfDay; rain: boolean },
  ) {
    const d = bundle.data;
    this.spline = new TrackSpline(annecyControlPoints(d), 1);
    this.surface = new SplineSurface(this.spline);
    this.racingLine = new RacingLine(this.spline);
    this.grip = options.rain ? WET_GRIP : 1;
    const variant = d.variants.find((v) => v.id === options.variant) ?? d.variants[0];
    const full = variant.id === 'full';
    this.sprint = full ? null : { from: variant.from, to: variant.to };
    this.sectors = full ? d.sectors : [0, 1 / 3, 2 / 3];
    this.start = variant.from;
    this.name = full ? d.name : `Lac d’Annecy · ${variant.name}`;
    scene.add(this.group);

    // --- Sky, sun at the real position for the chosen time (21 June, Annecy, UTC+2).
    this.env = new Environment(scene, renderer, quality);
    const hour = TIMES[options.time].hour;
    const date = new Date(Date.UTC(2026, 5, 21, Math.floor(hour) - 2, Math.round((hour % 1) * 60)));
    const sun = sunPosition(date, LAT, LON);
    if (options.rain) this.env.setOvercast(true);
    this.env.setSun(Math.max(1.5, sun.elevation), 180 - sun.azimuth);
    const low = Math.max(0, Math.min(1, (sun.elevation - 2) / 25));
    this.env.sun.color.setRGB(1, 0.62 + 0.33 * low, 0.38 + 0.5 * low);
    this.env.sun.intensity = options.rain ? 0.5 : 0.9 + 1.8 * low;
    this.exposure = options.rain ? 1.3 : 1 + (1 - low) * 0.55;
    // Windows light up as the sun goes down.
    setBuildingLights(Math.max(0, Math.min(1, (8 - sun.elevation) / 8)) * (options.rain ? 1 : 0.85));
    // Long-range alpine haze, warmer at sunset, grey in the rain.
    this.env.setFog(options.rain ? 0x8e959c : low < 0.3 ? 0xd9b48f : 0xa9bfd6, options.rain ? 0.00045 : 0.00006);

    // --- Terrain, lake, road.
    const aniso = Math.min(quality.anisotropy, maxAnisotropy);
    this.terrain = new Terrain(d, bundle.far, ANNECY_BASE, aniso, quality);
    this.group.add(this.terrain.group);
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - Math.max(1.5, sun.elevation)), THREE.MathUtils.degToRad(180 - sun.azimuth));
    this.lake = new Lake(d.lake.outer, d.lake.inner, quality, sunDir, this.env.sun.color, options.rain);
    this.group.add(this.lake.mesh);
    const lines = full ? [0] : [variant.from, variant.to];
    this.group.add(buildRuralRoad(this.spline, materials(options.rain, aniso), d.signs, lines, d.crossings ?? []));

    if (options.rain) {
      this.rain = new Rain(quality.rainDrops);
      this.group.add(this.rain.mesh);
    }
  }

  async ready(): Promise<void> {
    const p = this.spline.pointAt(this.start - 30, 0);
    await this.terrain.preload(p.x, p.z, 1200);
    // Build the meshes of the preloaded tiles right away.
    for (let k = 0; k < 6; k++) this.terrain.update(1, p);
  }

  placeOnGrid(r: Racer, slot: number): void {
    const s = this.start - 8 - slot * 8 - r.car.visual.frontOverhangFromCg - 0.4;
    const smp = this.spline.sample(this.spline.indexAt(s));
    const side = slot % 2 ? -1 : 1;
    this.surface.place(r, (s + this.spline.length) % this.spline.length, side * Math.min(1.7, smp.hw - 1.4));
  }

  recover(r: Racer): void {
    const smp = this.spline.sample(this.spline.indexAt(r.s));
    const d = THREE.MathUtils.clamp(r.lateral, -smp.hw + 1.5, smp.hw - 1.5);
    this.surface.place(r, r.s, d);
  }

  minimap(): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < this.spline.count; i += 40) {
      const p = this.spline.samples[i].p;
      out.push([p.x, p.z]);
    }
    return out;
  }

  setRacingLine(profile: Float64Array | null): void {
    if (this.lineMesh) {
      this.lineMesh.removeFromParent();
      this.lineMesh.geometry.dispose();
      (this.lineMesh.material as THREE.Material).dispose();
      this.lineMesh = null;
    }
    if (!profile) return;
    this.lineMesh = racingLineMesh(this.spline, this.racingLine, profile);
    this.group.add(this.lineMesh);
  }

  applyQuality(q: QualitySettings): void {
    this.env.applyQuality(q);
    this.terrain.applyQuality(q);
  }

  update(dt: number, view: TrackView): void {
    const cam = view.camera.position;
    const v = view.player.vehicle;
    this.terrain.update(dt, cam);
    this.env.follow(this.tmp.set(v.x, v.y, v.z));
    this.env.centreSky(cam);
    this.lake.update(view.time);
    this.rain?.update(view.time, view.camera, 0);
  }

  /** Streaming state for the telemetry overlay. */
  get stats(): string {
    const s = this.terrain.stats;
    return `${s.meshes} cases de terrain affichées, ${s.loaded} chargées`;
  }

  dispose(): void {
    this.terrain.dispose();
    this.lake.dispose();
    this.rain?.dispose();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
    });
  }
}
