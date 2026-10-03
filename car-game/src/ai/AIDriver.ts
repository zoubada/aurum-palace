import type { DriveInput, Vehicle } from '../physics/vehicle';
import type { RacingLine } from './RacingLine';
import { clamp } from '../physics/math';

/**
 * Basic AI driver (Phase 3; overtaking and defending strategies arrive in Phase 6).
 *
 * It drives the same Vehicle physics as the player, with the same tires and aids (ABS, TC,
 * ESP): no grip or power bonus, no rubber-banding (SPEC §8). It follows the racing line with
 * a Stanley steering controller and tracks the car's own speed profile, scaled by its skill; it slows
 * behind a car in its way and moves over to pass when there is room.
 */
export class AIDriver {
  /** Index on the racing line. */
  index = -1;
  /** Fraction of the profile speed it dares to carry (0.85 = cautious, 1 = on the limit). */
  skill: number;
  /** Small per-driver variation so cars do not drive as one. */
  private readonly lineBias: number;
  private sideOffset = 0;
  private stuckTime = 0;
  /** Set when the car has been stuck for a while: the world should put it back on track. */
  needsReset = false;
  private readonly input: DriveInput = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };

  constructor(
    private readonly line: RacingLine,
    private readonly profile: Float64Array,
    skill: number,
    seed = 1,
  ) {
    this.skill = skill;
    this.lineBias = ((seed * 0.618) % 1) * 0.6 - 0.3;
  }

  /** `others`: every car on track (this one is skipped). */
  update(v: Vehicle, dt: number, others: readonly Vehicle[]): DriveInput {
    const line = this.line;
    const M = line.count;
    this.index = line.nearest(v.x, v.z, this.index);
    const speed = Math.max(0, v.u);
    const sy = Math.sin(v.yaw);
    const cy = Math.cos(v.yaw);

    // --- Traffic: the closest car ahead in our path.
    let blockSpeed = Infinity;
    let blockSide = 0;
    for (const o of others) {
      if (o === v) continue;
      const dx = o.x - v.x;
      const dz = o.z - v.z;
      const f = dx * sy + dz * cy;
      const l = dx * cy - dz * sy;
      if (f > 1 && f < 30 && Math.abs(l) < 2.6 && Math.abs(o.y - v.y) < 3) {
        const follow = o.u + (f - 9) * 0.45;
        if (follow < blockSpeed) {
          blockSpeed = follow;
          blockSide = l >= 0 ? -1 : 1; // pass on the other side
        }
      }
    }
    const wantSide = blockSpeed < speed - 1 ? blockSide * 2.6 : 0;
    this.sideOffset += (wantSide - this.sideOffset) * Math.min(1, dt * 1.5);

    // --- Steering: Stanley controller on a slightly previewed point of the line (compensates
    // the steering rack and tire lag), with curvature feed-forward. Shifted sideways to pass.
    const preview = (this.index + Math.round((2 + speed * 0.12) / line.spacing)) % M;
    const p0 = line.points[preview];
    const p1 = line.points[(preview + 1) % M];
    const smp = line.track.sample(line.track.indexAt(p0.s));
    const hw = smp.hw - 1.3;
    const shift = clamp(p0.offset + this.sideOffset + this.lineBias, -hw, hw) - p0.offset;
    const lh = Math.hypot(smp.left.x, smp.left.z) || 1;
    const tx = p0.x + (smp.left.x / lh) * shift;
    const tz = p0.z + (smp.left.z / lh) * shift;
    const lineHeading = Math.atan2(p1.x - p0.x, p1.z - p0.z);
    // Lateral error of the car relative to the line point (+ = car left of the line).
    const ex = v.x - tx;
    const ez = v.z - tz;
    const err = ex * Math.cos(lineHeading) - ez * Math.sin(lineHeading);
    let headErr = lineHeading - v.yaw;
    headErr = Math.atan2(Math.sin(headErr), Math.cos(headErr));
    let delta = Math.atan(v.cfg.wheelbase * p0.kappa) + headErr + Math.atan((-2.2 * err) / (speed + 3));
    // Yaw damping and slide catching.
    delta -= (v.r - speed * p0.kappa) * 0.06;
    if (speed > 5) delta += clamp(Math.atan2(v.v, speed), -0.3, 0.3) * 0.5;
    this.input.steer = clamp(-delta / v.cfg.steering.maxAngle, -1, 1);

    // --- Speed: follow the profile a little ahead (reaction time), scaled by skill.
    const lead = (this.index + Math.round((speed * 0.45) / line.spacing) + 1) % M;
    let target = Math.min(this.profile[lead], this.profile[this.index]) * this.skill;
    target = Math.min(target, blockSpeed);
    const dv = target - speed;
    if (dv >= 0) {
      this.input.throttle = clamp(0.35 + dv * 0.35, 0, 1);
      this.input.brake = 0;
    } else {
      this.input.throttle = dv > -1.5 ? 0.15 : 0;
      this.input.brake = dv < -1 ? clamp(-dv * 0.18, 0, 1) : 0;
    }

    // --- Stuck detection.
    this.stuckTime = speed < 1.5 ? this.stuckTime + dt : 0;
    this.needsReset = this.stuckTime > 4;
    return this.input;
  }

  resetStuck(): void {
    this.stuckTime = 0;
    this.needsReset = false;
  }
}
