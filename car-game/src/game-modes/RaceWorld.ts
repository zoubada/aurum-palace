import type { CarConfig } from '../cars/types';
import { Vehicle, ASSIST_PRESETS, type DriveInput } from '../physics/vehicle';
import { collideWalls, outlinePoints, rectangleWalls, resolveContact, type Wall } from '../physics/collision';
import { collideCars, type CarBox } from '../physics/carCollision';
import type { TrackSpline } from '../tracks/TrackSpline';
import { LapTimer, type LapRecord, type TimerEvents } from '../tracks/LapTimer';
import { AIDriver } from '../ai/AIDriver';
import type { RacingLine } from '../ai/RacingLine';

/**
 * Headless simulation of every car on a track: ground following, barriers, car-to-car contacts,
 * AI drivers and lap timing. Rendering-free, so the same code runs in the game and in the tests.
 */

export interface Racer {
  readonly car: CarConfig;
  readonly vehicle: Vehicle;
  readonly box: CarBox;
  readonly outline: Array<[number, number]>;
  ai: AIDriver | null;
  input: DriveInput;
  /** Nearest track sample (search hint). */
  trackIndex: number;
  /** Distance along the lap and lateral offset (m). */
  s: number;
  lateral: number;
  /** All four wheels off the road. */
  offTrack: boolean;
  /** Strongest wall/car impact during the last frame (m/s). */
  impact: number;
  timer: LapTimer | null;
  /** Distance covered, for race positions (laps × length + s). */
  progress: number;
}

export interface WorldSurface {
  readonly spline: TrackSpline | null;
  /** Ground height/normal, per-wheel grip, track position. */
  ground(r: Racer): void;
  walls(r: Racer): Wall[];
  /** Barrier contacts computed by the surface itself; returns the closing speed (m/s). */
  collide?(r: Racer): number;
  /** Put a car on the track at distance s, lateral offset d, facing the direction of travel. */
  place(r: Racer, s: number, d: number): void;
}

const ASPHALT = 1;
const KERB = 0.95;
const RUNOFF = 0.8;

/** Surface of a circuit defined by a spline. */
export class SplineSurface implements WorldSurface {
  constructor(readonly spline: TrackSpline) {}

  ground(r: Racer): void {
    const v = r.vehicle;
    const q = this.spline.project(v.x, v.z, r.trackIndex);
    r.trackIndex = q.index;
    r.s = q.s;
    r.lateral = q.lateral;
    const smp = q.sample;
    v.y = q.height;
    v.ground.nx = smp.up.x;
    v.ground.ny = smp.up.y;
    v.ground.nz = smp.up.z;
    v.ground.curv = smp.yCurv;
    // Per-wheel surface: road, kerb strip, run-off.
    const lh = Math.hypot(smp.left.x, smp.left.z) || 1;
    const lx = smp.left.x / lh;
    const lz = smp.left.z / lh;
    let off = 0;
    for (const w of v.wheels) {
      const [wx, wz] = v.bodyToWorld(w.x, w.y);
      const lat = Math.abs(q.lateral + (wx - v.x) * lx + (wz - v.z) * lz);
      w.surface = lat <= smp.hw ? ASPHALT : lat <= smp.hw + 0.9 ? KERB : RUNOFF;
      if (lat > smp.hw + 0.5) off++;
    }
    r.offTrack = off === 4;
  }

  /**
   * Barriers follow the curve: every outline point of the car is located on the spline (local
   * search around the car's sample) and compared with the barrier offsets there. (A single
   * plane per side would be too restrictive on the inside of tight hairpins.)
   */
  collide(r: Racer): number {
    const v = r.vehicle;
    const sp = this.spline;
    // Deepest penetration on each side (0 = left barrier, 1 = right barrier).
    const depth = [0, 0];
    const px = [0, 0];
    const pz = [0, 0];
    const nx = [0, 0];
    const nz = [0, 0];
    for (const [f, l] of r.outline) {
      const [x, z] = v.bodyToWorld(f, l);
      let best = r.trackIndex;
      let bd = Infinity;
      for (let k = -9; k <= 9; k++) {
        const p = sp.sample(r.trackIndex + k).p;
        const d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < bd) {
          bd = d;
          best = r.trackIndex + k;
        }
      }
      const smp = sp.sample(best);
      const lh = Math.hypot(smp.left.x, smp.left.z) || 1;
      const lx = smp.left.x / lh;
      const lz = smp.left.z / lh;
      const lat = (x - smp.p.x) * lx + (z - smp.p.z) * lz;
      const penL = lat - smp.wallL;
      const penR = -lat - smp.wallR;
      if (penL > depth[0]) {
        depth[0] = penL;
        px[0] = x;
        pz[0] = z;
        nx[0] = -lx;
        nz[0] = -lz;
      }
      if (penR > depth[1]) {
        depth[1] = penR;
        px[1] = x;
        pz[1] = z;
        nx[1] = lx;
        nz[1] = lz;
      }
    }
    let worst = 0;
    for (const k of [0, 1]) if (depth[k] > 0) worst = Math.max(worst, resolveContact(v, px[k], pz[k], nx[k], nz[k], depth[k]));
    return worst;
  }

  walls(r: Racer): Wall[] {
    const smp = this.spline.sample(r.trackIndex);
    const lh = Math.hypot(smp.left.x, smp.left.z) || 1;
    const lx = smp.left.x / lh;
    const lz = smp.left.z / lh;
    const plx = smp.p.x + lx * smp.wallL;
    const plz = smp.p.z + lz * smp.wallL;
    const prx = smp.p.x - lx * smp.wallR;
    const prz = smp.p.z - lz * smp.wallR;
    return [
      { nx: -lx, nz: -lz, d: -(plx * lx + plz * lz) },
      { nx: lx, nz: lz, d: prx * lx + prz * lz },
    ];
  }

  place(r: Racer, s: number, d: number): void {
    const p = this.spline.pointAt(s, d);
    const smp = this.spline.sample(this.spline.indexAt(s));
    r.vehicle.reset(p.x, p.z, smp.heading);
    r.trackIndex = this.spline.indexAt(s);
    this.ground(r);
  }
}

/** Flat walled area (the test track). */
export class FlatSurface implements WorldSurface {
  readonly spline = null;
  private readonly rect: Wall[];

  constructor(minX: number, maxX: number, minZ: number, maxZ: number) {
    this.rect = rectangleWalls(minX, maxX, minZ, maxZ);
  }

  ground(r: Racer): void {
    const v = r.vehicle;
    v.y = 0;
    v.ground.nx = v.ground.nz = v.ground.curv = 0;
    v.ground.ny = 1;
    for (const w of v.wheels) w.surface = ASPHALT;
    r.offTrack = false;
  }

  walls(): Wall[] {
    return this.rect;
  }

  place(r: Racer, x: number, z: number, yaw = 0): void {
    r.vehicle.reset(x, z, yaw);
  }
}

export interface AISetup {
  line: RacingLine;
  profile: Float64Array;
  skill: number;
  seed: number;
}

/**
 * Input of a car held on the grid: handbrake only (the brake pedal at a standstill would select
 * reverse with the automatic gearbox).
 */
export const HOLD: DriveInput = { throttle: 0, brake: 0, steer: 0, handbrake: 1 };

export class RaceWorld {
  readonly racers: Racer[] = [];
  /** Hold every AI car on its brakes (start countdown). */
  hold = false;
  private vehicles: Vehicle[] = [];
  /** Timer events of the last step, per racer. */
  readonly events: Array<{ racer: Racer; ev: TimerEvents }> = [];

  constructor(
    readonly surface: WorldSurface,
    private readonly sectors: number[] = [0],
    /** Tire grip of the surface for every car (1 = dry, ~0.78 = wet). */
    readonly grip = 1,
    /** Point-to-point course on the circuit (start and finish distances), null = laps. */
    readonly sprint: { from: number; to: number } | null = null,
  ) {}

  add(car: CarConfig, ai?: AISetup, best: LapRecord | null = null): Racer {
    const vehicle = new Vehicle(car.physics);
    const v = car.visual;
    const racer: Racer = {
      car,
      vehicle,
      box: { vehicle, front: v.frontOverhangFromCg, rear: v.rearOverhangFromCg, halfWidth: v.width / 2 },
      outline: outlinePoints(v.frontOverhangFromCg, v.rearOverhangFromCg, v.width / 2),
      ai: ai ? new AIDriver(ai.line, ai.profile, ai.skill, ai.seed) : null,
      input: { throttle: 0, brake: 0, steer: 0, handbrake: 0 },
      trackIndex: -1,
      s: 0,
      lateral: 0,
      offTrack: false,
      impact: 0,
      timer: this.surface.spline ? new LapTimer(this.surface.spline.length, this.sectors, best, this.sprint) : null,
      progress: 0,
    };
    if (ai) {
      // AI drivers use the standard aids, like a pro with traction control on.
      vehicle.assists = { ...ASSIST_PRESETS.intermediate, esp: true, steerLimit: false };
    }
    vehicle.surfaceGrip = this.grip;
    this.racers.push(racer);
    return racer;
  }

  /** Advance the whole world by one fixed physics step. */
  step(dt: number): void {
    this.events.length = 0;
    if (this.vehicles.length !== this.racers.length) this.vehicles = this.racers.map((r) => r.vehicle);
    for (const r of this.racers) {
      if (r.ai) {
        r.input = this.hold ? HOLD : r.ai.update(r.vehicle, dt, this.vehicles);
        if (r.ai.needsReset && this.surface.spline) {
          // Put a stranded AI car back on its line, a little further on.
          const p = r.ai.index >= 0 ? this.surface.spline.indexAt(r.s + 15) : 0;
          this.surface.place(r, p * this.surface.spline.ds, 0);
          r.ai.resetStuck();
        }
      }
      r.vehicle.step(dt, r.input);
      this.surface.ground(r);
      const hit = this.surface.collide ? this.surface.collide(r) : (collideWalls(r.vehicle, r.outline, this.surface.walls(r))?.speed ?? 0);
      r.impact = Math.max(r.impact, hit);
    }
    for (let i = 0; i < this.racers.length; i++) {
      for (let j = i + 1; j < this.racers.length; j++) {
        const imp = collideCars(this.racers[i].box, this.racers[j].box);
        if (imp > 0) {
          this.racers[i].impact = Math.max(this.racers[i].impact, imp);
          this.racers[j].impact = Math.max(this.racers[j].impact, imp);
        }
      }
    }
    for (const r of this.racers) {
      if (!r.timer) continue;
      const ev = r.timer.update(dt, r.s, r.offTrack);
      if (ev.lap || ev.sector || ev.invalidated) this.events.push({ racer: r, ev });
      // Before its first crossing of the line a car is still behind it (on the grid).
      const s = r.timer.local(r.s);
      r.progress = r.timer.finished ? r.timer.length + 1e6 - r.timer.lastLap!.time : r.timer.started ? r.timer.laps * r.timer.length + s : s - r.timer.length;
    }
  }
}
