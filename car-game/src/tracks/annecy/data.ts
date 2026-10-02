import type { ControlPoint } from '../TrackSpline';

/**
 * Data of the Annecy circuit, produced by tools/annecy/3-build.mjs from OpenStreetMap and IGN
 * open data (see assets/tracks/annecy). Pure parsing / loading code (also used by the tests).
 */

export interface AnnecyVariant {
  id: string;
  name: string;
  /** Start and finish, distances along the lap (m). */
  from: number;
  to: number;
}

export interface AnnecyTrackData {
  name: string;
  source: string;
  origin: { x: number; y: number; crs: string; lakeLevel: number };
  length: number;
  /** [x, z, y, half-width, run-off, bank°, bridge(0/1)] */
  controlPoints: Array<[number, number, number, number, number, number, number]>;
  sectors: number[];
  variants: AnnecyVariant[];
  waypoints: Array<{ name: string; s: number }>;
  lake: { outer: Array<Array<[number, number]>>; inner: Array<Array<[number, number]>> };
  signs: Array<{ s: number; name: string; entering: boolean }>;
  /** Tiles: [i, j, x of the west edge, z of the north edge] (game coordinates). */
  tile: { size: number; step: number; n: number; list: Array<[number, number, number, number]> };
}

export function annecyControlPoints(d: AnnecyTrackData): ControlPoint[] {
  return d.controlPoints.map(([x, z, y, w, runoff, bank, bridge]) => ({ x, z, y, w, runoff, bank, zone: bridge ? 'bridge' : 'street' }));
}

/** One 1 km terrain tile: heights every `step` m, trees, buildings. */
export interface TileData {
  i: number;
  j: number;
  n: number;
  step: number;
  /** Heights (m above the lake), row 0 = north edge, column 0 = west edge. */
  heights: Float32Array;
  trees: { x: Uint16Array; z: Uint16Array; h: Uint8Array; type: Uint8Array; rgb: Uint8Array };
  buildings: { count: Uint16Array; info: Int16Array; color: Uint8Array; verts: Int16Array };
}

type ArrayCtor = Uint8ArrayConstructor | Uint16ArrayConstructor | Int16ArrayConstructor | Float32ArrayConstructor | Uint32ArrayConstructor;
const CTORS: Record<string, ArrayCtor> = { Uint8Array, Uint16Array, Int16Array, Float32Array, Uint32Array };

/** Container written by the build tool: u32 header length, JSON header, aligned arrays. */
export function unpack(buf: ArrayBuffer): { header: Record<string, unknown>; arrays: Record<string, ArrayLike<number>> } {
  const len = new DataView(buf).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, len))) as Record<string, unknown> & {
    arrays: Record<string, { type: string; offset: number; length: number }>;
  };
  const base = 4 + len;
  const arrays: Record<string, ArrayLike<number>> = {};
  for (const [name, e] of Object.entries(header.arrays)) {
    const Ctor = CTORS[e.type];
    arrays[name] = new Ctor(buf.slice(base + e.offset, base + e.offset + e.length * Ctor.BYTES_PER_ELEMENT));
  }
  return { header, arrays };
}

/** Base64 text → bytes. */
function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const bin = atob(text.trim());
  const out = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) out[k] = bin.charCodeAt(k);
  return out;
}

/**
 * Fetch a gzip-compressed binary file (decompressed in the browser). Hosts that only serve text
 * get the same bytes in base64 (`<file>.txt`, flag `__BIN_AS_TEXT__` set by the single-file build).
 */
export async function fetchGzip(url: string): Promise<ArrayBuffer> {
  const asText = typeof window !== 'undefined' && (window as unknown as { __BIN_AS_TEXT__?: boolean }).__BIN_AS_TEXT__;
  const res = await fetch(asText ? `${url}.txt` : url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const raw = asText ? fromBase64(await res.text()).buffer : await res.arrayBuffer();
  const head = new Uint8Array(raw, 0, 2);
  if (head[0] !== 0x1f || head[1] !== 0x8b) return raw; // already decompressed by the server
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

export const decodeHeight = (v: number) => v / 10 - 200;

export function parseTile(buf: ArrayBuffer): TileData {
  const { header, arrays: a } = unpack(buf);
  const raw = a.heights as Uint16Array;
  const heights = new Float32Array(raw.length);
  for (let k = 0; k < raw.length; k++) heights[k] = decodeHeight(raw[k]);
  return {
    i: header.i as number,
    j: header.j as number,
    n: header.n as number,
    step: header.step as number,
    heights,
    trees: { x: a.treeX as Uint16Array, z: a.treeZ as Uint16Array, h: a.treeH as Uint8Array, type: a.treeType as Uint8Array, rgb: a.treeRGB as Uint8Array },
    buildings: { count: a.bCount as Uint16Array, info: a.bInfo as Int16Array, color: a.bColor as Uint8Array, verts: a.bVerts as Int16Array },
  };
}

/** Where the circuit files live (copied next to the game by the build). */
export const ANNECY_BASE = 'assets/tracks/annecy/';
