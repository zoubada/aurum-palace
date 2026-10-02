import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TileData } from './data';

/**
 * Trees and buildings of one terrain tile, from the real data:
 *  - trees: positions and heights from the IGN surface model, crown colour from the aerial
 *    photo, conifer / broadleaf from the crown brightness (instanced, two shapes);
 *  - buildings: OpenStreetMap footprints extruded to their measured height, hip roofs on
 *    houses, flat roofs on large buildings, roof colour from the photo, painted walls with
 *    windows drawn by the shader (one merged mesh per tile).
 */

const TILE = 1000;
const srgb = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

// -----------------------------------------------------------------------------
// Trees
// -----------------------------------------------------------------------------

function colorize(g: THREE.BufferGeometry, fn: (y: number) => [number, number, number]): THREE.BufferGeometry {
  const p = g.attributes.position;
  const c = new Float32Array(p.count * 3);
  for (let k = 0; k < p.count; k++) c.set(fn(p.getY(k)), k * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

/** Irregular crown with soft, sphere-like normals (no faceted look). */
function jitter(g: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry {
  const p = g.attributes.position;
  const nrm = new Float32Array(p.count * 3);
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k);
    const y = p.getY(k);
    const z = p.getZ(k);
    const l = Math.hypot(x, y, z) || 1;
    nrm.set([x / l, y / l, z / l], k * 3);
    // Same displacement for vertices at the same place (shared by several faces): no cracks.
    const qx = Math.round(x * 1000);
    const qy = Math.round(y * 1000);
    const qz = Math.round(z * 1000);
    const n = Math.sin(qx * 0.0371 + qy * 0.0173 + qz * 0.0237 + seed) * 0.5 + Math.sin(qx * 0.0117 - qz * 0.0291 + seed * 2) * 0.5;
    const r = 1 + n * amount;
    p.setXYZ(k, x * r, y * r, z * r);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return g;
}

let treeGeos: { conifer: THREE.BufferGeometry; broadleaf: THREE.BufferGeometry } | null = null;
let treeMat: THREE.MeshStandardMaterial | null = null;

/** Unit-height tree shapes (base at the origin). Trunk darker, crown darker at the bottom. */
function trees(): { conifer: THREE.BufferGeometry; broadleaf: THREE.BufferGeometry } {
  if (treeGeos) return treeGeos;
  const trunk = (r: number, h: number) => colorize(new THREE.CylinderGeometry(r * 0.7, r, h, 5, 1).translate(0, h / 2, 0), () => [0.42, 0.34, 0.26]);
  const shade = (y0: number, y1: number) => (y: number): [number, number, number] => {
    const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    const v = 0.62 + 0.5 * t;
    return [v, v, v];
  };
  const cone = (r: number, h: number, y: number) => colorize(new THREE.ConeGeometry(r, h, 7, 1, true).translate(0, y + h / 2, 0), shade(0.15, 1));
  const conifer = mergeGeometries([trunk(0.022, 0.22), cone(0.2, 0.46, 0.16), cone(0.155, 0.38, 0.4), cone(0.1, 0.3, 0.64), cone(0.05, 0.14, 0.88)])!;
  const crown = jitter(new THREE.IcosahedronGeometry(0.29, 1), 0.18, 3.1).scale(1, 0.85, 1).translate(0, 0.62, 0);
  const crown2 = jitter(new THREE.IcosahedronGeometry(0.17, 1), 0.2, 7.7).translate(0.12, 0.8, 0.06);
  const flat = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
  const broadleaf = mergeGeometries([trunk(0.03, 0.45), colorize(crown, shade(0.35, 0.9)), colorize(crown2, shade(0.6, 0.97))].map(flat))!;
  treeGeos = { conifer: flat(conifer), broadleaf };
  return treeGeos;
}

function treeMaterial(): THREE.MeshStandardMaterial {
  treeMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  return treeMat;
}

export function buildTrees(
  t: TileData,
  x0: number,
  z0: number,
  heightAt: (x: number, z: number) => number,
  density: number,
  shadows: boolean,
): THREE.Object3D[] {
  const g = trees();
  const T = t.trees;
  const pick: number[][] = [[], []];
  for (let k = 0; k < T.x.length; k++) {
    // Deterministic thinning for the lower quality presets.
    const h = Math.sin(k * 12.9898 + t.i * 78.233 + t.j * 37.719) * 43758.5453;
    if (h - Math.floor(h) < density) pick[T.type[k]].push(k);
  }
  const out: THREE.Object3D[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  for (const type of [0, 1]) {
    const list = pick[type];
    if (!list.length) continue;
    const inst = new THREE.InstancedMesh(type ? g.conifer : g.broadleaf, treeMaterial(), list.length);
    list.forEach((k, n) => {
      const x = x0 + T.x[k] / 10;
      const z = z0 + TILE - T.z[k] / 10;
      const h = T.h[k] / 6;
      const w = type ? h * (0.85 + 0.3 * ((k * 0.618) % 1)) : Math.min(h, 16) * (0.9 + 0.35 * ((k * 0.382) % 1));
      p.set(x, heightAt(x, z) - 0.3, z);
      q.setFromAxisAngle(up, k * 2.39996);
      s.set(w, h, w);
      inst.setMatrixAt(n, m.compose(p, q, s));
      // Crown colour from the photo (sunlit side brighter than seen from above); where the photo
      // shows something else (roof, road, shadow-free glare), a plausible green instead.
      const R = T.rgb[k * 3];
      const G = T.rgb[k * 3 + 1];
      const Bl = T.rgb[k * 3 + 2];
      const luma = 0.3 * R + 0.59 * G + 0.11 * Bl;
      if (luma > 140 || G < R * 0.92 || G < Bl * 0.9) {
        const v = 0.75 + 0.5 * ((k * 0.754) % 1);
        if (type) c.setRGB(0.035 * v, 0.075 * v, 0.04 * v);
        else c.setRGB(0.07 * v, 0.13 * v, 0.045 * v);
      } else c.setRGB(srgb(R) * 1.0, srgb(G) * 1.08, srgb(Bl) * 0.9);
      inst.setColorAt(n, c);
    });
    inst.castShadow = shadows;
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    out.push(inst);
  }
  return out;
}

// -----------------------------------------------------------------------------
// Buildings
// -----------------------------------------------------------------------------

let buildingMat: THREE.MeshStandardMaterial | null = null;

/** Walls with windows computed from facade coordinates (uv = metres along / above); roofs u < 0. */
function buildingMaterial(): THREE.MeshStandardMaterial {
  if (buildingMat) return buildingMat;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 facade;\nvarying vec2 vFacade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFacade = facade;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFacade;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float glass = 0.0;
        if (vFacade.x >= 0.0 && vFacade.y > 1.2) {
          vec2 cell = vec2(vFacade.x / 2.7, (vFacade.y - 0.4) / 2.9);
          vec2 f = fract(cell);
          float win = step(0.33, f.x) * step(f.x, 0.69) * step(0.36, f.y) * step(f.y, 0.8);
          // Some walls without windows (gables, blind walls).
          float h = fract(sin(dot(floor(cell), vec2(12.9898, 78.233))) * 43758.5453);
          win *= step(0.12, h);
          // Shutters: wooden frames each side of the windows on some houses.
          float shutter = (step(0.23, f.x) * step(f.x, 0.33) + step(0.69, f.x) * step(f.x, 0.79)) * step(0.36, f.y) * step(f.y, 0.8) * step(0.55, fract(h * 7.1));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.22, 0.14), shutter * 0.85);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.06, 0.07), win);
          glass = win;
        }`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, glass);');
  };
  buildingMat = mat;
  return mat;
}

export function buildBuildings(t: TileData, x0: number, z0: number): THREE.Object3D[] {
  const B = t.buildings;
  if (!B.count.length) return [];
  const pos: number[] = [];
  const col: number[] = [];
  const fac: number[] = [];
  const pushTri = (a: number[], b: number[], c: number[], color: [number, number, number], fa: number[], fb: number[], fc: number[]) => {
    pos.push(...a, ...b, ...c);
    col.push(...color, ...color, ...color);
    fac.push(...fa, ...fb, ...fc);
  };
  const NOFAC = [-1, -1];
  /** Triangle facing up (dir = 1) or down (dir = −1), whatever the input order. */
  const pushFacing = (a: number[], b: number[], c: number[], color: [number, number, number], dir: number) => {
    const ux = b[0] - a[0];
    const uz = b[2] - a[2];
    const wx = c[0] - a[0];
    const wz = c[2] - a[2];
    const ny = uz * wx - ux * wz;
    if (ny * dir >= 0) pushTri(a, b, c, color, NOFAC, NOFAC, NOFAC);
    else pushTri(a, c, b, color, NOFAC, NOFAC, NOFAC);
  };
  let v = 0;
  for (let k = 0; k < B.count.length; k++) {
    const n = B.count[k];
    const wallH = B.info[k * 4] / 10;
    const roofH = B.info[k * 4 + 1] / 10;
    const base = B.info[k * 4 + 2] / 10;
    const roof: [number, number, number] = [srgb(B.color[k * 6]) * 1.1, srgb(B.color[k * 6 + 1]) * 1.1, srgb(B.color[k * 6 + 2]) * 1.1];
    const wall: [number, number, number] = [srgb(B.color[k * 6 + 3]), srgb(B.color[k * 6 + 4]), srgb(B.color[k * 6 + 5])];
    let ring: Array<[number, number]> = [];
    for (let q = 0; q < n; q++) ring.push([x0 + B.verts[(v + q) * 2] / 10, z0 + TILE - B.verts[(v + q) * 2 + 1] / 10]);
    v += n;
    // Counter-clockwise seen from above (x east, z south) so wall normals face outwards.
    let area = 0;
    for (let q = 0; q < n; q++) {
      const [ax, az] = ring[q];
      const [bx, bz] = ring[(q + 1) % n];
      area += ax * bz - bx * az;
    }
    if (area > 0) ring = ring.reverse();
    const y0 = base - 1;
    const y1 = base + wallH;
    // Walls.
    let along = 0;
    for (let q = 0; q < n; q++) {
      const [ax, az] = ring[q];
      const [bx, bz] = ring[(q + 1) % n];
      const len = Math.hypot(bx - ax, bz - az);
      const A0 = [ax, y0, az];
      const B0 = [bx, y0, bz];
      const A1 = [ax, y1, az];
      const B1 = [bx, y1, bz];
      const fA0 = [along, -1];
      const fB0 = [along + len, -1];
      const fA1 = [along, wallH + 1];
      const fB1 = [along + len, wallH + 1];
      pushTri(A0, B0, B1, wall, fA0, fB0, fB1);
      pushTri(A0, B1, A1, wall, fA0, fB1, fA1);
      along += len + 1.3;
    }
    // Roof.
    let cx = 0;
    let cz = 0;
    for (const [x, z] of ring) {
      cx += x / n;
      cz += z / n;
    }
    if (roofH > 0.2) {
      // Hip roof: eaves overhang, slopes up to a small ridge polygon.
      const eave = ring.map(([x, z]) => {
        const dx = x - cx;
        const dz = z - cz;
        const l = Math.hypot(dx, dz) || 1;
        return [x + (dx / l) * 0.45, y1 - 0.1, z + (dz / l) * 0.45];
      });
      const ridge = ring.map(([x, z]) => [cx + (x - cx) * 0.16, y1 + roofH, cz + (z - cz) * 0.16]);
      for (let q = 0; q < n; q++) {
        const r = (q + 1) % n;
        pushFacing(eave[q], eave[r], ridge[r], roof, 1);
        pushFacing(eave[q], ridge[r], ridge[q], roof, 1);
        // Underside of the overhang.
        const under: [number, number, number] = [wall[0] * 0.6, wall[1] * 0.6, wall[2] * 0.6];
        pushFacing(eave[r], eave[q], [ring[q][0], y1 - 0.1, ring[q][1]], under, -1);
        pushFacing(eave[r], [ring[q][0], y1 - 0.1, ring[q][1]], [ring[r][0], y1 - 0.1, ring[r][1]], under, -1);
      }
      const tris = THREE.ShapeUtils.triangulateShape(ridge.map((p) => new THREE.Vector2(p[0], p[2])), []);
      for (const [a, b, c] of tris) pushFacing(ridge[a], ridge[b], ridge[c], roof, 1);
    } else {
      const top = ring.map(([x, z]) => [x, y1, z]);
      const tris = THREE.ShapeUtils.triangulateShape(ring.map(([x, z]) => new THREE.Vector2(x, z)), []);
      for (const [a, b, c] of tris) pushFacing(top[a], top[b], top[c], roof, 1);
      // Parapet.
      for (let q = 0; q < n; q++) {
        const [ax, az] = ring[q];
        const [bx, bz] = ring[(q + 1) % n];
        pushTri([ax, y1, az], [bx, y1, bz], [bx, y1 + 0.5, bz], wall, NOFAC, NOFAC, NOFAC);
        pushTri([ax, y1, az], [bx, y1 + 0.5, bz], [ax, y1 + 0.5, az], wall, NOFAC, NOFAC, NOFAC);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('facade', new THREE.Float32BufferAttribute(fac, 2));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, buildingMaterial());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return [mesh];
}
