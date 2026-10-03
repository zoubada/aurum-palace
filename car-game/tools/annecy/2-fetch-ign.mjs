/**
 * Step 2 — IGN open data (Géoplateforme WMS, Licence Ouverte 2.0) for the terrain:
 *  - RGE ALTI ground elevation (ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES), raw float32 BIL;
 *  - RGE ALTI surface model (…HIGHRES.MNS: ground + trees + buildings), to place real trees;
 *  - BD ORTHO aerial photographs (ORTHOIMAGERY.ORTHOPHOTOS).
 *
 * Near terrain: 1 km tiles (Lambert-93 grid) within 1.6 km of the route — elevation every 4 m,
 * surface model every 4 m, photo at 1024 px (≈1 m/pixel). Far terrain (mountains around the
 * lake): one 48 km square, elevation every 120 m, photo 3072 px.
 *
 *   node tools/annecy/2-fetch-ign.mjs   (needs step 1)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE, fetchRetry, sleep } from './common.mjs';

export const TILE = 1000;
export const DEM_STEP = 4;
export const DEM_N = TILE / DEM_STEP + 1; // 251 samples per side (shared edges)
export const ORTHO_PX = 1024;
export const FAR = { half: 24000, n: 401, ortho: 3072 };
const WMS = 'https://data.geopf.fr/wms-r?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&STYLES=&CRS=EPSG:2154';

const route = JSON.parse(readFileSync(join(CACHE, 'route.json'), 'utf8'));
const pts = route.points;

/** Tiles (Lambert-93 km indices) whose square comes within `margin` m of the route. */
export function corridorTiles(points, margin) {
  const set = new Set();
  for (const p of points) {
    const r = Math.ceil(margin / TILE);
    const ti = Math.floor(p.x / TILE);
    const tj = Math.floor(p.y / TILE);
    for (let i = ti - r; i <= ti + r; i++)
      for (let j = tj - r; j <= tj + r; j++) {
        const dx = Math.max(i * TILE - p.x, 0, p.x - (i + 1) * TILE);
        const dy = Math.max(j * TILE - p.y, 0, p.y - (j + 1) * TILE);
        if (Math.hypot(dx, dy) <= margin) set.add(`${i}_${j}`);
      }
  }
  return [...set].map((k) => k.split('_').map(Number));
}

async function getBil(layer, bbox, w, h, file) {
  if (existsSync(file)) return;
  const url = `${WMS}&LAYERS=${layer}&BBOX=${bbox.join(',')}&WIDTH=${w}&HEIGHT=${h}&FORMAT=image/x-bil;bits=32`;
  const res = await fetchRetry(url, { timeout: 180000 });
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length !== w * h * 4) throw new Error(`${layer}: ${buf.length} bytes, expected ${w * h * 4}`);
  writeFileSync(file, buf);
}

async function getJpeg(bbox, w, h, file) {
  if (existsSync(file)) return;
  const url = `${WMS}&LAYERS=ORTHOIMAGERY.ORTHOPHOTOS&BBOX=${bbox.join(',')}&WIDTH=${w}&HEIGHT=${h}&FORMAT=image/jpeg`;
  const res = await fetchRetry(url, { timeout: 180000 });
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('jpeg')) throw new Error(`ortho: ${type}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

const isMain = process.argv[1]?.endsWith('2-fetch-ign.mjs');
if (isMain) {
  const dir = join(CACHE, 'ign');
  mkdirSync(dir, { recursive: true });

  // --- Far terrain, centred on the lake.
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x / pts.length;
    cy += p.y / pts.length;
  }
  cx = Math.round(cx / 1000) * 1000;
  cy = Math.round(cy / 1000) * 1000;
  const step = (2 * FAR.half) / (FAR.n - 1);
  const farBox = [cx - FAR.half - step / 2, cy - FAR.half - step / 2, cx + FAR.half + step / 2, cy + FAR.half + step / 2];
  console.log(`Terrain lointain : 48 km centrés sur (${cx}, ${cy})`);
  await getBil('ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES', farBox, FAR.n, FAR.n, join(dir, 'far-dem.bil'));
  await getJpeg([cx - FAR.half, cy - FAR.half, cx + FAR.half, cy + FAR.half], FAR.ortho, FAR.ortho, join(dir, 'far-ortho.jpg'));
  writeFileSync(join(dir, 'far.json'), JSON.stringify({ cx, cy, ...FAR }));

  // --- Near tiles.
  const tiles = corridorTiles(pts, 1600);
  console.log(`Terrain proche : ${tiles.length} cases de 1 km`);
  let done = 0;
  const queue = [...tiles];
  const worker = async () => {
    for (;;) {
      const t = queue.shift();
      if (!t) return;
      const [i, j] = t;
      const x0 = i * TILE;
      const y0 = j * TILE;
      const h = DEM_STEP / 2;
      const demBox = [x0 - h, y0 - h, x0 + TILE + h, y0 + TILE + h];
      const name = `${i}_${j}`;
      await getBil('ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES', demBox, DEM_N, DEM_N, join(dir, `${name}.dem.bil`));
      await getBil('ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES.MNS', demBox, DEM_N, DEM_N, join(dir, `${name}.mns.bil`));
      await getJpeg([x0, y0, x0 + TILE, y0 + TILE], ORTHO_PX, ORTHO_PX, join(dir, `${name}.jpg`));
      if (++done % 10 === 0) console.log(`  ${done}/${tiles.length}`);
      await sleep(100);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  writeFileSync(join(dir, 'tiles.json'), JSON.stringify(tiles));
  console.log('IGN : terminé');
}
