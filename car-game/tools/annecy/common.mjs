/**
 * Shared settings for the Annecy circuit tools (SPEC §5, circuit 2).
 *
 * Data sources (all open data):
 *  - OpenStreetMap (ODbL) through an Overpass API mirror, or the OSM editing API as a fallback;
 *  - IGN Géoplateforme (Licence Ouverte 2.0): RGE ALTI elevation (WMS, raw float32 BIL) and
 *    BD ORTHO aerial photographs (WMS).
 * Everything is downloaded once into tools/cache/annecy (git-ignored) and converted by
 * build.mjs into car-game/assets/tracks/annecy.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import proj4 from 'proj4';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CACHE = join(ROOT, 'tools', 'cache', 'annecy');
export const OUT = join(ROOT, 'assets', 'tracks', 'annecy');
mkdirSync(CACHE, { recursive: true });

/** Lake and both shores, WGS84 (lat/lon). */
export const BBOX = { south: 45.765, west: 6.085, north: 45.93, east: 6.29 };

/** Lambert-93 (EPSG:2154), the IGN projection: metres, x east, y north. */
proj4.defs('EPSG:2154', '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
const toL93 = proj4('EPSG:4326', 'EPSG:2154');
export const lonLatToL93 = (lon, lat) => toL93.forward([lon, lat]);
export const l93ToLonLat = (x, y) => toL93.inverse([x, y]);

/** Lake surface (m, IGN). */
export const LAKE_LEVEL = 446.97;

export const OVERPASS = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter'];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch with retries and exponential back-off. */
export async function fetchRetry(url, opts = {}, tries = 4) {
  let delay = 2000;
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(opts.timeout ?? 240000) });
      if (res.ok) return res;
      if (i >= tries - 1 || (res.status < 500 && res.status !== 429)) throw new Error(`${res.status} ${res.statusText} for ${url.slice(0, 120)}`);
    } catch (err) {
      if (i >= tries - 1) throw err;
    }
    await sleep(delay);
    delay *= 2;
  }
}

/** Overpass query with mirrors; result cached by name. */
export async function overpass(name, query) {
  const file = join(CACHE, 'osm', `${name}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  mkdirSync(dirname(file), { recursive: true });
  let lastErr;
  for (const url of OVERPASS) {
    try {
      const res = await fetchRetry(url, { method: 'POST', body: new URLSearchParams({ data: query }), timeout: 300000 }, 3);
      const text = await res.text();
      const json = JSON.parse(text);
      if (json.remark && /error|timeout/i.test(json.remark)) throw new Error(json.remark);
      writeFileSync(file, text);
      return json;
    } catch (err) {
      lastErr = err;
      console.warn(`  overpass ${url.slice(8, 30)}… failed: ${err.message}`);
    }
  }
  throw lastErr;
}

export function readJSON(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;
}
