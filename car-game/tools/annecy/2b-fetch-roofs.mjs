/**
 * Step 2b — the IGN surface model (RGE ALTI MNS: ground + buildings + trees) at 1 m, for the
 * 1 km tiles that hold buildings near the route: the build step reads each roof's real shape
 * from it (flat, gable or hip, ridge direction, eave and ridge heights). The 4 m grid of step 2
 * is too coarse for that (a house is 8–12 m wide).
 *
 *   node tools/annecy/2b-fetch-roofs.mjs   (needs steps 0–2)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE, fetchRetry, lonLatToL93, sleep } from './common.mjs';
import { BUILDING_RADIUS } from './buildings.mjs';

export const ROOF_STEP = 1;
export const ROOF_N = 1000 / ROOF_STEP + 1;
const WMS = 'https://data.geopf.fr/wms-r?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&STYLES=&CRS=EPSG:2154';
const DIR = join(CACHE, 'ign');

const route = JSON.parse(readFileSync(join(CACHE, 'route.json'), 'utf8'));
const osm = JSON.parse(readFileSync(join(CACHE, 'osm.json'), 'utf8'));
const tiles = JSON.parse(readFileSync(join(DIR, 'tiles.json'), 'utf8'));
const have = new Set(tiles.map(([i, j]) => `${i}_${j}`));

// Route points on a 50 m hash grid for the distance test.
const grid = new Map();
for (const p of route.points) {
  const k = `${Math.floor(p.x / 50)}_${Math.floor(p.y / 50)}`;
  if (!grid.has(k)) grid.set(k, []);
  grid.get(k).push(p);
}
const nearRoute = (X, Y) => {
  const r = Math.ceil(BUILDING_RADIUS / 50);
  const gx = Math.floor(X / 50);
  const gy = Math.floor(Y / 50);
  for (let a = gx - r; a <= gx + r; a++)
    for (let b = gy - r; b <= gy + r; b++) for (const p of grid.get(`${a}_${b}`) ?? []) if (Math.hypot(p.x - X, p.y - Y) < BUILDING_RADIUS) return true;
  return false;
};
const nodes = new Map(osm.nodes.map((n) => [n[0], n]));
const wanted = new Set();
for (const w of osm.ways) {
  if (!w.tags.building || w.nodes.length < 4) continue;
  const n = nodes.get(w.nodes[0]);
  if (!n) continue;
  const [X, Y] = lonLatToL93(n[1], n[2]);
  if (!nearRoute(X, Y)) continue;
  const key = `${Math.floor(X / 1000)}_${Math.floor(Y / 1000)}`;
  if (have.has(key)) wanted.add(key);
}
const list = [...wanted];
console.log(`Toits : ${list.length} cases de 1 km au mètre près`);
let done = 0;
const worker = async () => {
  for (;;) {
    const key = list.shift();
    if (!key) return;
    const [i, j] = key.split('_').map(Number);
    const file = join(DIR, `${key}.mns1.bil`);
    if (!existsSync(file)) {
      const h = ROOF_STEP / 2;
      const box = [i * 1000 - h, j * 1000 - h, i * 1000 + 1000 + h, j * 1000 + 1000 + h];
      const url = `${WMS}&LAYERS=ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES.MNS&BBOX=${box.join(',')}&WIDTH=${ROOF_N}&HEIGHT=${ROOF_N}&FORMAT=image/x-bil;bits=32`;
      let buf = null;
      for (let attempt = 0; attempt < 6 && !buf; attempt++) {
        try {
          const res = await fetchRetry(url, { timeout: 180000 });
          const b = Buffer.from(await res.arrayBuffer());
          if (b.length === ROOF_N * ROOF_N * 4) buf = b;
        } catch {
          await sleep(3000 * (attempt + 1));
        }
      }
      if (!buf) throw new Error(`MNS 1 m ${key} : échec`);
      writeFileSync(file, buf);
      await sleep(150);
    }
    if (++done % 10 === 0) console.log(`  ${done}`);
  }
};
await Promise.all([worker(), worker(), worker()]);
writeFileSync(join(DIR, 'roof-tiles.json'), JSON.stringify([...wanted]));
console.log('Toits : terminé');
