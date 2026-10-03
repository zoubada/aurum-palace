import * as THREE from 'three';
import type { TileData } from './data';

/**
 * Ground features of the Annecy circuit near the route, from OpenStreetMap
 * (tools/annecy/features.mjs): lawns and parks (the Pâquier with its mown stripes), football
 * pitches with their markings and goals, tennis and multi-sport courts, beaches, car parks with
 * their bays, paved squares, canals, swimming pools, flower beds; footpaths; and the wooden
 * pontoons on the lake. Everything hugs the terrain and is drawn by one material whose shader
 * paints each kind (one draw call per tile).
 */

const TILE = 1000;
/** Area kinds (tools/annecy/features.mjs) and the extra kinds drawn here. */
const K = { GRASS: 1, SOCCER: 2, PITCH: 3, SAND: 4, PARKING: 5, PLAZA: 6, WATER: 7, POOL: 8, FLOWERS: 9, CLAY: 10, GRAVEL: 11, PAVED: 12, WOOD: 13, WHITE: 14 };
/** Height above the terrain by kind: later kinds on top (a pitch inside a park). */
const LIFT: Record<number, number> = { 1: 0.1, 9: 0.12, 5: 0.13, 6: 0.13, 4: 0.14, 7: 0.15, 11: 0.16, 12: 0.16, 3: 0.18, 10: 0.18, 2: 0.19, 8: 0.2 };
/** Longest triangle edge on the ground (the terrain grid is 4 m; the overlay floats a little above it). */
const MAX_EDGE = 7;

let mat: THREE.MeshStandardMaterial | null = null;

function landscapeMaterial(): THREE.MeshStandardMaterial {
  if (mat) return mat;
  const m = new THREE.MeshStandardMaterial({ vertexColors: false, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 akind;\nattribute vec2 auv;\nvarying vec4 vKind;\nvarying vec2 vUv2;\nvarying vec2 vWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvKind = akind;\nvUv2 = auv;\nvWorld = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec4 vKind;
        varying vec2 vUv2;
        varying vec2 vWorld;
        float lHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float lNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(lHash(i), lHash(i + vec2(1, 0)), f.x), mix(lHash(i + vec2(0, 1)), lHash(i + vec2(1, 1)), f.x), f.y);
        }
        // Line of half-width w at distance d (anti-aliased).
        float lLine(float d, float w) { float a = fwidth(d) + 0.01; return 1.0 - smoothstep(w - a, w + a, abs(d)); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float kind = floor(vKind.x + 0.5);
        float hl = vKind.y;
        float hw = vKind.z;
        vec2 uv = vUv2;
        vec2 w = vWorld;
        float n1 = lNoise(w * 0.35);
        float n2 = lNoise(w * 2.3);
        float rough = 0.92;
        vec3 c = vec3(0.3);
        vec3 grass = vec3(0.2, 0.36, 0.11) * (0.82 + 0.25 * n1 + 0.1 * n2);
        if (kind < 1.5) {
          // Lawn: mown stripes 6 m wide along the area's long axis.
          c = grass * (0.93 + 0.1 * step(0.5, fract(uv.y / 12.0)));
        } else if (kind < 2.5) {
          // Football pitch: stripes, lines 12 cm, centre circle 9.15 m, boxes, spots.
          c = vec3(0.16, 0.38, 0.12) * (0.9 + 0.12 * step(0.5, fract(uv.x / 11.0))) * (0.95 + 0.08 * n2);
          float L = hl - 1.0;
          float W = hw - 1.0;
          vec2 a = abs(uv);
          float line = 0.0;
          if (a.x < L + 0.06 && a.y < W + 0.06) {
            line = max(line, lLine(a.x - L, 0.06) * step(a.y, W));
            line = max(line, lLine(a.y - W, 0.06) * step(a.x, L));
            line = max(line, lLine(uv.x, 0.06) * step(a.y, W));
            line = max(line, lLine(length(uv) - 9.15, 0.06));
            float pb = min(16.5, L * 0.35);
            float pw = min(20.16, W * 0.6);
            line = max(line, lLine(a.x - (L - pb), 0.06) * step(a.y, pw));
            line = max(line, lLine(a.y - pw, 0.06) * step(L - pb, a.x));
            float gb = min(5.5, L * 0.12);
            float gw = min(9.16, W * 0.3);
            line = max(line, lLine(a.x - (L - gb), 0.06) * step(a.y, gw));
            line = max(line, lLine(a.y - gw, 0.06) * step(L - gb, a.x));
            float spot = L - min(11.0, L * 0.22);
            line = max(line, step(length(vec2(a.x - spot, uv.y)), 0.15) + step(length(uv), 0.15));
            line = max(line, lLine(length(vec2(a.x - spot, uv.y)) - 9.15, 0.06) * step(a.x, L - pb));
          }
          c = mix(c, vec3(0.92), clamp(line, 0.0, 1.0));
        } else if (kind < 3.5 || (kind > 9.5 && kind < 10.5)) {
          // Courts: tennis lines when the size fits, else a border and a centre line.
          bool clay = kind > 9.5;
          c = clay ? vec3(0.62, 0.3, 0.17) * (0.9 + 0.15 * n2) : vec3(0.18, 0.36, 0.42) * (0.92 + 0.1 * n2);
          vec2 a = abs(uv);
          float line = 0.0;
          if (hl > 13.0 && hl < 22.0 && hw > 6.0 && hw < 13.0) {
            float L = 11.885;
            line = max(line, lLine(a.x - L, 0.025) * step(a.y, 5.485));
            line = max(line, lLine(a.y - 5.485, 0.025) * step(a.x, L));
            line = max(line, lLine(a.y - 4.115, 0.025) * step(a.x, L));
            line = max(line, lLine(a.x - 6.4, 0.025) * step(a.y, 4.115));
            line = max(line, lLine(uv.y, 0.025) * step(a.x, 6.4));
            c = mix(c, vec3(0.08), lLine(uv.x, 0.04) * step(a.y, 6.4));
          } else {
            line = max(lLine(a.x - (hl - 0.8), 0.04) * step(a.y, hw - 0.8), lLine(a.y - (hw - 0.8), 0.04) * step(a.x, hl - 0.8));
            line = max(line, lLine(uv.x, 0.04) * step(a.y, hw - 0.8));
          }
          c = mix(c, vec3(0.93), line);
          rough = 0.75;
        } else if (kind < 4.5) {
          c = vec3(0.78, 0.7, 0.55) * (0.88 + 0.12 * n1 + 0.08 * n2);
        } else if (kind < 5.5) {
          // Car park: asphalt, bays 2.5 m along the two outer rows.
          c = vec3(0.24, 0.24, 0.25) * (0.9 + 0.12 * n2);
          float row = step(hw - 5.0, abs(uv.y)) * step(abs(uv.y), hw - 0.3) * step(abs(uv.x), hl - 0.5);
          c = mix(c, vec3(0.85), lLine(fract(uv.x / 2.5 + 0.5) - 0.5, 0.025) * row);
          c = mix(c, vec3(0.85), lLine(abs(uv.y) - (hw - 5.0), 0.06) * step(abs(uv.x), hl - 0.5) * step(5.0, hw * 2.0 - 10.0));
          rough = 0.85;
        } else if (kind < 6.5) {
          // Square: granite setts (Annecy's old town and lakeside).
          vec2 s = w / vec2(0.6, 0.3);
          s.x += step(0.5, fract(s.y * 0.5)) * 0.5;
          vec2 f = fract(s);
          float joint = max(lLine(f.x, 0.04), lLine(f.y, 0.08));
          c = vec3(0.6, 0.58, 0.54) * (0.85 + 0.2 * lHash(floor(s))) * (1.0 - joint * 0.35);
        } else if (kind < 7.5) {
          // Canal / river: deep green water.
          c = vec3(0.06, 0.16, 0.15) * (0.9 + 0.15 * n1);
          rough = 0.08;
        } else if (kind < 8.5) {
          // Swimming pool: turquoise, white coping, lane lines.
          vec2 a = abs(uv);
          float edge = step(hl - 0.5, a.x) + step(hw - 0.5, a.y);
          c = mix(vec3(0.15, 0.62, 0.72) * (0.9 + 0.1 * n2), vec3(0.88, 0.87, 0.83), clamp(edge, 0.0, 1.0));
          c = mix(c, vec3(0.05, 0.2, 0.45), lLine(fract(uv.y / 2.5 + 0.5) - 0.5, 0.04) * step(a.x, hl - 1.5) * (1.0 - edge) * step(10.0, hl));
          rough = mix(0.06, 0.8, clamp(edge, 0.0, 1.0));
        } else if (kind < 9.5) {
          // Flower bed.
          float h = lHash(floor(w * 2.0));
          c = h < 0.3 ? vec3(0.7, 0.12, 0.15) : h < 0.5 ? vec3(0.85, 0.7, 0.15) : h < 0.65 ? vec3(0.6, 0.3, 0.6) : grass * 0.8;
        } else if (kind < 11.5) {
          c = vec3(0.7, 0.64, 0.52) * (0.85 + 0.15 * n2);
        } else if (kind < 12.5) {
          c = vec3(0.55, 0.54, 0.51) * (0.9 + 0.1 * n2);
        } else if (kind < 13.5) {
          // Wooden deck: planks across, 15 cm, weathered.
          float p = uv.x / 0.15;
          float plank = floor(p);
          c = vec3(0.45, 0.33, 0.22) * (0.75 + 0.35 * lHash(vec2(plank, 3.0))) * (1.0 - 0.4 * (1.0 - smoothstep(0.0, 0.1, fract(p))));
          rough = 0.8;
        } else {
          c = vec3(0.93);
          rough = 0.6;
        }
        diffuseColor.rgb = c;`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = rough;');
  };
  mat = m;
  return m;
}

interface Geo {
  pos: number[];
  kind: number[];
  uv: number[];
}

/** Minimum-area rectangle of a polygon (x, z): centre, half extents, long axis. */
function minRect(pts: Array<[number, number]>): { cx: number; cz: number; hl: number; hw: number; ux: number; uz: number } {
  let best = { area: Infinity, cx: 0, cz: 0, hl: 1, hw: 1, ux: 1, uz: 0 };
  for (let k = 0; k < pts.length; k++) {
    const [ax, az] = pts[k];
    const [bx, bz] = pts[(k + 1) % pts.length];
    const l = Math.hypot(bx - ax, bz - az);
    if (l < 1e-6) continue;
    const ux = (bx - ax) / l;
    const uz = (bz - az) / l;
    let u0 = Infinity;
    let u1 = -Infinity;
    let v0 = Infinity;
    let v1 = -Infinity;
    for (const [x, z] of pts) {
      const u = x * ux + z * uz;
      const v = -x * uz + z * ux;
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (area < best.area) {
      const uc = (u0 + u1) / 2;
      const vc = (v0 + v1) / 2;
      best = { area, cx: uc * ux - vc * uz, cz: uc * uz + vc * ux, hl: (u1 - u0) / 2, hw: (v1 - v0) / 2, ux, uz };
    }
  }
  if (best.hw > best.hl) best = { ...best, hl: best.hw, hw: best.hl, ux: -best.uz, uz: best.ux };
  return best;
}

/** Ground triangle split until its edges are short, so it follows the terrain. */
function groundTri(g: Geo, a: number[], b: number[], c: number[], emit: (p: number[]) => void): void {
  const d = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const ab = d(a, b);
  const bc = d(b, c);
  const ca = d(c, a);
  const m = Math.max(ab, bc, ca);
  if (m <= MAX_EDGE) {
    // Up-facing (counter-clockwise seen from above with x east, z south → clockwise in x/z).
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (cross > 0) {
      emit(a);
      emit(c);
      emit(b);
    } else {
      emit(a);
      emit(b);
      emit(c);
    }
    return;
  }
  const mid = (p: number[], q: number[]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  if (m === ab) {
    const p = mid(a, b);
    groundTri(g, a, p, c, emit);
    groundTri(g, p, b, c, emit);
  } else if (m === bc) {
    const p = mid(b, c);
    groundTri(g, a, b, p, emit);
    groundTri(g, a, p, c, emit);
  } else {
    const p = mid(c, a);
    groundTri(g, a, b, p, emit);
    groundTri(g, p, b, c, emit);
  }
}

/** Quad (two triangles), any orientation (the material is double-sided). */
function quad(g: Geo, p: number[][], kind: number, uv: number[][]): void {
  for (const [i, j, k] of [
    [0, 1, 2],
    [0, 2, 3],
  ]) {
    for (const q of [i, j, k]) {
      g.pos.push(...p[q]);
      g.kind.push(kind, 0, 0, 0);
      g.uv.push(...uv[q]);
    }
  }
}

/** Box from a centre, an axis (unit x/z), half sizes along / across / height. */
function box(g: Geo, cx: number, y0: number, cz: number, ux: number, uz: number, hl: number, hw: number, h: number, kind: number): void {
  const vx = -uz;
  const vz = ux;
  const P = (a: number, b: number, y: number) => [cx + ux * a + vx * b, y, cz + uz * a + vz * b];
  const y1 = y0 + h;
  const c = [
    [-hl, -hw],
    [hl, -hw],
    [hl, hw],
    [-hl, hw],
  ];
  const z = [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ];
  for (let k = 0; k < 4; k++) {
    const [a0, b0] = c[k];
    const [a1, b1] = c[(k + 1) % 4];
    quad(g, [P(a0, b0, y0), P(a0, b0, y1), P(a1, b1, y1), P(a1, b1, y0)], kind, z);
  }
  quad(g, [P(-hl, -hw, y1), P(-hl, hw, y1), P(hl, hw, y1), P(hl, -hw, y1)], kind, z);
}

export function buildLandscape(t: TileData, x0: number, z0: number, heightAt: (x: number, z: number) => number): THREE.Object3D[] {
  const g: Geo = { pos: [], kind: [], uv: [] };
  const toGame = (vx: number, vy: number): [number, number] => [x0 + vx / 10, z0 + TILE - vy / 10];

  // ---- Areas, in draw order (the lift sorts them vertically).
  const A = t.areas;
  let v = 0;
  for (let k = 0; k < A.kind.length; k++) {
    const n = A.count[k];
    const kind = A.kind[k];
    const pts: Array<[number, number]> = [];
    for (let q = 0; q < n; q++) pts.push(toGame(A.verts[(v + q) * 2], A.verts[(v + q) * 2 + 1]));
    v += n;
    if (n < 3) continue;
    const r = minRect(pts);
    const lift = LIFT[kind] ?? 0.12;
    const local = (x: number, z: number) => {
      const dx = x - r.cx;
      const dz = z - r.cz;
      return [dx * r.ux + dz * r.uz, -dx * r.uz + dz * r.ux];
    };
    const emit = (p: number[]) => {
      g.pos.push(p[0], heightAt(p[0], p[1]) + lift, p[1]);
      g.kind.push(kind, r.hl, r.hw, 0);
      g.uv.push(...local(p[0], p[1]));
    };
    let tris: number[][];
    try {
      tris = THREE.ShapeUtils.triangulateShape(
        pts.map(([x, z]) => new THREE.Vector2(x, z)),
        [],
      );
    } catch {
      continue;
    }
    for (const [a, b, c] of tris) groundTri(g, pts[a], pts[b], pts[c], emit);
    // Goals on football pitches (7.32 × 2.44 m, white posts and bar).
    if (kind === K.SOCCER && r.hl > 15) {
      const L = r.hl - 1;
      const gw = Math.min(3.66, r.hw * 0.12);
      for (const s of [-1, 1]) {
        const gx = r.cx + r.ux * s * L;
        const gz = r.cz + r.uz * s * L;
        const y = heightAt(gx, gz) + LIFT[K.SOCCER];
        const vx = -r.uz;
        const vz = r.ux;
        for (const side of [-1, 1]) box(g, gx + vx * side * gw, y, gz + vz * side * gw, r.ux, r.uz, 0.06, 0.06, 2.44, K.WHITE);
        box(g, gx, y + 2.38, gz, vx, vz, gw + 0.06, 0.06, 0.12, K.WHITE);
      }
    }
  }

  // ---- Footpaths: gravel strips, paved when wide.
  const Pa = t.paths;
  v = 0;
  for (let k = 0; k < Pa.count.length; k++) {
    const n = Pa.count[k];
    const width = Pa.width[k] / 10;
    const kind = width >= 4 ? K.PAVED : K.GRAVEL;
    const pts: Array<[number, number]> = [];
    for (let q = 0; q < n; q++) pts.push(toGame(Pa.verts[(v + q) * 2], Pa.verts[(v + q) * 2 + 1]));
    v += n;
    strip(g, pts, width / 2, kind, (x, z) => heightAt(x, z) + LIFT[kind]);
  }

  // ---- Pontoons and piers: wooden decks on posts over the lake.
  const Pi = t.piers;
  v = 0;
  for (let k = 0; k < Pi.count.length; k++) {
    const n = Pi.count[k];
    const isArea = Pi.info[k * 2] === 1;
    const width = Math.max(1.5, Pi.info[k * 2 + 1] / 10);
    const pts: Array<[number, number]> = [];
    for (let q = 0; q < n; q++) pts.push(toGame(Pi.verts[(v + q) * 2], Pi.verts[(v + q) * 2 + 1]));
    v += n;
    const deckY = (x: number, z: number) => Math.max(0.7, heightAt(x, z) + 0.3);
    if (isArea && n >= 3) {
      let tris: number[][];
      try {
        tris = THREE.ShapeUtils.triangulateShape(
          pts.map(([x, z]) => new THREE.Vector2(x, z)),
          [],
        );
      } catch {
        continue;
      }
      const r = minRect(pts);
      const emit = (p: number[]) => {
        g.pos.push(p[0], deckY(p[0], p[1]), p[1]);
        g.kind.push(K.WOOD, 0, 0, 0);
        g.uv.push((p[0] - r.cx) * r.ux + (p[1] - r.cz) * r.uz, 0);
      };
      for (const [a, b, c] of tris) groundTri(g, pts[a], pts[b], pts[c], emit);
      // Fascia and posts round the edge.
      for (let q = 0; q < n; q++) {
        const [ax, az] = pts[q];
        const [bx, bz] = pts[(q + 1) % n];
        const ya = deckY(ax, az);
        const yb = deckY(bx, bz);
        quad(g, [[ax, ya, az], [bx, yb, bz], [bx, yb - 0.3, bz], [ax, ya - 0.3, az]], K.WOOD, [[0, 0], [1, 0], [1, 0], [0, 0]]);
        posts(g, [ax, az], [bx, bz], deckY);
      }
    } else if (n >= 2) {
      strip(g, pts, width / 2, K.WOOD, deckY, true);
      for (let q = 0; q + 1 < n; q++) {
        const [ax, az] = pts[q];
        const [bx, bz] = pts[q + 1];
        const l = Math.hypot(bx - ax, bz - az) || 1;
        const ox = (-(bz - az) / l) * (width / 2 - 0.15);
        const oz = ((bx - ax) / l) * (width / 2 - 0.15);
        posts(g, [ax + ox, az + oz], [bx + ox, bz + oz], deckY);
        posts(g, [ax - ox, az - oz], [bx - ox, bz - oz], deckY);
      }
    }
  }

  if (!g.pos.length) return [];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
  geo.setAttribute('akind', new THREE.Float32BufferAttribute(g.kind, 4));
  geo.setAttribute('auv', new THREE.Float32BufferAttribute(g.uv, 2));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, landscapeMaterial());
  mesh.receiveShadow = true;
  mesh.name = 'landscape';
  return [mesh];
}

/** Posts every 3 m under a deck edge, down into the water. */
function posts(g: Geo, a: [number, number], b: [number, number], deckY: (x: number, z: number) => number): void {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / (l || 1);
  const uz = (b[1] - a[1]) / (l || 1);
  for (let d = 0; d <= l; d += 3) {
    const x = a[0] + ux * d;
    const z = a[1] + uz * d;
    const top = deckY(x, z) - 0.3;
    box(g, x, -2.5, z, ux, uz, 0.1, 0.1, top + 2.5, K.WOOD);
  }
}

/** Flat strip along a polyline (half-width hw), with optional side faces (decks). */
function strip(g: Geo, pts: Array<[number, number]>, hw: number, kind: number, y: (x: number, z: number) => number, sides = false): void {
  // Densify to follow the ground.
  const dense: Array<[number, number]> = [];
  for (let q = 0; q + 1 < pts.length; q++) {
    const [ax, az] = pts[q];
    const [bx, bz] = pts[q + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / MAX_EDGE));
    for (let s = 0; s < steps; s++) dense.push([ax + ((bx - ax) * s) / steps, az + ((bz - az) * s) / steps]);
  }
  dense.push(pts[pts.length - 1]);
  if (dense.length < 2) return;
  let along = 0;
  let prev: number[][] | null = null;
  let prevAlong = 0;
  for (let q = 0; q < dense.length; q++) {
    const [x, z] = dense[q];
    const [px, pz] = dense[Math.max(0, q - 1)];
    const [nx, nz] = dense[Math.min(dense.length - 1, q + 1)];
    const tx = nx - px;
    const tz = nz - pz;
    const l = Math.hypot(tx, tz) || 1;
    const ox = (-tz / l) * hw;
    const oz = (tx / l) * hw;
    if (q > 0) along += Math.hypot(x - dense[q - 1][0], z - dense[q - 1][1]);
    const L = [x + ox, y(x + ox, z + oz), z + oz];
    const R = [x - ox, y(x - ox, z - oz), z - oz];
    if (sides) {
      // Keep the deck level across.
      const m = Math.max(L[1], R[1]);
      L[1] = m;
      R[1] = m;
    }
    if (prev) {
      const [pL, pR] = prev;
      // Up-facing: order by the cross product.
      const cross = (L[0] - pL[0]) * (pR[2] - pL[2]) - (L[2] - pL[2]) * (pR[0] - pL[0]);
      const a = cross < 0 ? [pL, L, R, pR] : [pL, pR, R, L];
      const ua = cross < 0 ? [[prevAlong, -hw], [along, -hw], [along, hw], [prevAlong, hw]] : [[prevAlong, -hw], [prevAlong, hw], [along, hw], [along, -hw]];
      quad(g, a, kind, ua);
      if (sides) {
        for (const [p0, p1] of [
          [pL, L],
          [R, pR],
        ]) {
          quad(g, [p0, p1, [p1[0], p1[1] - 0.3, p1[2]], [p0[0], p0[1] - 0.3, p0[2]]], kind, [[0, 0], [0, 0], [0, 0], [0, 0]]);
        }
      }
    }
    prev = [L, R];
    prevAlong = along;
  }
}
