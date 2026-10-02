import * as THREE from 'three';

/**
 * Circuit centreline (SPEC §5 "Piste splinée"): a closed Catmull-Rom spline through control
 * points carrying width, run-off, elevation, banking and zone type. Sampled every `ds` metres
 * into frames used by the road mesh, the physics (ground height/normal, barriers), the timing
 * and the AI racing line. Pure maths (Three.js vectors only), so it runs in the unit tests.
 */

export type Zone = 'street' | 'bridge' | 'tunnel' | 'viaduct';

export interface ControlPoint {
  x: number;
  z: number;
  /** Elevation (m). */
  y?: number;
  /** Road half-width (m). */
  w?: number;
  /** Run-off between the road edge and the barrier, each side (m). */
  runoff?: number;
  /** Banking (deg), + = left side higher (for right-hand corners). */
  bank?: number;
  zone?: Zone;
}

export interface TrackSample {
  /** Distance from the start line (m). */
  s: number;
  p: THREE.Vector3;
  /** Unit tangent (3D, follows the slope). */
  t: THREE.Vector3;
  /** Unit lateral vector pointing left, banked. */
  left: THREE.Vector3;
  /** Surface normal. */
  up: THREE.Vector3;
  /** Heading (rad), same convention as the vehicle yaw: forward = (sin, cos). */
  heading: number;
  /** Road half-width (m). */
  hw: number;
  /** Barrier offsets from the centreline (m, both positive). */
  wallL: number;
  wallR: number;
  /** Bank angle (rad). */
  bank: number;
  /** Horizontal curvature (1/m, + = turning left). */
  kappa: number;
  /** Vertical curvature d²y/ds² (1/m, + = sag/compression, − = crest). */
  yCurv: number;
  zone: Zone;
}

export interface TrackQuery {
  index: number;
  s: number;
  /** Lateral offset from the centreline along the road surface (m, + = left). */
  lateral: number;
  /** Surface height under the point (m). */
  height: number;
  sample: TrackSample;
}

const smooth = (f: number) => f * f * (3 - 2 * f);

export class TrackSpline {
  readonly samples: TrackSample[] = [];
  readonly length: number;
  readonly ds: number;
  readonly curve: THREE.CatmullRomCurve3;

  constructor(
    readonly points: ControlPoint[],
    ds = 1,
  ) {
    const n = points.length;
    this.curve = new THREE.CatmullRomCurve3(
      points.map((c) => new THREE.Vector3(c.x, c.y ?? 0, c.z)),
      true,
      'centripetal',
    );
    const total = this.curve.getLength();
    const N = Math.round(total / ds);
    this.ds = total / N;
    this.length = total;

    const attr = (t: number, get: (c: ControlPoint) => number) => {
      const x = t * n;
      const i = Math.floor(x) % n;
      const f = smooth(x - Math.floor(x));
      return get(points[i]) * (1 - f) + get(points[(i + 1) % n]) * f;
    };
    const zoneAt = (t: number): Zone => {
      // A zone covers the segment starting at a control point that declares it.
      const i = Math.floor(t * n) % n;
      return points[i].zone ?? 'street';
    };

    for (let k = 0; k < N; k++) {
      const u = k / N;
      const tt = this.curve.getUtoTmapping(u, 0);
      const p = this.curve.getPoint(tt);
      const t = this.curve.getTangent(tt).normalize();
      const hw = attr(tt, (c) => c.w ?? 6.5);
      const runoff = attr(tt, (c) => c.runoff ?? 2);
      const bank = THREE.MathUtils.degToRad(attr(tt, (c) => c.bank ?? 0));
      const flatLeft = new THREE.Vector3(t.z, 0, -t.x).normalize();
      const upFlat = new THREE.Vector3().crossVectors(t, flatLeft).normalize();
      const left = flatLeft.clone().multiplyScalar(Math.cos(bank)).addScaledVector(upFlat, Math.sin(bank)).normalize();
      const up = new THREE.Vector3().crossVectors(t, left).normalize();
      this.samples.push({
        s: k * this.ds,
        p,
        t,
        left,
        up,
        heading: Math.atan2(t.x, t.z),
        hw,
        wallL: hw + runoff,
        wallR: hw + runoff,
        bank,
        kappa: 0,
        yCurv: 0,
        zone: zoneAt(tt),
      });
    }
    // Curvatures from neighbouring samples.
    for (let k = 0; k < N; k++) {
      const a = this.samples[(k - 1 + N) % N];
      const b = this.samples[k];
      const c = this.samples[(k + 1) % N];
      let dh = c.heading - a.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      b.kappa = dh / (2 * this.ds);
      b.yCurv = (c.p.y - 2 * b.p.y + a.p.y) / (this.ds * this.ds);
    }
  }

  get count(): number {
    return this.samples.length;
  }

  sample(i: number): TrackSample {
    const n = this.samples.length;
    return this.samples[((i % n) + n) % n];
  }

  /** Index of the sample at distance s (wraps). */
  indexAt(s: number): number {
    const n = this.samples.length;
    return ((Math.round(s / this.ds) % n) + n) % n;
  }

  /**
   * Locate a point relative to the track. `hint` (previous index) keeps the search local and
   * fast, and picks the right level where the circuit passes over or under itself.
   */
  project(x: number, z: number, hint = -1): TrackQuery {
    const n = this.samples.length;
    let best = -1;
    let bestD = Infinity;
    const scan = (from: number, to: number, step: number) => {
      for (let k = from; k <= to; k += step) {
        const i = ((k % n) + n) % n;
        const p = this.samples[i].p;
        const d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    };
    if (hint >= 0) scan(hint - 60, hint + 60, 1);
    if (hint < 0 || bestD > 40 * 40) {
      bestD = Infinity;
      scan(0, n - 1, 4);
      scan(best - 4, best + 4, 1);
    }
    // Refine on the segment towards the closer neighbour.
    const s0 = this.samples[best];
    const prev = this.samples[(best - 1 + n) % n];
    const next = this.samples[(best + 1) % n];
    const dNext = (next.p.x - x) ** 2 + (next.p.z - z) ** 2;
    const dPrev = (prev.p.x - x) ** 2 + (prev.p.z - z) ** 2;
    const a = dNext < dPrev ? s0 : prev;
    const b = dNext < dPrev ? next : s0;
    const ex = b.p.x - a.p.x;
    const ez = b.p.z - a.p.z;
    const f = THREE.MathUtils.clamp(((x - a.p.x) * ex + (z - a.p.z) * ez) / (ex * ex + ez * ez || 1), 0, 1);
    const cx = a.p.x + ex * f;
    const cz = a.p.z + ez * f;
    const cy = a.p.y + (b.p.y - a.p.y) * f;
    // Horizontal lateral offset, then height on the banked surface.
    const lx = a.left.x + (b.left.x - a.left.x) * f;
    const lz = a.left.z + (b.left.z - a.left.z) * f;
    const lh = Math.hypot(lx, lz) || 1;
    const dh = ((x - cx) * lx + (z - cz) * lz) / lh;
    const bank = a.bank + (b.bank - a.bank) * f;
    const height = cy + dh * Math.tan(bank);
    const s = a.s + this.ds * f;
    return { index: best, s: (s + this.length) % this.length, lateral: dh / Math.cos(bank), height, sample: s0 };
  }

  /** Position on the surface at distance s and lateral offset d (m, + = left). */
  pointAt(s: number, d: number, out = new THREE.Vector3()): THREE.Vector3 {
    const n = this.samples.length;
    const x = ((s / this.ds) % n + n) % n;
    const i = Math.floor(x);
    const f = x - i;
    const a = this.samples[i];
    const b = this.samples[(i + 1) % n];
    out.lerpVectors(a.p, b.p, f);
    const lx = a.left.x + (b.left.x - a.left.x) * f;
    const ly = a.left.y + (b.left.y - a.left.y) * f;
    const lz = a.left.z + (b.left.z - a.left.z) * f;
    return out.set(out.x + lx * d, out.y + ly * d, out.z + lz * d);
  }
}
