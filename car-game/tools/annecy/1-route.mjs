/**
 * Step 1 — the real route of the "Tour du lac d'Annecy" from OpenStreetMap.
 *
 * Reads the roads downloaded by step 0, builds a directed road graph (one-way streets and
 * roundabouts respected) and finds the shortest path through waypoints in the villages,
 * strongly preferring the D1508 (west shore: Sévrier, Saint-Jorioz, Duingt) and the D909/D909A
 * (east shore: Talloires, Menthon-Saint-Bernard, Veyrier-du-Lac). The lap runs anticlockwise
 * around the lake (lake on the left), the way traffic flows through French roundabouts.
 *
 *   node tools/annecy/1-route.mjs   →  tools/cache/annecy/route.json (needs step 0)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE, lonLatToL93 } from './common.mjs';

console.log('Routes (OpenStreetMap, tools/cache/annecy/osm.json)…');
const osm = JSON.parse(readFileSync(join(CACHE, 'osm.json'), 'utf8'));
const nodeLL = new Map(osm.nodes.map((n) => [n[0], [n[1], n[2]]]));
const ROAD = /^(trunk|primary|secondary|tertiary|unclassified|residential)(_link)?$/;
const ways = osm.ways
  .filter((w) => w.tags && ROAD.test(w.tags.highway ?? '') && w.nodes.every((id) => nodeLL.has(id)))
  .map((w) => ({ ...w, geometry: w.nodes.map((id) => ({ lon: nodeLL.get(id)[0], lat: nodeLL.get(id)[1] })) }));
console.log(`  ${ways.length} voies carrossables`);

// Waypoints, in driving order (anticlockwise around the lake). Start/finish: Annecy lakeside.
// The last flag says the waypoint must sit on the D1508 / D909 / D909A.
const WAYPOINTS = [
  ['Annecy (avenue d’Albigny)', 45.9036, 6.1378, true],
  ['Annecy (quai Eustache-Chappuis)', 45.8985, 6.1285, true],
  ['Sévrier', 45.8645, 6.1418, true],
  ['Saint-Jorioz', 45.8318, 6.1625, true],
  ['Doussard (bout du lac)', 45.7905, 6.2195, true],
  ['Talloires', 45.841, 6.215, true],
  ['Veyrier-du-Lac', 45.883, 6.1735, true],
];

// --- Directed graph.
const coord = new Map(); // node id → [x, y] (Lambert-93)
const onD = new Set(); // nodes of the D1508 / D909 / D909A
const edges = new Map(); // node id → [{ to, len, way }]
const pref = (t) => {
  const ref = (t.ref ?? '').replace(/\s/g, '').toUpperCase();
  if (/(^|;)D(1508|909A?)($|;)/.test(ref)) return 1;
  if (/^(trunk|primary|secondary)/.test(t.highway)) return 1.8;
  if (/^tertiary/.test(t.highway)) return 2.6;
  return 4;
};
for (const w of ways) {
  const t = w.tags ?? {};
  w.nodes.forEach((id, i) => {
    if (!coord.has(id)) coord.set(id, lonLatToL93(w.geometry[i].lon, w.geometry[i].lat));
    if (pref(t) === 1) onD.add(id);
  });
  const oneway = t.oneway === 'yes' || t.oneway === '1' || t.junction === 'roundabout' || t.junction === 'circular' || /motorway|_link/.test(t.highway) && t.oneway !== 'no';
  const reverse = t.oneway === '-1';
  for (let i = 0; i + 1 < w.nodes.length; i++) {
    const a = w.nodes[i];
    const c = w.nodes[i + 1];
    const [ax, ay] = coord.get(a);
    const [cx, cy] = coord.get(c);
    const len = Math.hypot(cx - ax, cy - ay);
    const add = (f, to) => {
      if (!edges.has(f)) edges.set(f, []);
      edges.get(f).push({ to, len, cost: len * pref(t), way: w.id });
    };
    if (!reverse) add(a, c);
    if (!oneway || reverse) add(c, a);
  }
}
const wayById = new Map(ways.map((w) => [w.id, w]));

function nearestNode(lat, lon, dRoad) {
  const [x, y] = lonLatToL93(lon, lat);
  let best = null;
  let bd = Infinity;
  for (const [id, [nx, ny]] of coord) {
    if (!edges.has(id) || (dRoad && !onD.has(id))) continue;
    const d = (nx - x) ** 2 + (ny - y) ** 2;
    if (d < bd) {
      bd = d;
      best = id;
    }
  }
  return { id: best, dist: Math.sqrt(bd) };
}

function dijkstra(src, dst) {
  const dist = new Map([[src, 0]]);
  const prev = new Map();
  // Binary heap.
  const heap = [[0, src]];
  const push = (item) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, u] = pop();
    if (u === dst) break;
    if (d > (dist.get(u) ?? Infinity)) continue;
    for (const e of edges.get(u) ?? []) {
      const nd = d + e.cost;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, { from: u, way: e.way });
        push([nd, e.to]);
      }
    }
  }
  if (!prev.has(dst)) throw new Error(`no path ${src} → ${dst}`);
  const path = [];
  for (let v = dst; v !== src; v = prev.get(v).from) path.push({ node: v, way: prev.get(v).way });
  return path.reverse();
}

const wp = WAYPOINTS.map(([name, lat, lon, dRoad]) => ({ name, ...nearestNode(lat, lon, dRoad) }));
for (const w of wp) console.log(`  repère ${w.name} : nœud ${w.id} à ${w.dist.toFixed(0)} m`);
const start = wp[0].id;
const route = [{ node: start, way: null }];
for (let i = 0; i < wp.length; i++) route.push(...dijkstra(wp[i].id, wp[(i + 1) % wp.length].id));
route.pop(); // last node = start again
// Loop erasure: a waypoint snapped onto a side branch makes the path go there and back; cut
// every such out-and-back so each node is driven once.
{
  const at = new Map();
  const clean = [];
  for (const r of route) {
    const k = at.get(r.node);
    if (k !== undefined) {
      for (const x of clean.splice(k + 1)) at.delete(x.node);
      continue;
    }
    at.set(r.node, clean.length);
    clean.push(r);
  }
  route.length = 0;
  route.push(...clean);
}

// Points with the tags of the way leading to them.
const points = route.map((r, i) => {
  const [x, y] = coord.get(r.node);
  const w = wayById.get(r.way ?? route[1].way);
  const t = w?.tags ?? {};
  return { i, node: r.node, x, y, way: w?.id, highway: t.highway, ref: t.ref, name: t.name, lanes: t.lanes, width: t.width, bridge: t.bridge, tunnel: t.tunnel, junction: t.junction, maxspeed: t.maxspeed };
});
let len = 0;
for (let i = 0; i < points.length; i++) {
  const a = points[i];
  const c = points[(i + 1) % points.length];
  len += Math.hypot(c.x - a.x, c.y - a.y);
}
// Summary of the roads used.
const runs = [];
for (const p of points) {
  const key = `${p.ref ?? ''} ${p.name ?? ''}`.trim() || p.highway;
  if (!runs.length || runs[runs.length - 1].key !== key) runs.push({ key, n: 0 });
  runs[runs.length - 1].n++;
}
console.log(`Tracé : ${points.length} points, ${(len / 1000).toFixed(2)} km`);
console.log('  ' + runs.filter((r) => r.n > 3).map((r) => r.key).join(' → '));
// A lap must not use the same node twice (no doubling back).
const seen = new Set();
const dup = points.filter((p) => (seen.has(p.node) ? true : (seen.add(p.node), false)));
if (dup.length) console.warn(`  attention : ${dup.length} nœuds parcourus deux fois`);
writeFileSync(join(CACHE, 'route.json'), JSON.stringify({ waypoints: WAYPOINTS, length: len, points }));
