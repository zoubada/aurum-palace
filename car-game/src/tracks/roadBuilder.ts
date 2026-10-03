import * as THREE from 'three';
import type { TrackSample, TrackSpline } from './TrackSpline';

/**
 * Geometry generated from a circuit spline (reusable by every circuit): road surface, lines,
 * kerbs, start/finish, walls with sponsor panels and catch fences, sidewalks, decks under
 * bridges and viaducts, tunnel shell and portals, open-cut retaining walls. Also returns the
 * positions of street lamps and tunnel lights for the lighting system.
 */

export interface RoadMaterials {
  road: THREE.Material;
  line: THREE.Material;
  kerb: THREE.Material;
  chequer: THREE.Material;
  wall: THREE.Material;
  sponsor: THREE.Material;
  fence: THREE.Material;
  sidewalk: THREE.Material;
  deck: THREE.Material;
  tunnel: THREE.Material;
  tunnelLight: THREE.Material;
  rail: THREE.Material;
}

export interface Lamp {
  /** Light head position. */
  head: THREE.Vector3;
  base: THREE.Vector3;
  /** Direction from the pole towards the road (horizontal unit vector). */
  toRoad: THREE.Vector3;
  s: number;
}

export interface RoadBuild {
  group: THREE.Group;
  lamps: Lamp[];
  tunnelLights: THREE.Vector3[];
  /** Ground holes for open cuts (each a quad in XZ). */
  groundHoles: Array<Array<[number, number]>>;
}

export type Fn = (smp: TrackSample) => number;

/** Index ranges [from, to] (inclusive, `to` may exceed count to wrap) where `pred` holds. */
export function ranges(track: TrackSpline, pred: (smp: TrackSample) => boolean): Array<[number, number]> {
  const n = track.count;
  const out: Array<[number, number]> = [];
  // Start the scan at a sample where pred is false so ranges never straddle the seam.
  let start = 0;
  while (start < n && pred(track.samples[start])) start++;
  if (start === n) return [[0, n]];
  let from = -1;
  for (let k = 0; k <= n; k++) {
    const i = start + k;
    const on = k < n && pred(track.sample(i));
    if (on && from < 0) from = i;
    if (!on && from >= 0) {
      out.push([from, i]); // include the first "off" sample so pieces join neighbours
      from = -1;
    }
  }
  return out;
}

const tmp = new THREE.Vector3();

/** Strip between lateral offsets a and b (m, + = left), at heights ya / yb above the road. */
export function ribbon(
  track: TrackSpline,
  from: number,
  to: number,
  step: number,
  a: Fn,
  b: Fn,
  ya: Fn = () => 0,
  yb: Fn = () => 0,
  uScale = 1,
  vScale = 1,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let k = 0;
  for (let i = from; ; i += step) {
    const last = i >= to;
    const smp = track.sample(last ? to : i);
    const s = (last ? to : i) * track.ds;
    for (const [off, y] of [
      [a(smp), ya(smp)],
      [b(smp), yb(smp)],
    ]) {
      tmp.copy(smp.p).addScaledVector(smp.left, off);
      tmp.y += y;
      pos.push(tmp.x, tmp.y, tmp.z);
      // u runs across the strip: lateral offset for flat strips, height for vertical ones.
      uv.push((off + y) / uScale, s / vScale);
    }
    if (k > 0) {
      const v = k * 2;
      idx.push(v - 2, v, v - 1, v - 1, v, v + 1);
    }
    k++;
    if (last) break;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function addMesh(group: THREE.Group, geos: THREE.BufferGeometry[], mat: THREE.Material, shadows = true): void {
  for (const g of geos) {
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    m.castShadow = shadows;
    group.add(m);
  }
}

export function buildRoad(track: TrackSpline, mats: RoadMaterials): RoadBuild {
  const group = new THREE.Group();
  group.name = 'road';
  const n = track.count;
  const STEP = 2;
  const lamps: Lamp[] = [];
  const tunnelLights: THREE.Vector3[] = [];
  const groundHoles: Array<Array<[number, number]>> = [];
  const isTunnel = (s: TrackSample) => s.zone === 'tunnel';
  const elevated = (s: TrackSample) => s.p.y > 1.2;
  const atGround = (s: TrackSample) => !isTunnel(s) && !elevated(s) && s.p.y > -0.3;

  // --- Road surface (whole width between the barriers) and white edge lines.
  addMesh(group, [ribbon(track, 0, n, STEP, (s) => -s.wallR, (s) => s.wallL, undefined, undefined, 7, 7)], mats.road, false);
  for (const side of [1, -1]) {
    const g = ribbon(
      track,
      0,
      n,
      STEP,
      (s) => side * (s.hw - 0.35),
      (s) => side * (s.hw - 0.15),
      () => 0.012,
      () => 0.012,
    );
    addMesh(group, [g], mats.line, false);
  }

  // --- Kerbs on both sides of the corners.
  const corner = (s: TrackSample) => Math.abs(s.kappa) > 1 / 140 && !isTunnel(s);
  for (const [from, to] of ranges(track, corner)) {
    for (const side of [1, -1]) {
      const g = ribbon(
        track,
        from - 6,
        to + 6,
        1,
        (s) => side * (s.hw - 0.1),
        (s) => side * Math.min(s.hw + 0.9, s.wallL - 0.2),
        () => 0.02,
        () => 0.045,
        1,
        2.4,
      );
      addMesh(group, [g], mats.kerb, false);
    }
  }

  // --- Start/finish line and grid boxes.
  addMesh(group, [ribbon(track, n - 1, n + 1, 1, (s) => -s.hw, (s) => s.hw, () => 0.014, () => 0.014, 1.875, 1)], mats.chequer, false);
  for (let slot = 0; slot < 12; slot++) {
    const i = n - 8 - slot * 8;
    const side = slot % 2 ? -1 : 1;
    addMesh(group, [ribbon(track, i, i + 1, 1, () => side * 1.2, () => side * 4.2, () => 0.014, () => 0.014)], mats.line, false);
  }

  // --- Walls with sponsor panels and catch fences (streets), parapets with rails (bridges).
  for (const [from, to] of ranges(track, (s) => !isTunnel(s))) {
    for (const side of [1, -1]) {
      const w: Fn = (s) => side * (side > 0 ? s.wallL : s.wallR);
      const w2: Fn = (s) => w(s) + side * 0.45;
      addMesh(group, [ribbon(track, from, to, STEP, w, w, () => 0, () => 1.1, 1, 4), ribbon(track, from, to, STEP, w, w2, () => 1.1, () => 1.1), ribbon(track, from, to, STEP, w2, w2, () => 1.1, () => -1.2)], mats.wall);
    }
  }
  // Sponsor panels: one quad per 2 m, sponsor changes every 40 m.
  {
    const pos: number[] = [];
    const uv: number[] = [];
    const rows = 6;
    for (const side of [1, -1]) {
      for (let i = 0; i < n; i += STEP) {
        const a = track.sample(i);
        const b = track.sample(i + STEP);
        if (isTunnel(a) || isTunnel(b) || elevated(a)) continue;
        const row = Math.floor((i * track.ds) / 40) % rows;
        const off = (smp: TrackSample) => side * ((side > 0 ? smp.wallL : smp.wallR) - 0.02);
        const P = (smp: TrackSample, y: number) => tmp.copy(smp.p).addScaledVector(smp.left, off(smp)).setY(smp.p.y + y).toArray();
        const u0 = ((i * track.ds) % 8) / 8;
        const u1 = u0 + (STEP * track.ds) / 8;
        const v0 = 1 - (row + 1) / rows;
        const v1 = 1 - row / rows;
        const q = [P(a, 0.15), P(b, 0.15), P(b, 0.95), P(a, 0.15), P(b, 0.95), P(a, 0.95)];
        const quv = [
          [u0, v0],
          [u1, v0],
          [u1, v1],
          [u0, v0],
          [u1, v1],
          [u0, v1],
        ];
        // Face the road: flip the winding on the right-hand side.
        const order = side > 0 ? [0, 2, 1, 3, 5, 4] : [0, 1, 2, 3, 4, 5];
        for (const o of order) {
          pos.push(...q[o]);
          uv.push(...quv[o]);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    addMesh(group, [g], mats.sponsor, false);
  }
  // Catch fences on street walls; metal rails on bridge parapets.
  for (const [from, to] of ranges(track, (s) => atGround(s))) {
    for (const side of [1, -1]) {
      const w: Fn = (s) => side * ((side > 0 ? s.wallL : s.wallR) + 0.2);
      addMesh(group, [ribbon(track, from, to, STEP, w, w, () => 1.1, () => 3.6, 1, 3)], mats.fence, false);
    }
  }
  for (const [from, to] of ranges(track, elevated)) {
    for (const side of [1, -1]) {
      const w: Fn = (s) => side * ((side > 0 ? s.wallL : s.wallR) + 0.1);
      addMesh(group, [ribbon(track, from, to, STEP, w, w, () => 1.25, () => 1.4)], mats.rail, false);
    }
  }

  // --- Sidewalks along the streets.
  for (const [from, to] of ranges(track, atGround)) {
    for (const side of [1, -1]) {
      const a: Fn = (s) => side * ((side > 0 ? s.wallL : s.wallR) + 0.45);
      const b: Fn = (s) => side * ((side > 0 ? s.wallL : s.wallR) + 5);
      addMesh(group, [ribbon(track, from, to, STEP, a, b, () => 0.15, () => 0.15, 2, 2)], mats.sidewalk, false);
    }
  }

  // --- Decks under bridges and viaducts (slab underside and fascias).
  for (const [from, to] of ranges(track, elevated)) {
    const L: Fn = (s) => s.wallL + 0.5;
    const R: Fn = (s) => -(s.wallR + 0.5);
    addMesh(group, [
      ribbon(track, from, to, STEP, L, R, () => -1.4, () => -1.4),
      ribbon(track, from, to, STEP, L, L, () => -1.4, () => 0),
      ribbon(track, from, to, STEP, R, R, () => 0, () => -1.4),
    ], mats.deck);
  }

  // --- Tunnel: walls, ceiling, light strips; portals at both ends.
  const TUNNEL_H = 6.5;
  for (const [from, to] of ranges(track, isTunnel)) {
    const L: Fn = (s) => s.wallL;
    const R: Fn = (s) => -s.wallR;
    addMesh(group, [
      ribbon(track, from, to, STEP, L, L, () => TUNNEL_H, () => 0, 4, 4),
      ribbon(track, from, to, STEP, R, R, () => 0, () => TUNNEL_H, 4, 4),
      ribbon(track, from, to, STEP, R, L, () => TUNNEL_H, () => TUNNEL_H, 4, 4),
    ], mats.tunnel);
    for (let i = from; i < to; i += 6) {
      const smp = track.sample(i);
      for (const side of [1, -1]) {
        tunnelLights.push(smp.p.clone().addScaledVector(smp.left, side * ((side > 0 ? smp.wallL : smp.wallR) - 0.6)).setY(smp.p.y + TUNNEL_H - 0.25));
      }
    }
    for (const i of [from, to]) {
      const smp = track.sample(i);
      const w = smp.wallL + smp.wallR + 2;
      const portal = new THREE.Mesh(new THREE.BoxGeometry(w, 2.5, 1.2), mats.deck);
      portal.position.copy(smp.p).addScaledVector(smp.left, (smp.wallL - smp.wallR) / 2);
      portal.position.y += TUNNEL_H + 1.25;
      portal.rotation.y = smp.heading;
      portal.castShadow = portal.receiveShadow = true;
      group.add(portal);
    }
  }
  // Tunnel strip lights (one instanced mesh).
  {
    const geo = new THREE.BoxGeometry(0.3, 0.12, 4.5);
    const inst = new THREE.InstancedMesh(geo, mats.tunnelLight, tunnelLights.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    tunnelLights.forEach((p, k) => {
      const smp = track.project(p.x, p.z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), smp.sample.heading);
      inst.setMatrixAt(k, m.compose(p, q, new THREE.Vector3(1, 1, 1)));
    });
    group.add(inst);
  }
  // Open cuts before the portals: retaining walls up to ground level, and holes in the ground.
  for (const [from, to] of ranges(track, (s) => !isTunnel(s) && s.p.y < -0.25)) {
    for (const side of [1, -1]) {
      const w: Fn = (s) => side * ((side > 0 ? s.wallL : s.wallR) + 0.25);
      addMesh(group, [ribbon(track, from, to, STEP, w, w, () => 0, (s) => -s.p.y + 0.6, 4, 4)], mats.wall);
    }
    for (let i = from; i < to; i += 2) {
      const a = track.sample(i);
      const b = track.sample(i + 2);
      const pts: Array<[number, number]> = [];
      for (const [smp, off] of [
        [a, a.wallL + 0.3],
        [b, b.wallL + 0.3],
        [b, -b.wallR - 0.3],
        [a, -a.wallR - 0.3],
      ] as const) {
        pts.push([smp.p.x + smp.left.x * off, smp.p.z + smp.left.z * off]);
      }
      groundHoles.push(pts);
    }
  }

  // --- Street lamps every 32 m, alternating sides (not in the tunnel).
  for (let i = 0; i < n; i += 32) {
    const smp = track.sample(i);
    if (isTunnel(smp)) continue;
    const side = (i / 32) % 2 ? -1 : 1;
    const wall = side > 0 ? smp.wallL : smp.wallR;
    const flat = new THREE.Vector3(smp.left.x, 0, smp.left.z).normalize().multiplyScalar(side);
    const base = smp.p.clone().addScaledVector(flat, wall + (elevated(smp) ? 0.6 : 1.4));
    const head = base.clone().addScaledVector(flat, -3.2);
    head.y += 9;
    lamps.push({ head, base, toRoad: flat.clone().negate(), s: i * track.ds });
  }
  return { group, lamps, tunnelLights, groundHoles };
}
