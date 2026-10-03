import * as THREE from 'three';
import type { QualitySettings } from '../../core/quality';
import { decodeHeight, fetchGzip, parseTile, unpack, type AnnecyTrackData, type TileData } from './data';
import { buildBuildings, buildTrees } from './objects';
import { buildLandscape } from './landscape';

/**
 * Terrain streaming (SPEC §5: "streaming par zones obligatoire + LOD du terrain").
 *
 * The 1 km tiles around the camera are downloaded, decoded and meshed on demand, with three
 * levels of detail (4 m / 8 m / 20 m grid) and skirts hiding the cracks between levels; trees
 * and buildings are only built for nearby tiles. Tiles far away are released. Beyond the
 * streamed ring, a single low-resolution mesh (120 m grid, 48 km square) shows the mountains;
 * it is cut out (shader discard) wherever a detailed tile is on screen.
 */

interface Tile {
  i: number;
  j: number;
  /** Game coordinates of the west and north edges. */
  x0: number;
  z0: number;
  state: 'idle' | 'loading' | 'ready' | 'error';
  data: TileData | null;
  texture: THREE.Texture | null;
  material: THREE.MeshStandardMaterial | null;
  mesh: THREE.Mesh | null;
  stride: number;
  geos: Map<number, THREE.BufferGeometry>;
  objects: THREE.Group | null;
  dist: number;
}

const TILE = 1000;

/** Grey detail noise multiplied over the aerial photo near the camera (breaks the blur). */
function detailTexture(): THREE.Texture {
  const N = 256;
  const data = new Uint8Array(N * N * 4);
  const hash = (x: number, y: number) => {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x: number, y: number, f: number) => {
    const fx = (x / N) * f;
    const fy = (y / N) * f;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const u = fx - ix;
    const v = fy - iy;
    const w = (a: number, b: number) => hash(((a % f) + f) % f, ((b % f) + f) % f);
    const s = (t: number) => t * t * (3 - 2 * t);
    return (w(ix, iy) * (1 - s(u)) + w(ix + 1, iy) * s(u)) * (1 - s(v)) + (w(ix, iy + 1) * (1 - s(u)) + w(ix + 1, iy + 1) * s(u)) * s(v);
  };
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const v = noise(x, y, 8) * 0.45 + noise(x, y, 32) * 0.35 + hash(x, y) * 0.2;
      const k = (y * N + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = Math.round(v * 255);
      data[k + 3] = 255;
    }
  const t = new THREE.DataTexture(data, N, N);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

let sharedDetail: THREE.Texture | null = null;

/** Photo-textured ground: detail noise near the camera, slightly toned-down photo. */
function terrainMaterial(map: THREE.Texture | null): THREE.MeshStandardMaterial {
  sharedDetail ??= detailTexture();
  const detail = sharedDetail;
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.detailMap = { value: detail };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTerrainWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D detailMap;\nvarying vec3 vTerrainWorld;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          float camDist = length(vTerrainWorld - cameraPosition);
          float near = 1.0 - smoothstep(60.0, 450.0, camDist);
          float d = texture2D(detailMap, vTerrainWorld.xz / 7.0).r * 0.6 + texture2D(detailMap, vTerrainWorld.xz / 41.0).r * 0.4;
          diffuseColor.rgb *= mix(1.0, 0.62 + 0.76 * d, near);
          // Aerial photos are captured through haze: a little more contrast and saturation.
          float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = max(vec3(0.0), mix(vec3(l), diffuseColor.rgb, 1.2) * 0.84);
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'annecy-terrain';
  return mat;
}

/** Grid mesh of a tile at a given stride, with normals from the full-resolution heights. */
function tileGeometry(t: TileData, x0: number, z0: number, stride: number): THREE.BufferGeometry {
  const n = t.n;
  const step = t.step;
  const h = t.heights;
  const m = (n - 1) / stride + 1;
  const skirt = 4 * m;
  const pos = new Float32Array((m * m + skirt) * 3);
  const nrm = new Float32Array((m * m + skirt) * 3);
  const uv = new Float32Array((m * m + skirt) * 2);
  const H = (r: number, c: number) => h[Math.max(0, Math.min(n - 1, r)) * n + Math.max(0, Math.min(n - 1, c))];
  let v = 0;
  const put = (r: number, c: number, drop: number) => {
    pos[v * 3] = x0 + c * step;
    pos[v * 3 + 1] = H(r, c) - drop;
    pos[v * 3 + 2] = z0 + r * step;
    const dx = (H(r, c + 1) - H(r, c - 1)) / (2 * step);
    const dz = (H(r + 1, c) - H(r - 1, c)) / (2 * step);
    const l = Math.hypot(dx, 1, dz);
    nrm[v * 3] = -dx / l;
    nrm[v * 3 + 1] = 1 / l;
    nrm[v * 3 + 2] = -dz / l;
    uv[v * 2] = c / (n - 1);
    uv[v * 2 + 1] = r / (n - 1); // texture not flipped: row 0 (north) = top of the photo
    v++;
  };
  for (let r = 0; r < m; r++) for (let c = 0; c < m; c++) put(r * stride, c * stride, 0);
  const idx: number[] = [];
  for (let r = 0; r < m - 1; r++)
    for (let c = 0; c < m - 1; c++) {
      const a = r * m + c;
      idx.push(a, a + m, a + 1, a + 1, a + m, a + m + 1);
    }
  // Skirts: a vertical strip hanging below each edge hides cracks between levels of detail.
  const drop = 6 * stride;
  const edges: Array<Array<[number, number]>> = [
    Array.from({ length: m }, (_, k) => [0, k] as [number, number]),
    Array.from({ length: m }, (_, k) => [m - 1, k] as [number, number]),
    Array.from({ length: m }, (_, k) => [k, 0] as [number, number]),
    Array.from({ length: m }, (_, k) => [k, m - 1] as [number, number]),
  ];
  for (const e of edges) {
    const start = v;
    for (const [r, c] of e) put(r * stride, c * stride, drop);
    for (let k = 0; k < m - 1; k++) {
      const a = e[k][0] * m + e[k][1];
      const b = e[k + 1][0] * m + e[k + 1][1];
      // Both windings (skirts are seen from either side).
      idx.push(a, start + k, b, b, start + k, start + k + 1, a, b, start + k, b, start + k + 1, start + k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Decode an image off the main thread (no flip: geometry UVs account for it). */
async function loadTexture(url: string, maxAniso: number): Promise<THREE.Texture> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob());
  const t = new THREE.Texture(bitmap);
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

export interface FarTerrain {
  n: number;
  step: number;
  x: number;
  z: number;
  heights: Float32Array;
  texture: THREE.Texture;
}

export async function loadFar(base: string, maxAniso: number): Promise<FarTerrain> {
  const [buf, texture] = await Promise.all([fetchGzip(`${base}far.bin`), loadTexture(`${base}far.webp`, maxAniso)]);
  const { header, arrays } = unpack(buf);
  const raw = arrays.heights as Uint16Array;
  const heights = new Float32Array(raw.length);
  for (let k = 0; k < raw.length; k++) heights[k] = decodeHeight(raw[k]);
  return { n: header.n as number, step: header.step as number, x: header.x as number, z: header.z as number, heights, texture };
}

export class Terrain {
  readonly group = new THREE.Group();
  private readonly tiles: Tile[];
  private readonly byKey = new Map<string, Tile>();
  private readonly farMesh: THREE.Mesh;
  private readonly mask: THREE.DataTexture;
  private readonly maskData: Uint8Array;
  private readonly maskSize: number;
  private loading = 0;
  private timer = 0;
  private lod = { s0: 1, d0: 300, d1: 900, trees: 1300, buildings: 1900, treeDensity: 1, shadows: true };

  constructor(
    data: AnnecyTrackData,
    private readonly far: FarTerrain,
    private readonly base: string,
    private readonly maxAniso: number,
    quality: QualitySettings,
  ) {
    this.group.name = 'terrain';
    this.tiles = data.tile.list.map(([i, j, x0, z0]) => ({
      i,
      j,
      x0,
      z0,
      state: 'idle',
      data: null,
      texture: null,
      material: null,
      mesh: null,
      stride: 0,
      geos: new Map(),
      objects: null,
      dist: Infinity,
    }));
    for (const t of this.tiles) this.byKey.set(`${t.i}_${t.j}`, t);

    // Far terrain + mask of the detailed tiles (1 texel per km).
    this.maskSize = Math.round(((far.n - 1) * far.step) / TILE);
    this.maskData = new Uint8Array(this.maskSize * this.maskSize);
    this.mask = new THREE.DataTexture(this.maskData, this.maskSize, this.maskSize, THREE.RedFormat, THREE.UnsignedByteType);
    this.mask.magFilter = this.mask.minFilter = THREE.NearestFilter;
    this.mask.needsUpdate = true;
    this.farMesh = this.buildFar(quality.id === 'low' ? 2 : 1);
    this.group.add(this.farMesh);
    this.applyQuality(quality);
  }

  private buildFar(stride: number): THREE.Mesh {
    const f = this.far;
    const n = f.n;
    const m = (n - 1) / stride + 1;
    const pos = new Float32Array(m * m * 3);
    const uv = new Float32Array(m * m * 2);
    for (let r = 0; r < m; r++)
      for (let c = 0; c < m; c++) {
        const k = r * m + c;
        // Edge of the world: drop the rim so the horizon has no visible wall.
        const rim = Math.max(Math.abs(r / (m - 1) - 0.5), Math.abs(c / (m - 1) - 0.5)) > 0.497 ? 400 : 0;
        pos[k * 3] = f.x + c * stride * f.step;
        pos[k * 3 + 1] = f.heights[r * stride * n + c * stride] - 1.5 - rim;
        pos[k * 3 + 2] = f.z + r * stride * f.step;
        uv[k * 2] = c / (m - 1);
        uv[k * 2 + 1] = r / (m - 1);
      }
    const idx: number[] = [];
    for (let r = 0; r < m - 1; r++)
      for (let c = 0; c < m - 1; c++) {
        const a = r * m + c;
        idx.push(a, a + m, a + 1, a + 1, a + m, a + m + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: f.texture, roughness: 1 });
    const mask = this.mask;
    const origin = new THREE.Vector2(f.x, f.z);
    const size = this.maskSize;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.tileMask = { value: mask };
      shader.uniforms.maskOrigin = { value: origin };
      shader.uniforms.maskSize = { value: size };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFarWorld;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvFarWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D tileMask;\nuniform vec2 maskOrigin;\nuniform float maskSize;\nvarying vec3 vFarWorld;')
        .replace(
          'void main() {',
          `void main() {
          vec2 cell = (vFarWorld.xz - maskOrigin) / 1000.0;
          if (cell.x >= 0.0 && cell.y >= 0.0 && cell.x < maskSize && cell.y < maskSize) {
            if (texture2D(tileMask, (floor(cell) + 0.5) / maskSize).r > 0.5) discard;
          }`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          float lf = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = max(vec3(0.0), mix(vec3(lf), diffuseColor.rgb, 1.2) * 0.84);`,
        );
    };
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    return mesh;
  }

  private setMask(t: Tile, on: boolean): void {
    const col = Math.floor((t.x0 - this.far.x) / TILE + 0.5);
    const row = Math.floor((t.z0 - this.far.z) / TILE + 0.5);
    if (col < 0 || row < 0 || col >= this.maskSize || row >= this.maskSize) return;
    this.maskData[row * this.maskSize + col] = on ? 255 : 0;
    this.mask.needsUpdate = true;
  }

  applyQuality(q: QualitySettings): void {
    const table = {
      low: { s0: 2, d0: 250, d1: 700, trees: 700, buildings: 1200, treeDensity: 0.35, shadows: false },
      medium: { s0: 2, d0: 300, d1: 900, trees: 1000, buildings: 1600, treeDensity: 0.6, shadows: false },
      high: { s0: 1, d0: 300, d1: 1000, trees: 1300, buildings: 1900, treeDensity: 0.85, shadows: true },
      ultra: { s0: 1, d0: 450, d1: 1300, trees: 1700, buildings: 2300, treeDensity: 1, shadows: true },
    } as const;
    const changed = this.lod.treeDensity !== table[q.id].treeDensity;
    this.lod = { ...table[q.id] };
    if (changed) for (const t of this.tiles) this.dropObjects(t);
    this.timer = 0;
  }

  /** Ground height from the loaded tiles (null where no detailed tile is loaded). */
  heightAt(x: number, z: number): number | null {
    for (const t of this.tiles) {
      if (!t.data || x < t.x0 || x > t.x0 + TILE || z < t.z0 || z > t.z0 + TILE) continue;
      const d = t.data;
      const fc = Math.min(d.n - 1.001, (x - t.x0) / d.step);
      const fr = Math.min(d.n - 1.001, (z - t.z0) / d.step);
      const c = Math.floor(fc);
      const r = Math.floor(fr);
      const u = fc - c;
      const v = fr - r;
      const h = d.heights;
      const n = d.n;
      return (h[r * n + c] * (1 - u) + h[r * n + c + 1] * u) * (1 - v) + (h[(r + 1) * n + c] * (1 - u) + h[(r + 1) * n + c + 1] * u) * v;
    }
    return null;
  }

  private async load(t: Tile): Promise<void> {
    t.state = 'loading';
    this.loading++;
    try {
      const key = `${t.i}_${t.j}`;
      const [buf, tex] = await Promise.all([fetchGzip(`${this.base}t/${key}.bin`), loadTexture(`${this.base}t/${key}.webp`, this.maxAniso)]);
      t.data = parseTile(buf);
      t.texture = tex;
      t.state = 'ready';
    } catch (err) {
      console.warn(err);
      t.state = 'error';
    } finally {
      this.loading--;
    }
  }

  /** Load the tiles within `radius` of a point (before the start). */
  async preload(x: number, z: number, radius: number): Promise<void> {
    const near = this.tiles.filter((t) => this.distTo(t, x, z) < radius);
    await Promise.all(near.map((t) => (t.state === 'idle' ? this.load(t) : Promise.resolve())));
    this.timer = 0;
  }

  private distTo(t: Tile, x: number, z: number): number {
    const dx = Math.max(t.x0 - x, 0, x - (t.x0 + TILE));
    const dz = Math.max(t.z0 - z, 0, z - (t.z0 + TILE));
    return Math.hypot(dx, dz);
  }

  private dropObjects(t: Tile): void {
    if (!t.objects) return;
    t.objects.removeFromParent();
    t.objects.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    t.objects = null;
  }

  private unload(t: Tile): void {
    this.dropObjects(t);
    t.mesh?.removeFromParent();
    for (const g of t.geos.values()) g.dispose();
    t.geos.clear();
    t.mesh = null;
    t.material?.dispose();
    t.material = null;
    t.texture?.dispose();
    (t.texture?.image as ImageBitmap | undefined)?.close?.();
    t.texture = null;
    t.data = null;
    t.state = 'idle';
    t.stride = 0;
    this.setMask(t, false);
  }

  update(dt: number, cam: THREE.Vector3): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.25;
    const L = this.lod;
    for (const t of this.tiles) t.dist = this.distTo(t, cam.x, cam.z);
    const sorted = [...this.tiles].sort((a, b) => a.dist - b.dist);
    // Downloads: nearest first, three at a time.
    for (const t of sorted) {
      if (this.loading >= 3) break;
      if (t.state === 'idle' && t.dist < 2600) void this.load(t);
    }
    let built = 0;
    for (const t of sorted) {
      if (t.dist > 3400 && t.state === 'ready') {
        this.unload(t);
        continue;
      }
      if (t.state !== 'ready' || !t.data) continue;
      // Level of detail.
      const stride = t.dist < L.d0 ? L.s0 : t.dist < L.d1 ? Math.max(2, L.s0) : 5;
      if (stride !== t.stride && built < 2) {
        let g = t.geos.get(stride);
        if (!g) {
          g = tileGeometry(t.data, t.x0, t.z0, stride);
          t.geos.set(stride, g);
          built++;
        }
        if (!t.mesh) {
          t.material = terrainMaterial(t.texture);
          t.mesh = new THREE.Mesh(g, t.material);
          t.mesh.receiveShadow = true;
          this.group.add(t.mesh);
          this.setMask(t, true);
        } else t.mesh.geometry = g;
        t.stride = stride;
        // Keep only the current and the next finer level.
        for (const [s, geo] of t.geos) if (s !== stride && s !== Math.max(1, stride / 2)) {
          geo.dispose();
          t.geos.delete(s);
        }
      }
      // Trees and buildings near the camera.
      const wantObjects = t.dist < Math.max(L.trees, L.buildings);
      if (wantObjects && !t.objects && built < 2) {
        const g = new THREE.Group();
        const heightAt = (x: number, z: number) => this.heightAt(x, z) ?? 0;
        const parts = [
          ...(t.dist < L.buildings ? buildBuildings(t.data, t.x0, t.z0) : []),
          ...(t.dist < L.buildings ? buildLandscape(t.data, t.x0, t.z0, heightAt) : []),
          ...(t.dist < L.trees ? buildTrees(t.data, t.x0, t.z0, heightAt, L.treeDensity, L.shadows) : []),
        ];
        for (const p of parts) g.add(p);
        t.objects = g;
        this.group.add(g);
        built++;
      } else if (t.objects && t.dist > Math.max(L.trees, L.buildings) + 500) this.dropObjects(t);
    }
  }

  /** Tiles loaded / in view (debug overlay). */
  get stats(): { loaded: number; meshes: number } {
    return { loaded: this.tiles.filter((t) => t.state === 'ready').length, meshes: this.tiles.filter((t) => t.mesh).length };
  }

  dispose(): void {
    for (const t of this.tiles) if (t.state === 'ready') this.unload(t);
    this.farMesh.geometry.dispose();
    (this.farMesh.material as THREE.Material).dispose();
    this.far.texture.dispose();
    this.mask.dispose();
  }
}
