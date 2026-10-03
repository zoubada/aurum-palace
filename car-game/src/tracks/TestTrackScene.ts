import * as THREE from 'three';
import { Environment } from '../render/Environment';
import type { QualitySettings } from '../core/quality';
import { FlatSurface, type Racer } from '../game-modes/RaceWorld';
import { TestTrack } from './TestTrack';
import type { TrackScene, TrackView } from './TrackScene';

/** The Phase 1 test area (daylight, flat, cones) behind the TrackScene interface. */
export class TestTrackScene implements TrackScene {
  readonly id = 'test';
  readonly name: string;
  readonly surface: FlatSurface;
  readonly spline = null;
  readonly sectors = [0];
  readonly racingLine = null;
  readonly grip = 1;
  readonly night = false;
  readonly exposure = 1;
  readonly enclosure = 0;
  readonly viewDistance = 9000;
  readonly sprint = null;
  readonly ambience = 'none' as const;
  private readonly env: Environment;
  private readonly track: TestTrack;
  private readonly focus = new THREE.Vector3();

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, quality: QualitySettings, maxAnisotropy: number) {
    this.env = new Environment(scene, renderer, quality);
    this.track = new TestTrack(quality, maxAnisotropy);
    this.name = this.track.name;
    scene.add(this.track.group);
    const [w0, w1, w2, w3] = this.track.walls;
    // rectangleWalls order: minX, maxX, minZ, maxZ (normals pointing inwards).
    this.surface = new FlatSurface(w0.d, -w1.d, w2.d, -w3.d);
  }

  placeOnGrid(r: Racer, slot: number): void {
    const s = this.track.spawn;
    this.surface.place(r, s.x - slot * 9, s.z + (slot % 2) * 5, s.yaw);
    if (slot === 0) this.track.resetCones();
  }

  recover(r: Racer): void {
    this.placeOnGrid(r, 0);
  }

  update(dt: number, view: TrackView): void {
    const v = view.player.vehicle;
    const c = view.player.car.visual;
    this.track.update(dt, v, c.frontOverhangFromCg, c.rearOverhangFromCg, c.width / 2);
    this.env.follow(this.focus.set(v.x, 0, v.z));
  }

  applyQuality(q: QualitySettings): void {
    this.env.applyQuality(q);
    this.track.applyQuality(q);
  }

  setRacingLine(): void {
    /* no racing line on the test area */
  }

  minimap(): null {
    return null;
  }

  dispose(): void {
    /* geometry is disposed with the session scene */
  }
}
