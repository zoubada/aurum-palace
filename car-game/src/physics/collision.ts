import type { Vehicle } from './vehicle';

/**
 * Car ↔ static-wall collisions with impulse response (restitution + Coulomb friction).
 *
 * Phase 1: the test area is enclosed by straight barriers, described as half-planes.
 * Circuits (Phase 3+) will feed barrier segments from the track spline into Rapier;
 * this module keeps the same impulse maths for the car body.
 */

export interface Wall {
  /** Unit normal pointing into the drivable area (XZ). */
  nx: number;
  nz: number;
  /** Plane offset: a point P is inside when P·n ≥ d. */
  d: number;
}

export interface Impact {
  /** Closing speed along the wall normal (m/s). */
  speed: number;
  x: number;
  z: number;
}

const RESTITUTION = 0.25;
const FRICTION = 0.35;

/** Body-frame sample points around the car outline: [forward, left]. */
export function outlinePoints(front: number, rear: number, halfWidth: number): Array<[number, number]> {
  const hw = halfWidth;
  const r = -rear;
  return [
    [front, hw * 0.75],
    [front, -hw * 0.75],
    [front * 0.85, hw],
    [front * 0.85, -hw],
    [0, hw],
    [0, -hw],
    [r * 0.85, hw],
    [r * 0.85, -hw],
    [r, hw * 0.75],
    [r, -hw * 0.75],
  ];
}

export function collideWalls(vehicle: Vehicle, outline: Array<[number, number]>, walls: Wall[]): Impact | null {
  let worst: Impact | null = null;
  const m = vehicle.cfg.mass;
  const I = vehicle.cfg.yawInertia;
  for (const wall of walls) {
    // Deepest penetrating point against this wall.
    let depth = 0;
    let px = 0;
    let pz = 0;
    for (const [f, l] of outline) {
      const [x, z] = vehicle.bodyToWorld(f, l);
      const pen = wall.d - (x * wall.nx + z * wall.nz);
      if (pen > depth) {
        depth = pen;
        px = x;
        pz = z;
      }
    }
    if (depth <= 0) continue;

    // Positional correction: push the car out of the wall.
    vehicle.x += wall.nx * depth;
    vehicle.z += wall.nz * depth;
    px += wall.nx * depth;
    pz += wall.nz * depth;

    const [vpx, vpz] = vehicle.pointVelocity(px, pz);
    const vn = vpx * wall.nx + vpz * wall.nz;
    if (vn >= 0) continue; // already separating

    const rx = px - vehicle.x;
    const rz = pz - vehicle.z;
    const cn = rz * wall.nx - rx * wall.nz;
    const jn = (-(1 + RESTITUTION) * vn) / (1 / m + (cn * cn) / I);
    vehicle.applyImpulse(px, pz, jn * wall.nx, jn * wall.nz);

    // Friction along the wall.
    const tx = -wall.nz;
    const tz = wall.nx;
    const [vpx2, vpz2] = vehicle.pointVelocity(px, pz);
    const vt = vpx2 * tx + vpz2 * tz;
    const ct = rz * tx - rx * tz;
    let jt = -vt / (1 / m + (ct * ct) / I);
    const maxJt = FRICTION * jn;
    jt = Math.max(-maxJt, Math.min(maxJt, jt));
    vehicle.applyImpulse(px, pz, jt * tx, jt * tz);

    if (!worst || -vn > worst.speed) worst = { speed: -vn, x: px, z: pz };
  }
  return worst;
}

/** Four walls enclosing an axis-aligned rectangle. */
export function rectangleWalls(minX: number, maxX: number, minZ: number, maxZ: number): Wall[] {
  return [
    { nx: 1, nz: 0, d: minX },
    { nx: -1, nz: 0, d: -maxX },
    { nx: 0, nz: 1, d: minZ },
    { nx: 0, nz: -1, d: -maxZ },
  ];
}
