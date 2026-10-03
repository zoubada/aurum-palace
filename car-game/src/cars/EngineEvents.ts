import type { EngineSoundProfile } from './types';
import type { Vehicle } from '../physics/vehicle';
import { clamp } from '../physics/math';

/**
 * Discrete engine events derived from the simulation, shared by the sound (crackles,
 * blow-off, shift clunk) and the visuals (exhaust flames), so what you hear and see match.
 */
export interface EngineEventFrame {
  /** Overrun / upshift backfires this frame (each one = a crackle + a flame flash). */
  pops: number;
  /** Boost level released by the blow-off valve this frame (0 = none). */
  blowOff: number;
  /** A gear change happened this frame. */
  gearChanged: boolean;
  /** Turbo boost, 0–1 (spools with throttle and rpm, with lag). */
  boost: number;
}

export class EngineEvents {
  boost = 0;
  private lastThrottle = 0;
  private overrunTimer = 0;
  private lastGear = 1;
  private readonly frame: EngineEventFrame = { pops: 0, blowOff: 0, gearChanged: false, boost: 0 };

  constructor(
    private readonly profile: EngineSoundProfile,
    private readonly redline: number,
  ) {}

  update(dt: number, v: Vehicle): EngineEventFrame {
    const f = this.frame;
    f.pops = 0;
    f.blowOff = 0;
    f.gearChanged = false;
    const p = this.profile;
    const throttle = v.appliedThrottle;
    const rn = clamp(v.engineRpm / this.redline, 0, 1.2);

    if (p.turbo > 0) {
      const target = throttle * clamp((v.engineRpm - 0.25 * this.redline) / (0.35 * this.redline), 0, 1);
      this.boost += (target - this.boost) * clamp(dt / (target > this.boost ? 0.55 : 0.12), 0, 1);
      if (this.lastThrottle > 0.6 && throttle < 0.2 && this.boost > 0.4) f.blowOff = this.boost;
    }
    f.boost = this.boost;

    // Crackles on the overrun after a hard pull.
    if (throttle > 0.7) this.overrunTimer = 1.5;
    this.overrunTimer = Math.max(0, this.overrunTimer - dt);
    if (throttle < 0.05 && rn > 0.42 && this.overrunTimer > 0 && Math.random() < p.pops * 14 * rn * dt) f.pops++;

    if (v.gear !== this.lastGear) {
      f.gearChanged = true;
      // Ignition cut on a full-throttle upshift: one bang.
      if (v.gear > this.lastGear && this.lastThrottle > 0.8 && v.gear > 1 && Math.random() < p.pops) f.pops++;
      this.lastGear = v.gear;
    }
    this.lastThrottle = throttle;
    return f;
  }
}
