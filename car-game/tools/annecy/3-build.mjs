/**
 * Step 3 — build the game data of the Annecy circuit from the real data (steps 0–2):
 *
 *  - track.json   : centreline control points (position, real altitude from RGE ALTI, width
 *                   from the OSM lanes, banking, bridges), sectors, sprint variants, the lake
 *                   outline (OSM), village signs (OSM city limits);
 *  - t/<i>_<j>.bin: one 1 km tile of terrain = ground heights every 4 m (RGE ALTI, carved
 *                   under the road, lake bed dug under the water, the IGN surface model beyond
 *                   ~200 m so distant forests and villages have volume), the trees within
 *                   200 m of the road (real positions and heights from the surface model, colour
 *                   from the photo) and the buildings within ~180 m (OSM footprints, real
 *                   heights from the surface model, roof colour from the photo);
 *  - t/<i>_<j>.webp: the tile's aerial photograph (BD ORTHO, ≈1 m/pixel);
 *  - far.bin / far.webp: the mountains around the lake (48 km, 120 m grid).
 *
 * Coordinates in the game: x = east, z = south, y = altitude above the lake (m), origin at
 * the start line. Lambert-93 is kept in meta for reference.
 *
 *   node tools/annecy/3-build.mjs
 */
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';
import { CACHE, LAKE_LEVEL, OUT, lonLatToL93 } from './common.mjs';
import { TrackSpline } from '../../src/tracks/TrackSpline.ts';

const TILE = 1000;
const STEP = 4;
const N = TILE / STEP + 1; // 251
const IGN = join(CACHE, 'ign');
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)} s]`, ...a);

const route = JSON.parse(readFileSync(join(CACHE, 'route.json'), 'utf8'));
const osm = JSON.parse(readFileSync(join(CACHE, 'osm.json'), 'utf8'));
const tiles = JSON.parse(readFileSync(join(IGN, 'tiles.json'), 'utf8'));
const far = JSON.parse(readFileSync(join(IGN, 'far.json'), 'utf8'));
const nodeLL = new Map(osm.nodes.map((n) => [n[0], n]));
const L93 = (id) => {
  const n = nodeLL.get(id);
  return lonLatToL93(n[1], n[2]);
};

// =============================================================================
// Global 4 m lattice over all near tiles (vertex at x0 + 4k, y0 + 4k).
// =============================================================================
const minI = Math.min(...tiles.map((t) => t[0]));
const maxI = Math.max(...tiles.map((t) => t[0]));
const minJ = Math.min(...tiles.map((t) => t[1]));
const maxJ = Math.max(...tiles.map((t) => t[1]));
const GX0 = minI * TILE;
const GY0 = minJ * TILE;
const GW = (maxI - minI + 1) * (N - 1) + 1;
const GH = (maxJ - minJ + 1) * (N - 1) + 1;
const gi = (X) => (X - GX0) / STEP;
const gj = (Y) => (Y - GY0) / STEP; // lattice row counted from the south
log(`grille ${GW} × ${GH} (${tiles.length} cases)`);

const dem = new Float32Array(GW * GH).fill(NaN);
const mns = new Float32Array(GW * GH).fill(NaN);
for (const [i, j] of tiles) {
  const d = new Float32Array(readFileSync(join(IGN, `${i}_${j}.dem.bil`)).buffer.slice(0));
  const m = new Float32Array(readFileSync(join(IGN, `${i}_${j}.mns.bil`)).buffer.slice(0));
  const ox = (i - minI) * (N - 1);
  const oy = (j - minJ) * (N - 1);
  for (let r = 0; r < N; r++) {
    const row = oy + (N - 1 - r); // BIL row 0 = north
    for (let c = 0; c < N; c++) {
      const k = row * GW + ox + c;
      const h = d[r * N + c];
      dem[k] = h > -100 && h < 5000 ? h - LAKE_LEVEL : NaN;
      const s = m[r * N + c];
      mns[k] = s > -100 && s < 5000 ? s - LAKE_LEVEL : dem[k];
    }
  }
}
// Fill rare holes (no data) from neighbours.
for (let pass = 0; pass < 4; pass++)
  for (let k = 0; k < dem.length; k++)
    if (Number.isNaN(dem[k])) {
      const x = k % GW;
      const y = (k / GW) | 0;
      let s = 0;
      let n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
        const v = dem[yy * GW + xx];
        if (!Number.isNaN(v)) {
          s += v;
          n++;
        }
      }
      if (n) dem[k] = s / n;
    }
for (let k = 0; k < dem.length; k++) {
  if (Number.isNaN(dem[k])) dem[k] = 0;
  if (Number.isNaN(mns[k])) mns[k] = dem[k];
}

/** Bilinear ground height at Lambert-93 (X, Y). */
function demAt(X, Y, grid = dem) {
  const fx = Math.max(0, Math.min(GW - 1.001, gi(X)));
  const fy = Math.max(0, Math.min(GH - 1.001, gj(Y)));
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  const u = fx - x;
  const v = fy - y;
  const a = grid[y * GW + x];
  const b = grid[y * GW + x + 1];
  const c = grid[(y + 1) * GW + x];
  const d = grid[(y + 1) * GW + x + 1];
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

// =============================================================================
// Rasterisation helpers and Euclidean distance transform (Felzenszwalb).
// =============================================================================
function fillPolygon(mask, rings, value = 1) {
  // Even-odd scanline fill of polygon rings given in lattice coordinates.
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const ring of rings)
    for (const [, y] of ring) {
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  y0 = Math.max(0, Math.ceil(y0));
  y1 = Math.min(GH - 1, Math.floor(y1));
  const xs = [];
  for (let y = y0; y <= y1; y++) {
    xs.length = 0;
    for (const ring of rings)
      for (let k = 0; k < ring.length; k++) {
        const [ax, ay] = ring[k];
        const [bx, by] = ring[(k + 1) % ring.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil(xs[k]));
      const b = Math.min(GW - 1, Math.floor(xs[k + 1]));
      for (let x = a; x <= b; x++) mask[y * GW + x] = value;
    }
  }
}

function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s;
    for (;;) {
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      if (s <= z[k]) k--;
      else break;
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) ** 2 + f[v[k]];
  }
}

/** Distance (m) from every lattice vertex to the nearest seed (seed[k] = 1). */
function distanceField(seed) {
  const INF = 1e12;
  const g = new Float64Array(GW * GH);
  for (let k = 0; k < g.length; k++) g[k] = seed[k] ? 0 : INF;
  const n = Math.max(GW, GH);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < GW; x++) {
    for (let y = 0; y < GH; y++) f[y] = g[y * GW + x];
    edt1d(f, GH, d, v, z);
    for (let y = 0; y < GH; y++) g[y * GW + x] = d[y];
  }
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) f[x] = g[y * GW + x];
    edt1d(f, GW, d, v, z);
    for (let x = 0; x < GW; x++) g[y * GW + x] = d[x];
  }
  const out = new Float32Array(GW * GH);
  for (let k = 0; k < out.length; k++) out[k] = Math.sqrt(g[k]) * STEP;
  return out;
}

// =============================================================================
// Lake outline (OSM multipolygon "Lac d'Annecy").
// =============================================================================
function assembleRings(wayIds) {
  const segs = wayIds.map((id) => osm.ways.find((w) => w.id === id)?.nodes).filter(Boolean).map((n) => [...n]);
  const rings = [];
  while (segs.length) {
    let ring = segs.shift();
    let grew = true;
    while (ring[0] !== ring[ring.length - 1] && grew) {
      grew = false;
      for (let k = 0; k < segs.length; k++) {
        const s = segs[k];
        const end = ring[ring.length - 1];
        if (s[0] === end) ring = ring.concat(s.slice(1));
        else if (s[s.length - 1] === end) ring = ring.concat(s.slice(0, -1).reverse());
        else continue;
        segs.splice(k, 1);
        grew = true;
        break;
      }
    }
    if (ring.length > 3) rings.push(ring);
  }
  return rings;
}
const lakeRel = osm.rels.find((r) => r.tags.natural === 'water' && /Lac d.Annecy/i.test(r.tags.name ?? ''));
const lakeOuter = assembleRings(lakeRel.members.filter((m) => m.type === 'way' && m.role !== 'inner').map((m) => m.ref)).map((r) => r.map(L93));
const lakeInner = assembleRings(lakeRel.members.filter((m) => m.type === 'way' && m.role === 'inner').map((m) => m.ref)).map((r) => r.map(L93));
log(`lac : ${lakeOuter.length} contour(s), ${lakeInner.length} île(s), ${lakeOuter.reduce((a, r) => a + r.length, 0)} points`);
const lakeMask = new Uint8Array(GW * GH);
fillPolygon(lakeMask, [...lakeOuter, ...lakeInner].map((r) => r.map(([X, Y]) => [gi(X), gj(Y)])));
const shoreSeed = new Uint8Array(GW * GH);
for (let k = 0; k < shoreSeed.length; k++) shoreSeed[k] = lakeMask[k] ? 0 : 1;
const shoreDist = distanceField(shoreSeed); // inside the lake: distance to the shore
log('lac rasterisé');

// =============================================================================
// Centreline: resample the OSM route every metre, smooth, altitude, width, banking.
// =============================================================================
const P = route.points;
const dense = [];
for (let k = 0; k < P.length; k++) {
  const a = P[k];
  const b = P[(k + 1) % P.length];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.round(len));
  for (let q = 0; q < n; q++) {
    const f = q / n;
    dense.push({ X: a.x + (b.x - a.x) * f, Y: a.y + (b.y - a.y) * f, tags: b });
  }
}
const M = dense.length;
// Smooth the polyline (OSM nodes are corners; real roads are curves).
let xs = dense.map((p) => p.X);
let ys = dense.map((p) => p.Y);
const smoothArr = (arr, half, passes) => {
  let a = arr;
  for (let p = 0; p < passes; p++) {
    const out = new Array(a.length);
    let sum = 0;
    for (let k = -half; k <= half; k++) sum += a[(k + a.length) % a.length];
    for (let k = 0; k < a.length; k++) {
      out[k] = sum / (2 * half + 1);
      sum += a[(k + half + 1) % a.length] - a[(k - half + a.length) % a.length];
    }
    a = out;
  }
  return a;
};
xs = smoothArr(xs, 5, 3);
ys = smoothArr(ys, 5, 3);

// Width from OSM (lanes), then smoothed.
const widthOf = (t) => {
  const w = Number.parseFloat(t.width);
  if (w > 3) return Math.min(w, 14);
  const lanes = Number.parseInt(t.lanes ?? '', 10);
  if (t.junction === 'roundabout' || t.junction === 'circular') return 7.5;
  if (lanes >= 2) return Math.min(14, 3.5 * lanes);
  if (lanes === 1) return 6;
  return /primary|trunk/.test(t.highway ?? '') ? 7 : /secondary/.test(t.highway ?? '') ? 6.6 : 6;
};
let widths = smoothArr(dense.map((p) => widthOf(p.tags)), 10, 3);

// Altitude from the RGE ALTI, interpolated across bridges, smoothed (vertical curves).
let alt = dense.map((p, k) => demAt(xs[k], ys[k]));
const isBridge = dense.map((p) => p.tags.bridge && p.tags.bridge !== 'no');
for (let k = 0; k < M; k++) {
  if (!isBridge[k]) continue;
  let a = k;
  while (isBridge[(a - 1 + M) % M] && a > k - M) a--;
  let b = k;
  while (isBridge[(b + 1) % M] && b < k + M) b++;
  const ya = alt[(a - 3 + M) % M];
  const yb = alt[(b + 3) % M];
  for (let q = a; q <= b; q++) alt[(q + M) % M] = ya + ((yb - ya) * (q - a + 1)) / (b - a + 2);
  k = b;
}
alt = smoothArr(alt, 8, 3).map((y) => Math.max(y, 0.6));

// Curvature → light banking (superelevation), ±3°.
const heading = (k) => Math.atan2(xs[(k + 3) % M] - xs[(k - 3 + M) % M], ys[(k + 3) % M] - ys[(k - 3 + M) % M]);
const kappa = new Array(M);
for (let k = 0; k < M; k++) {
  let dh = heading((k + 4) % M) - heading((k - 4 + M) % M);
  dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  kappa[k] = dh / 8;
}
const kappaS = smoothArr(kappa, 12, 2);

// Buildings near the road make it "urban": narrower verge (pavement), low walls.
const buildingWays = osm.ways.filter((w) => w.tags.building && w.nodes.length >= 4 && w.nodes[0] === w.nodes[w.nodes.length - 1]);
const buildingMask = new Uint8Array(GW * GH);
for (const w of buildingWays) fillPolygon(buildingMask, [w.nodes.map((id) => L93(id)).map(([X, Y]) => [gi(X), gj(Y)])]);
const buildingDist = distanceField(buildingMask);
log(`bâtiments rasterisés (${buildingWays.length})`);

// Game coordinates: origin at the start line.
const X0 = xs[0];
const Y0 = ys[0];
const toGame = (X, Y) => [X - X0, -(Y - Y0)];

const CP_STEP = 6;
const controlPoints = [];
for (let k = 0; k < M; k += CP_STEP) {
  const [x, z] = toGame(xs[k], ys[k]);
  // "Surlargeur": real roads are widened in hairpins (vehicles need more room there).
  const hw = Math.max(2.9, widths[k] / 2) + Math.max(0, Math.min(1.3, (Math.abs(kappaS[k]) - 0.025) * 14));
  const urban = buildingDist[Math.round(gj(ys[k])) * GW + Math.round(gi(xs[k]))] < hw + 9;
  // Banking (+ = left side higher, i.e. right-hand corners). The Lambert heading turns
  // clockwise, so a right-hand corner has kappa > 0 here.
  const bank = Math.max(-3, Math.min(3, kappaS[k] * 260));
  controlPoints.push({
    x: Math.round(x * 100) / 100,
    z: Math.round(z * 100) / 100,
    y: Math.round(alt[k] * 100) / 100,
    w: Math.round(hw * 100) / 100,
    runoff: urban ? 1.4 : 2.4,
    bank: Math.round(bank * 100) / 100,
    zone: isBridge[k] ? 'bridge' : 'street',
  });
}
const spline = new TrackSpline(controlPoints, 1);
log(`tracé : ${controlPoints.length} points de contrôle, ${(spline.length / 1000).toFixed(2)} km`);

// Stamp the road onto the lattice: nearest sample and lateral offset within 30 m.
const STAMP = 30;
const nearIdx = new Int32Array(GW * GH).fill(-1);
const nearD = new Float32Array(GW * GH).fill(Infinity);
const roadSeed = new Uint8Array(GW * GH);
for (let s = 0; s < spline.count; s++) {
  const smp = spline.samples[s];
  const X = smp.p.x + X0;
  const Y = -smp.p.z + Y0;
  const cx = gi(X);
  const cy = gj(Y);
  roadSeed[Math.round(cy) * GW + Math.round(cx)] = 1;
  const r = STAMP / STEP;
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(GH - 1, Math.ceil(cy + r)); y++)
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(GW - 1, Math.ceil(cx + r)); x++) {
      const d = Math.hypot((x - cx) * STEP, (y - cy) * STEP);
      const k = y * GW + x;
      if (d < nearD[k]) {
        nearD[k] = d;
        nearIdx[k] = s;
      }
    }
}
const roadDist = distanceField(roadSeed);
log('route rasterisée');

/** Road surface height and half-widths at lattice vertex k (null if far from the road). */
function roadAt(k) {
  const s = nearIdx[k];
  if (s < 0) return null;
  const smp = spline.samples[s];
  const x = k % GW;
  const y = (k / GW) | 0;
  const [gx, gz] = toGame(GX0 + x * STEP, GY0 + y * STEP);
  const lh = Math.hypot(smp.left.x, smp.left.z) || 1;
  const lat = ((gx - smp.p.x) * smp.left.x + (gz - smp.p.z) * smp.left.z) / lh;
  return { smp, lat, y: smp.p.y + lat * Math.tan(smp.bank), d: nearD[k] };
}

// =============================================================================
// Final ground: carve under the road, dig the lake bed, surface model far from the road.
// =============================================================================
const ground = new Float32Array(GW * GH);
for (let k = 0; k < ground.length; k++) {
  let h = dem[k];
  const dr = roadDist[k];
  // Beyond ~200 m: the surface model (forests and villages with volume, seen from afar).
  const w = Math.min(1, Math.max(0, (dr - 190) / 80));
  if (w > 0) h = h + (Math.max(h, mns[k]) - h) * (w * w * (3 - 2 * w));
  const rd = roadAt(k);
  if (rd && rd.smp.zone !== 'bridge') {
    // Flat shoulder 2.5 m beyond the barrier, then blend into the natural ground over 14 m
    // (wide enough that the 4 m terrain triangles never rise through the verge).
    const edge = Math.max(rd.smp.wallL, rd.smp.wallR) + 2.5;
    const lat = Math.abs(rd.lat);
    const target = rd.y - 0.32;
    if (lat <= edge) h = target;
    else if (lat < edge + 14) {
      const t = (lat - edge) / 14;
      const sm = t * t * (3 - 2 * t);
      h = target + (h - target) * sm;
    }
  }
  if (lakeMask[k]) h = Math.min(h, -(1.2 + Math.min(70, shoreDist[k] * 0.12)));
  ground[k] = h;
}
log('terrain sculpté');

// =============================================================================
// Output.
// =============================================================================
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(join(OUT, 't'), { recursive: true });

/** Binary container: u32 header length, JSON header, then 4-byte aligned typed arrays. */
function pack(header, arrays) {
  const parts = [];
  let offset = 0;
  const entries = {};
  for (const [name, arr] of Object.entries(arrays)) {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    entries[name] = { type: arr.constructor.name, offset, length: arr.length };
    parts.push(bytes);
    offset += bytes.length;
    const pad = (4 - (offset % 4)) % 4;
    if (pad) {
      parts.push(new Uint8Array(pad));
      offset += pad;
    }
  }
  let json = JSON.stringify({ ...header, arrays: entries });
  while ((4 + Buffer.byteLength(json)) % 4) json += ' ';
  const head = Buffer.from(json);
  const len = Buffer.alloc(4);
  len.writeUInt32LE(head.length);
  return gzipSync(Buffer.concat([len, head, ...parts.map((p) => Buffer.from(p))]), { level: 9 });
}

const enc = (h) => Math.max(0, Math.min(65535, Math.round((h + 200) * 10)));
const hash = (a, b) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Buildings near the road (by centroid), with real heights from the surface model.
const PALETTE = [0xe9e4da, 0xe8d9b5, 0xd9b47c, 0xe2b8a8, 0xcfcfca, 0xb9ad99, 0xe6cf8e, 0xf1eee6, 0xd8c3a5];
const tileBuildings = new Map();
let nBuild = 0;
for (const w of buildingWays) {
  const pts = w.nodes.slice(0, -1).map(L93);
  let cx = 0;
  let cy = 0;
  for (const [X, Y] of pts) {
    cx += X / pts.length;
    cy += Y / pts.length;
  }
  const kc = Math.round(gj(cy)) * GW + Math.round(gi(cx));
  if (!(kc >= 0 && kc < GW * GH) || roadDist[kc] > 180) continue; // beyond: surface model
  // Not on the road itself (bad data or covered passages).
  let onRoad = false;
  for (const [X, Y] of pts) {
    const k = Math.round(gj(Y)) * GW + Math.round(gi(X));
    const rd = roadAt(k);
    if (rd && Math.abs(rd.lat) < Math.max(rd.smp.wallL, rd.smp.wallR) + 0.3 && rd.smp.zone !== 'bridge') onRoad = true;
  }
  if (onRoad) continue;
  let area = 0;
  for (let k = 0; k < pts.length; k++) {
    const [ax, ay] = pts[k];
    const [bx, by] = pts[(k + 1) % pts.length];
    area += ax * by - bx * ay;
  }
  area = Math.abs(area) / 2;
  if (area < 8) continue;
  // Height: tag, else median of surface − ground over the footprint.
  let H = Number.parseFloat(w.tags.height) || (Number.parseFloat(w.tags['building:levels']) ? Number.parseFloat(w.tags['building:levels']) * 3 + 1.5 : 0);
  if (!H) {
    const hs = [];
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [X, Y] of pts) {
      x0 = Math.min(x0, gi(X));
      x1 = Math.max(x1, gi(X));
      y0 = Math.min(y0, gj(Y));
      y1 = Math.max(y1, gj(Y));
    }
    for (let y = Math.ceil(y0); y <= Math.floor(y1); y++)
      for (let x = Math.ceil(x0); x <= Math.floor(x1); x++) {
        const k = y * GW + x;
        if (buildingMask[k]) hs.push(mns[k] - dem[k]);
      }
    if (!hs.length) hs.push(demAt(cx, cy, mns) - demAt(cx, cy));
    hs.sort((a, b) => a - b);
    H = hs[Math.floor(hs.length * 0.6)];
  }
  H = Math.max(3, Math.min(60, H || 6));
  // Base: lowest ground under the footprint (walls go down to it).
  let base = Infinity;
  for (const [X, Y] of pts) base = Math.min(base, demAt(X, Y, ground));
  const flat = w.tags['roof:shape'] === 'flat' || area > 900 || H > 22;
  const roofH = flat ? 0 : Math.max(1.4, Math.min(5, 0.28 * Math.sqrt(area)));
  const ti = Math.floor(cx / TILE);
  const tj = Math.floor(cy / TILE);
  const key = `${ti}_${tj}`;
  if (!tileBuildings.has(key)) tileBuildings.set(key, []);
  tileBuildings.get(key).push({ pts, cx, cy, H, base, roofH, wall: PALETTE[Math.floor(hash(w.id, 7) * PALETTE.length)] });
  nBuild++;
}
log(`${nBuild} bâtiments retenus`);

let nTrees = 0;
let bytes = 0;
const tileList = [];
for (const [i, j] of tiles) {
  const key = `${i}_${j}`;
  const ox = (i - minI) * (N - 1);
  const oy = (j - minJ) * (N - 1);
  // Heights, row 0 = north.
  const heights = new Uint16Array(N * N);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) heights[r * N + c] = enc(ground[(oy + N - 1 - r) * GW + ox + c]);
  // Photo: raw RGB for tree / roof colours, WebP for the game.
  const jpg = readFileSync(join(IGN, `${key}.jpg`));
  const img = await sharp(jpg).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = img.info.width;
  const photo = (X, Y) => {
    const px = Math.max(0, Math.min(W - 1, Math.floor(((X - i * TILE) / TILE) * W)));
    const py = Math.max(0, Math.min(W - 1, Math.floor(((j * TILE + TILE - Y) / TILE) * W)));
    const o = (py * W + px) * 3;
    return [img.data[o], img.data[o + 1], img.data[o + 2]];
  };
  const webp = await sharp(jpg).webp({ quality: 68, effort: 5 }).toBuffer();
  writeFileSync(join(OUT, 't', `${key}.webp`), webp);

  // Trees: real canopy (surface model − ground) within 200 m of the road.
  const tx = [];
  const tz = [];
  const th = [];
  const tt = [];
  const tc = [];
  for (let r = 0; r < N - 1; r++)
    for (let c = 0; c < N - 1; c++) {
      const k = (oy + r) * GW + ox + c;
      if (roadDist[k] > 185 || lakeMask[k] || buildingMask[k] || buildingDist[k] < 3) continue;
      const canopy = mns[k] - dem[k];
      if (canopy < 3.5 || canopy > 45) continue;
      const rd = roadAt(k);
      if (rd && Math.abs(rd.lat) < Math.max(rd.smp.wallL, rd.smp.wallR) + 1.6) continue;
      const X = (i * TILE) + c * STEP;
      const Y = (j * TILE) + r * STEP;
      if (hash(X, Y) > 0.42) continue;
      const jx = (hash(X + 1, Y) - 0.5) * STEP;
      const jy = (hash(X, Y + 1) - 0.5) * STEP;
      const [R, G, B] = photo(X + jx, Y + jy);
      const luma = 0.3 * R + 0.59 * G + 0.11 * B;
      tx.push(Math.round((c * STEP + jx + 2) * 10));
      tz.push(Math.round((r * STEP + jy + 2) * 10));
      th.push(Math.min(255, Math.round(Math.min(canopy, 34) * 6)));
      tt.push(luma < 58 ? 1 : 0); // 1 = conifer (darker crowns)
      tc.push(R, G, B);
    }
  nTrees += tx.length;

  // Buildings of this tile: footprint relative to the tile's south-west corner (dm).
  const bl = tileBuildings.get(key) ?? [];
  const bCount = new Uint16Array(bl.length);
  const bInfo = new Int16Array(bl.length * 4); // wall height, roof height, base (dm), wall colour index
  const bColor = new Uint8Array(bl.length * 6); // roof rgb, wall rgb
  const verts = [];
  bl.forEach((b, q) => {
    bCount[q] = b.pts.length;
    bInfo[q * 4] = Math.round((b.H - b.roofH) * 10);
    bInfo[q * 4 + 1] = Math.round(b.roofH * 10);
    bInfo[q * 4 + 2] = Math.round(b.base * 10);
    bInfo[q * 4 + 3] = 0;
    // Roof colour: average of the photo around the centroid.
    let R = 0;
    let G = 0;
    let B = 0;
    for (const [dx, dy] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) {
      const [r, g, bb] = photo(b.cx + dx, b.cy + dy);
      R += r / 5;
      G += g / 5;
      B += bb / 5;
    }
    bColor.set([R, G, B, (b.wall >> 16) & 255, (b.wall >> 8) & 255, b.wall & 255], q * 6);
    for (const [X, Y] of b.pts) verts.push(Math.round((X - i * TILE) * 10), Math.round((Y - j * TILE) * 10));
  });

  const buf = pack(
    { i, j, n: N, step: STEP },
    {
      heights,
      treeX: new Uint16Array(tx),
      treeZ: new Uint16Array(tz),
      treeH: new Uint8Array(th),
      treeType: new Uint8Array(tt),
      treeRGB: new Uint8Array(tc),
      bCount,
      bInfo,
      bColor,
      bVerts: new Int16Array(verts),
    },
  );
  writeFileSync(join(OUT, 't', `${key}.bin`), buf);
  bytes += buf.length + webp.length;
  tileList.push([i, j]);
}
log(`${tileList.length} cases écrites, ${nTrees} arbres, ${(bytes / 1e6).toFixed(1)} Mo`);

// =============================================================================
// Far terrain (mountains): 120 m grid, lake dug, photo.
// =============================================================================
{
  const raw = new Float32Array(readFileSync(join(IGN, 'far-dem.bil')).buffer.slice(0));
  const n = far.n;
  const step = (2 * far.half) / (n - 1);
  const heights = new Uint16Array(n * n);
  // Lake polygon on the far grid.
  const fx = (X) => (X - (far.cx - far.half)) / step;
  const fy = (Y) => (far.cy + far.half - Y) / step; // row 0 = north
  const ringsF = [...lakeOuter, ...lakeInner].map((r) => r.map(([X, Y]) => [fx(X), fy(Y)]));
  const inLake = (x, y) => {
    let inside = false;
    for (const ring of ringsF)
      for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) {
        const [ax, ay] = ring[k];
        const [bx, by] = ring[m];
        if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
      }
    return inside;
  };
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      let h = raw[r * n + c];
      h = h > -100 && h < 6000 ? h - LAKE_LEVEL : 0;
      if (h < 3 && inLake(c, r)) h = -25;
      heights[r * n + c] = enc(h);
    }
  const [ox, oz] = toGame(far.cx - far.half, far.cy + far.half);
  writeFileSync(join(OUT, 'far.bin'), pack({ n, step, x: ox, z: oz }, { heights }));
  const webp = await sharp(readFileSync(join(IGN, 'far-ortho.jpg'))).webp({ quality: 62, effort: 5 }).toBuffer();
  writeFileSync(join(OUT, 'far.webp'), webp);
  log(`terrain lointain : ${(webp.length / 1e6).toFixed(2)} Mo de photo`);
}

// =============================================================================
// track.json: centreline, lake, signs, sectors, variants.
// =============================================================================
const simplify = (pts, tol) => {
  // Douglas–Peucker on a closed ring.
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1;
    let bd = tol;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const L = Math.hypot(bx - ax, by - ay) || 1;
    for (let k = a + 1; k < b; k++) {
      const d = Math.abs((bx - ax) * (ay - pts[k][1]) - (ax - pts[k][0]) * (by - ay)) / L;
      if (d > bd) {
        bd = d;
        best = k;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, k) => keep[k]);
};
const lakeGame = (ring) => simplify(ring, 2).map(([X, Y]) => toGame(X, Y).map((v) => Math.round(v * 10) / 10));

const nearestS = (X, Y) => spline.project(...toGame(X, Y)).s;
const wpS = route.waypoints.map(([name, lat, lon]) => ({ name, s: nearestS(...lonLatToL93(lon, lat)) }));
const sOf = (name) => wpS.find((w) => w.name.startsWith(name)).s;
const L = spline.length;

// Village signs: OSM city limits next to the route; entering or leaving the place?
const places = osm.nodes.filter((n) => n[3]?.place && /town|village|city/.test(n[3].place)).map((n) => ({ name: n[3].name, X: lonLatToL93(n[1], n[2])[0], Y: lonLatToL93(n[1], n[2])[1] }));
const signs = [];
for (const n of osm.nodes) {
  const t = n[3];
  if (!t || !/city_limit|EB10|EB20/.test(t.traffic_sign ?? '')) continue;
  const [X, Y] = lonLatToL93(n[1], n[2]);
  const [gx, gz] = toGame(X, Y);
  const q = spline.project(gx, gz);
  const p = spline.pointAt(q.s, 0);
  if (Math.hypot(p.x - gx, p.z - gz) > 25) continue;
  const name = t.name ?? places.reduce((a, b) => (Math.hypot(b.X - X, b.Y - Y) < Math.hypot(a.X - X, a.Y - Y) ? b : a)).name;
  const place = places.find((pl) => pl.name === name) ?? places.reduce((a, b) => (Math.hypot(b.X - X, b.Y - Y) < Math.hypot(a.X - X, a.Y - Y) ? b : a));
  const ahead = spline.pointAt(q.s + 60, 0);
  const behind = spline.pointAt(q.s - 60, 0);
  const [plx, plz] = toGame(place.X, place.Y);
  const entering = Math.hypot(ahead.x - plx, ahead.z - plz) < Math.hypot(behind.x - plx, behind.z - plz);
  if (signs.some((s) => Math.abs(s.s - q.s) < 40)) continue;
  signs.push({ s: Math.round(q.s), name, entering });
}
signs.sort((a, b) => a.s - b.s);

const track = {
  name: 'Tour du lac d’Annecy',
  source: 'OpenStreetMap (ODbL) · IGN RGE ALTI et BD ORTHO (Licence Ouverte 2.0)',
  origin: { x: X0, y: Y0, crs: 'EPSG:2154', lakeLevel: LAKE_LEVEL },
  length: L,
  controlPoints: controlPoints.map((c) => [c.x, c.z, c.y, c.w, c.runoff, c.bank, c.zone === 'bridge' ? 1 : 0]),
  sectors: [0, sOf('Saint-Jorioz') / L, sOf('Talloires') / L],
  variants: [
    { id: 'full', name: 'Tour complet', from: 0, to: L },
    { id: 'west', name: 'Rive ouest : Annecy → Doussard', from: 0, to: sOf('Doussard') },
    { id: 'east', name: 'Rive est : Doussard → Annecy', from: sOf('Doussard'), to: L },
  ],
  waypoints: wpS,
  lake: { outer: lakeOuter.map(lakeGame), inner: lakeInner.map(lakeGame) },
  signs,
  tile: { size: TILE, step: STEP, n: N, list: tileList.map(([i, j]) => [i, j, ...toGame(i * TILE, j * TILE + TILE)]) },
};
writeFileSync(join(OUT, 'track.json'), JSON.stringify(track));
log(`track.json : ${(JSON.stringify(track).length / 1e3).toFixed(0)} ko, ${signs.length} panneaux, secteurs ${track.sectors.map((f) => f.toFixed(3)).join(' / ')}`);
log(`variantes : ${track.variants.map((v) => `${v.name} ${((v.to - v.from) / 1000).toFixed(1)} km`).join(' · ')}`);
