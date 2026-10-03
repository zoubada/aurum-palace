/**
 * Step 0 — OpenStreetMap data around the lake (roads, buildings, land cover, water, places),
 * from the OSM API (`/api/0.6/map`) in small tiles (the API caps each request at 0.25 deg² and
 * 50 000 nodes; dense tiles are split in four). Two requests at a time, cached per tile so the
 * download can resume. Output: tools/cache/annecy/osm.json (nodes, ways, relations).
 *
 *   node tools/annecy/0-fetch-osm.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BBOX, CACHE, fetchRetry, sleep } from './common.mjs';

const STEP = 0.01;
const DIR = join(CACHE, 'osm-tiles');
mkdirSync(DIR, { recursive: true });

/** Minimal parser for the OSM XML format. */
function parseOsm(xml) {
  const nodes = [];
  const ways = [];
  const rels = [];
  const attr = (s, k) => {
    const m = s.match(new RegExp(`\\s${k}="([^"]*)"`));
    return m ? m[1] : undefined;
  };
  const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const tagsOf = (body) => {
    const t = {};
    for (const m of body.matchAll(/<tag k="([^"]*)" v="([^"]*)"\s*\/>/g)) t[unesc(m[1])] = unesc(m[2]);
    return t;
  };
  const re = /<(node|way|relation)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/g;
  for (const m of xml.matchAll(re)) {
    const [, kind, head, , body = ''] = m;
    const id = Number(attr(head, 'id'));
    if (kind === 'node') {
      const t = body ? tagsOf(body) : null;
      nodes.push([id, Number(attr(head, 'lon')), Number(attr(head, 'lat')), t && Object.keys(t).length ? t : null]);
    } else if (kind === 'way') {
      ways.push({ id, nodes: [...body.matchAll(/<nd ref="(\d+)"/g)].map((x) => Number(x[1])), tags: tagsOf(body) });
    } else {
      rels.push({
        id,
        members: [...body.matchAll(/<member type="(\w+)" ref="(\d+)" role="([^"]*)"/g)].map((x) => ({ type: x[1], ref: Number(x[2]), role: x[3] })),
        tags: tagsOf(body),
      });
    }
  }
  return { nodes, ways, rels };
}

async function fetchTile(w, s, e, n, depth = 0) {
  const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${w.toFixed(5)},${s.toFixed(5)},${e.toFixed(5)},${n.toFixed(5)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(120000), headers: { 'User-Agent': 'apex-racing-prototype/0.1 (track data tool)' } });
  if (res.status === 400 && depth < 3) {
    // Too many nodes: split in four.
    const mx = (w + e) / 2;
    const my = (s + n) / 2;
    const parts = [];
    for (const [a, b, c, d] of [
      [w, s, mx, my],
      [mx, s, e, my],
      [w, my, mx, n],
      [mx, my, e, n],
    ])
      parts.push(await fetchTile(a, b, c, d, depth + 1));
    return {
      nodes: parts.flatMap((p) => p.nodes),
      ways: parts.flatMap((p) => p.ways),
      rels: parts.flatMap((p) => p.rels),
    };
  }
  if (!res.ok) {
    const r2 = await fetchRetry(url, { headers: { 'User-Agent': 'apex-racing-prototype/0.1 (track data tool)' } });
    return parseOsm(await r2.text());
  }
  return parseOsm(await res.text());
}

const tiles = [];
for (let lat = BBOX.south; lat < BBOX.north - 1e-9; lat += STEP)
  for (let lon = BBOX.west; lon < BBOX.east - 1e-9; lon += STEP) tiles.push([lon, lat]);
console.log(`${tiles.length} cases de ${STEP}° à télécharger (cache : ${DIR})`);

let done = 0;
async function worker() {
  for (;;) {
    const t = tiles.shift();
    if (!t) return;
    const [lon, lat] = t;
    const file = join(DIR, `${lon.toFixed(3)}_${lat.toFixed(3)}.json`);
    if (!existsSync(file)) {
      const data = await fetchTile(lon, lat, Math.min(lon + STEP, BBOX.east), Math.min(lat + STEP, BBOX.north));
      writeFileSync(file, JSON.stringify(data));
      await sleep(300);
    }
    if (++done % 25 === 0) console.log(`  ${done} cases`);
  }
}
await Promise.all([worker(), worker()]);

// Merge (objects appear in several tiles).
const nodes = new Map();
const ways = new Map();
const rels = new Map();
const { readdirSync } = await import('node:fs');
for (const f of readdirSync(DIR)) {
  const d = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  for (const n of d.nodes) if (!nodes.has(n[0]) || (n[3] && !nodes.get(n[0])[3])) nodes.set(n[0], n);
  for (const w of d.ways) ways.set(w.id, w);
  for (const r of d.rels) rels.set(r.id, r);
}
console.log(`OSM : ${nodes.size} nœuds, ${ways.size} voies, ${rels.size} relations`);
writeFileSync(join(CACHE, 'osm.json'), JSON.stringify({ nodes: [...nodes.values()], ways: [...ways.values()], rels: [...rels.values()] }));
