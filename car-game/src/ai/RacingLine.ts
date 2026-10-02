import type { TrackSpline } from '../tracks/TrackSpline';
import type { CarPhysicsConfig } from '../cars/types';
import { AIR_DENSITY, G, RPM_TO_RADS, interpTable } from '../physics/math';

/**
 * Ideal racing line (SPEC §8): a minimum-curvature path inside the track limits, obtained by
 * relaxing a bi-Laplacian smoothing of the line's offsets from the centreline. Used by the AI,
 * and drawn on the road as the "ligne de trajectoire" driving aid.
 *
 * `speedProfile` then derives, for a given car, the fastest speed it can hold at each point:
 * cornering limit from tire grip + downforce, then a forward pass (traction/power) and a backward
 * pass (braking), both inside the friction circle and including the road gradient.
 */

export interface LinePoint {
  x: number;
  y: number;
  z: number;
  /** Distance along the track centreline (m). */
  s: number;
  /** Lateral offset from the centreline (m, + = left). */
  offset: number;
  /** Signed curvature of the line (1/m, + = left). */
  kappa: number;
  /** Track gradient (sin of the slope). */
  grade: number;
}

export class RacingLine {
  readonly points: LinePoint[] = [];
  readonly spacing: number;

  constructor(
    readonly track: TrackSpline,
    margin = 1.35,
    spacing = 3,
    iterations = 2500,
  ) {
    const M = Math.round(track.length / spacing);
    this.spacing = track.length / M;
    const cx = new Float64Array(M);
    const cz = new Float64Array(M);
    const lx = new Float64Array(M);
    const lz = new Float64Array(M);
    const lim = new Float64Array(M);
    const o = new Float64Array(M);
    for (let i = 0; i < M; i++) {
      const smp = track.sample(track.indexAt(i * this.spacing));
      cx[i] = smp.p.x;
      cz[i] = smp.p.z;
      const h = Math.hypot(smp.left.x, smp.left.z) || 1;
      lx[i] = smp.left.x / h;
      lz[i] = smp.left.z / h;
      lim[i] = Math.max(0, smp.hw - margin);
    }
    const px = (j: number) => cx[j] + o[j] * lx[j];
    const pz = (j: number) => cz[j] + o[j] * lz[j];
    for (let it = 0; it < iterations; it++) {
      for (let i = 0; i < M; i++) {
        const a = (i - 2 + M) % M;
        const b = (i - 1 + M) % M;
        const c = (i + 1) % M;
        const d = (i + 2) % M;
        // Point that minimises the local curvature (4th-order smoothing).
        const qx = (-px(a) + 4 * px(b) + 4 * px(c) - px(d)) / 6;
        const qz = (-pz(a) + 4 * pz(b) + 4 * pz(c) - pz(d)) / 6;
        const target = (qx - cx[i]) * lx[i] + (qz - cz[i]) * lz[i];
        o[i] = Math.max(-lim[i], Math.min(lim[i], o[i] + 0.55 * (target - o[i])));
      }
    }
    for (let i = 0; i < M; i++) {
      const s = i * this.spacing;
      const p = track.pointAt(s, o[i]);
      this.points.push({ x: p.x, y: p.y, z: p.z, s, offset: o[i], kappa: 0, grade: track.sample(track.indexAt(s)).t.y });
    }
    // Signed curvature from three points (circumscribed circle), lightly smoothed.
    const raw = new Float64Array(M);
    for (let i = 0; i < M; i++) {
      const A = this.points[(i - 1 + M) % M];
      const B = this.points[i];
      const C = this.points[(i + 1) % M];
      const abx = B.x - A.x;
      const abz = B.z - A.z;
      const bcx = C.x - B.x;
      const bcz = C.z - B.z;
      // Heading convention forward = (sin ψ, cos ψ): a left turn has abz·bcx − abx·bcz > 0.
      const cross = abz * bcx - abx * bcz;
      const den = Math.hypot(abx, abz) * Math.hypot(bcx, bcz) * Math.hypot(C.x - A.x, C.z - A.z);
      raw[i] = den > 1e-9 ? (2 * cross) / den : 0;
    }
    for (let i = 0; i < M; i++) this.points[i].kappa = (raw[(i - 1 + M) % M] + 2 * raw[i] + raw[(i + 1) % M]) / 4;
  }

  get count(): number {
    return this.points.length;
  }

  /** Index of the line point nearest to (x, z), searching around `hint` when given. */
  nearest(x: number, z: number, hint = -1): number {
    const M = this.points.length;
    let best = 0;
    let bestD = Infinity;
    const from = hint >= 0 ? hint - 25 : 0;
    const to = hint >= 0 ? hint + 25 : M - 1;
    for (let k = from; k <= to; k++) {
      const i = ((k % M) + M) % M;
      const p = this.points[i];
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (hint >= 0 && bestD > 30 * 30) return this.nearest(x, z, -1);
    return best;
  }

  /** Maximum speed (m/s) along the line for this car. `grip` scales tire grip (wet track…). */
  speedProfile(cfg: CarPhysicsConfig, grip = 1): Float64Array {
    const M = this.points.length;
    const m = cfg.mass;
    const muLat = Math.min(cfg.tires.front.mu, cfg.tires.rear.mu) * grip * 0.93;
    const muLong = muLat * Math.min(cfg.tires.front.muLongScale, cfg.tires.rear.muLongScale);
    const clA = cfg.aero.clAFront + cfg.aero.clARear;
    const q = 0.5 * AIR_DENSITY;
    // Peak wheel power and the speed where drag absorbs it (or the limiter).
    let peakP = 0;
    for (const [rpm] of cfg.engine.torqueCurve) peakP = Math.max(peakP, interpTable(cfg.engine.torqueCurve, rpm) * rpm * RPM_TO_RADS);
    const pWheel = peakP * cfg.gearbox.efficiency;
    let vTop = 20;
    while (vTop < 120 && pWheel / vTop > q * cfg.aero.cdA * vTop * vTop + 0.012 * m * G) vTop += 0.25;
    if (cfg.engine.speedLimiterKmh) vTop = Math.min(vTop, cfg.engine.speedLimiterKmh / 3.6);
    const v = new Float64Array(M);
    for (let i = 0; i < M; i++) {
      const k = Math.abs(this.points[i].kappa);
      const den = k - (muLat * q * clA) / m;
      v[i] = den > 1e-6 ? Math.min(vTop, Math.sqrt((muLat * G) / den)) : vTop;
    }
    const latUse = (i: number, sp: number) => {
      const aMax = muLat * (G + (q * clA * sp * sp) / m);
      const aLat = sp * sp * Math.abs(this.points[i].kappa);
      return Math.sqrt(Math.max(0, 1 - Math.min(1, (aLat / aMax) ** 2)));
    };
    const ds = this.spacing;
    // Forward pass (acceleration), twice around so the lap wraps consistently.
    for (let pass = 0; pass < 2 * M; pass++) {
      const i = pass % M;
      const j = (i + 1) % M;
      const sp = Math.max(v[i], 1);
      const traction = muLong * (G + (q * clA * sp * sp) / m) * latUse(i, sp);
      const acc = Math.min(traction, pWheel / (m * sp)) - (q * cfg.aero.cdA * sp * sp) / m - G * this.points[i].grade - 0.15;
      v[j] = Math.min(v[j], Math.sqrt(Math.max(1, sp * sp + 2 * Math.max(acc, 0) * ds)));
    }
    // Backward pass (braking).
    for (let pass = 0; pass < 2 * M; pass++) {
      const j = (M - 1 - (pass % M) + M) % M;
      const i = (j - 1 + M) % M;
      const sp = v[j];
      const brake = muLong * 0.92 * (G + (q * clA * sp * sp) / m) * latUse(j, sp) + (q * cfg.aero.cdA * sp * sp) / m - G * this.points[j].grade;
      v[i] = Math.min(v[i], Math.sqrt(sp * sp + 2 * Math.max(brake, 2) * ds));
    }
    return v;
  }
}
