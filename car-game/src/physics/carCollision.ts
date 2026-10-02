import type { Vehicle } from './vehicle';

/**
 * Car ↔ car contact (SPEC §3 "Collisions … avec les autres voitures"): each car is an oriented
 * box in the ground plane. Corners of one box inside the other produce an impulse along the
 * axis of least penetration, with restitution and friction, applied to both cars.
 */

export interface CarBox {
  vehicle: Vehicle;
  /** Front / rear distance from the CG and half width (m). */
  front: number;
  rear: number;
  halfWidth: number;
}

const RESTITUTION = 0.2;
const FRICTION = 0.3;

function corners(b: CarBox): Array<[number, number]> {
  const v = b.vehicle;
  const pts: Array<[number, number]> = [];
  for (const f of [b.front, 0, -b.rear]) for (const l of [b.halfWidth, -b.halfWidth]) pts.push(v.bodyToWorld(f, l));
  return pts;
}

/** Resolve one pair; returns the closing speed of the impact (0 when not touching). */
export function collideCars(a: CarBox, b: CarBox): number {
  const va = a.vehicle;
  const vb = b.vehicle;
  const reach = Math.max(a.front, a.rear) + Math.max(b.front, b.rear) + 1;
  if ((va.x - vb.x) ** 2 + (va.z - vb.z) ** 2 > reach * reach) return 0;
  if (Math.abs(va.y - vb.y) > 3) return 0; // different levels (bridge over a road)
  let worst = 0;
  for (const [box, other] of [
    [b, a],
    [a, b],
  ] as const) {
    // Corners of `other` inside `box`.
    const v = box.vehicle;
    const sy = Math.sin(v.yaw);
    const cy = Math.cos(v.yaw);
    for (const [px, pz] of corners(other)) {
      const dx = px - v.x;
      const dz = pz - v.z;
      const f = dx * sy + dz * cy;
      const l = dx * cy - dz * sy;
      const penF = f >= 0 ? box.front - f : box.rear + f;
      const penL = box.halfWidth - Math.abs(l);
      if (penF <= 0 || penL <= 0) continue;
      // Normal pointing from `box` towards `other`, along the axis of least penetration.
      let nx: number;
      let nz: number;
      let pen: number;
      if (penL < penF) {
        const s = Math.sign(l) || 1;
        nx = cy * s;
        nz = -sy * s;
        pen = penL;
      } else {
        const s = Math.sign(f) || 1;
        nx = sy * s;
        nz = cy * s;
        pen = penF;
      }
      const vo = other.vehicle;
      // Separate the cars (half each).
      vo.x += nx * pen * 0.5;
      vo.z += nz * pen * 0.5;
      v.x -= nx * pen * 0.5;
      v.z -= nz * pen * 0.5;
      const [ax, az] = vo.pointVelocity(px, pz);
      const [bx, bz] = v.pointVelocity(px, pz);
      const vn = (ax - bx) * nx + (az - bz) * nz;
      if (vn >= 0) continue;
      const ra = [px - vo.x, pz - vo.z];
      const rb = [px - v.x, pz - v.z];
      const ca = ra[1] * nx - ra[0] * nz;
      const cb = rb[1] * nx - rb[0] * nz;
      const k = 1 / vo.cfg.mass + 1 / v.cfg.mass + (ca * ca) / vo.cfg.yawInertia + (cb * cb) / v.cfg.yawInertia;
      const j = (-(1 + RESTITUTION) * vn) / k;
      vo.applyImpulse(px, pz, j * nx, j * nz);
      v.applyImpulse(px, pz, -j * nx, -j * nz);
      // Friction along the contact.
      const tx = -nz;
      const tz = nx;
      const [ax2, az2] = vo.pointVelocity(px, pz);
      const [bx2, bz2] = v.pointVelocity(px, pz);
      const vt = (ax2 - bx2) * tx + (az2 - bz2) * tz;
      const jt = Math.max(-FRICTION * j, Math.min(FRICTION * j, -vt / k));
      vo.applyImpulse(px, pz, jt * tx, jt * tz);
      v.applyImpulse(px, pz, -jt * tx, -jt * tz);
      worst = Math.max(worst, -vn);
    }
  }
  return worst;
}
