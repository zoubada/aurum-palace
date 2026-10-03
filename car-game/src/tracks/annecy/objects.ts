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

/** Facade styles (tools/annecy/buildings.mjs). */
const STYLE = { HOUSE: 0, APARTMENTS: 1, SHOPS: 2, OLD_TOWN: 3, CHALET: 4, STONE: 5, INDUSTRIAL: 6 };
const ROOF = { FLAT: 0, GABLE: 1, HIP: 2 };

let buildingMat: THREE.MeshStandardMaterial | null = null;
const nightUniform = { value: 0 };

/** Evening / night: share of lit windows (0 = day). */
export function setBuildingLights(v: number): void {
  nightUniform.value = v;
}

/**
 * One material for every building. Per vertex: colour, `facade` = (window column, metres above
 * the base) on walls, (-2, metres down the slope) on tiled roofs, (-3, 0) on flat roofs, and
 * `fstyle` = (style, columns on this wall, floor height, shops on the ground floor).
 * The shader draws the facade: windows with frames and sills, shutters, shop fronts with
 * awnings, chalet timber and balconies, apartment balconies, stone courses, metal cladding,
 * roof tiles — and lights some windows in the evening.
 */
function buildingMaterial(): THREE.MeshStandardMaterial {
  if (buildingMat) return buildingMat;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = nightUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 facade;\nattribute vec4 fstyle;\nvarying vec2 vFacade;\nvarying vec4 vStyle;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFacade = facade;\nvStyle = fstyle;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uNight;
        varying vec2 vFacade;
        varying vec4 vStyle;
        float bHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float box2(vec2 f, vec2 a, vec2 b) { return step(a.x, f.x) * step(f.x, b.x) * step(a.y, f.y) * step(f.y, b.y); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float glass = 0.0;
        float lit = 0.0;
        if (vFacade.x > -1.5) {
          // ---- Walls.
          // Interpolated per-building values, rounded: the hashes below must not see the
          // interpolation's float noise (it would turn into per-pixel speckle).
          float style = floor(vStyle.x + 0.5);
          float cols = floor(vStyle.y + 0.5);
          float fh = max(floor(vStyle.z * 100.0 + 0.5) / 100.0, 2.5);
          vec2 key = vec2(style, cols) + vec2(fh * 3.7, floor(vStyle.w * 1000.0 + 0.5) * 0.37);
          float shops = vStyle.w;
          float col = floor(vFacade.x);
          float fx = fract(vFacade.x);
          float y = vFacade.y;
          float row = floor(y / fh);
          float fy = fract(y / fh);
          float inCol = step(0.0, vFacade.x) * step(col, cols - 1.0);
          float h = bHash(vec2(col, row) + key * 7.3);
          vec3 base = diffuseColor.rgb;
          // Plinth.
          diffuseColor.rgb = mix(diffuseColor.rgb, base * 0.72, step(y, 0.45));
          bool ground = row < 0.5 && y > 0.45;
          if (style > 5.5) {
            // Industrial: ribbed cladding, a band of high windows.
            diffuseColor.rgb *= 0.9 + 0.1 * step(0.5, fract(vFacade.x * 4.0));
            float band = step(fh * 0.55, mod(y, fh * 2.0)) * step(mod(y, fh * 2.0), fh * 0.8) * step(1.0, y) * inCol;
            glass = band * step(0.15, fx) * step(fx, 0.85);
          } else if (ground && shops > 0.5) {
            // Shop front: wide glazing, frame, awning on some.
            float win = inCol * box2(vec2(fx, y), vec2(0.06, 0.35), vec2(0.94, 2.75));
            glass = win;
            float awning = inCol * step(2.85, y) * step(y, 3.25) * step(0.45, h);
            vec3 aw = mix(vec3(0.45, 0.08, 0.07), vec3(0.1, 0.25, 0.18), step(0.7, h));
            diffuseColor.rgb = mix(diffuseColor.rgb, aw, awning);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.12, 0.13), inCol * (1.0 - win) * box2(vec2(fx, y), vec2(0.03, 0.3), vec2(0.97, 2.8)));
          } else {
            // Windows (narrow and tall for stone, wide for apartments).
            vec2 wa = style > 4.5 ? vec2(0.36, 0.25) : style > 0.5 && style < 1.5 ? vec2(0.18, 0.3) : vec2(0.3, 0.3);
            vec2 wb = style > 4.5 ? vec2(0.64, 0.88) : style > 0.5 && style < 1.5 ? vec2(0.82, 0.86) : vec2(0.7, 0.84);
            float blind = step(h, style > 0.5 && style < 1.5 ? 0.04 : 0.12);
            float win = inCol * (1.0 - blind) * box2(vec2(fx, fy), wa, wb) * step(0.6, y);
            float frame = inCol * (1.0 - blind) * box2(vec2(fx, fy), wa - vec2(0.04, 0.04), wb + vec2(0.04, 0.03)) * (1.0 - win) * step(0.6, y);
            float sill = inCol * (1.0 - blind) * box2(vec2(fx, fy), vec2(wa.x - 0.05, wa.y - 0.07), vec2(wb.x + 0.05, wa.y - 0.02)) * step(0.6, y);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.92, 0.9), max(frame, sill) * 0.85);
            if (style < 0.5 || (style > 2.5 && style < 4.5)) {
              // Shutters (houses, old town, chalets): green, grey-blue, brown or white.
              float sh = inCol * (1.0 - blind) * step(0.4, fract(h * 5.3)) * (box2(vec2(fx, fy), vec2(wa.x - 0.17, wa.y), vec2(wa.x - 0.03, wb.y)) + box2(vec2(fx, fy), vec2(wb.x + 0.03, wa.y), vec2(wb.x + 0.17, wb.y))) * step(0.6, y);
              float pick = fract(bHash(key + vec2(3.1, 1.7)) * 4.0);
              vec3 shc = pick < 0.25 ? vec3(0.22, 0.32, 0.22) : pick < 0.5 ? vec3(0.42, 0.48, 0.52) : pick < 0.75 ? vec3(0.38, 0.25, 0.15) : vec3(0.85, 0.84, 0.8);
              diffuseColor.rgb = mix(diffuseColor.rgb, shc * (0.9 + 0.2 * step(0.5, fract(fy * 9.0))), sh);
            }
            if (style > 3.5 && style < 4.5 && row > 0.5) {
              // Chalet: timber upper floors, balcony rail at the floor line.
              vec3 wood = vec3(0.36, 0.22, 0.12) * (0.85 + 0.15 * step(0.5, fract(y * 5.0)));
              diffuseColor.rgb = mix(diffuseColor.rgb, wood, (1.0 - win) * (1.0 - frame));
              float rail = step(0.0, fy) * step(fy, 0.3) * step(0.5, fract(vFacade.x * 6.0) + 0.3);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.28, 0.17, 0.09), rail);
            }
            if (style > 0.5 && style < 1.5 && row > 0.5) {
              // Apartments: balcony slab and railing under each window row.
              float slab = step(0.0, fy) * step(fy, 0.07);
              float railing = step(0.07, fy) * step(fy, 0.3) * inCol;
              diffuseColor.rgb = mix(diffuseColor.rgb, base * 1.08, slab);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.21, 0.22), railing * 0.55);
            }
            if (style > 4.5 && style < 5.5) {
              // Stone: courses and blocks.
              float course = step(0.92, fract(y / 0.45));
              float joint = step(0.95, fract(vFacade.x * 3.0 + floor(y / 0.45) * 0.5));
              diffuseColor.rgb *= 0.88 + 0.16 * bHash(floor(vec2(vFacade.x * 3.0, y / 0.45)));
              diffuseColor.rgb = mix(diffuseColor.rgb, base * 0.7, max(course, joint) * (1.0 - win));
            }
            glass = win;
          }
          // Glass: dark with a sky tint; some windows lit in the evening.
          lit = glass * step(1.0 - 0.45 * uNight, bHash(vec2(col * 1.7, row * 3.1) + key)) * uNight;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.075, 0.09), glass);
        } else if (vFacade.x > -2.5) {
          // Tiled roof: courses down the slope, slight tile-to-tile variation.
          float r = fract(vFacade.y / 0.32);
          diffuseColor.rgb *= 0.86 + 0.14 * smoothstep(0.0, 0.25, r);
          diffuseColor.rgb *= 0.94 + 0.12 * bHash(vec2(floor(vFacade.y / 0.32), floor(vStyle.y + 0.5)));
        } else {
          // Flat roof: gravel / membrane.
          diffuseColor.rgb *= 0.9 + 0.1 * bHash(floor(vViewPosition.xy * 3.0));
        }`,
      )
      
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += lit * vec3(1.0, 0.72, 0.42) * 1.6;');
  };
  buildingMat = mat;
  return mat;
}

interface BuildingGeo {
  pos: number[];
  col: number[];
  fac: number[];
  sty: number[];
}

/** Wall quad / triangle helpers writing the facade attributes. */
function geoWriter(g: BuildingGeo) {
  const tri = (a: number[], b: number[], c: number[], color: number[], fa: number[], fb: number[], fc: number[], st: number[]) => {
    g.pos.push(...a, ...b, ...c);
    g.col.push(...color, ...color, ...color);
    g.fac.push(...fa, ...fb, ...fc);
    g.sty.push(...st, ...st, ...st);
  };
  /** Triangle facing up (dir 1) / down (−1) whatever the input order. */
  const facing = (a: number[], b: number[], c: number[], color: number[], fa: number[], fb: number[], fc: number[], st: number[], dir: number) => {
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (ny * dir >= 0) tri(a, b, c, color, fa, fb, fc, st);
    else tri(a, c, b, color, fa, fc, fb, st);
  };
  return { tri, facing };
}

const FLATROOF = [-3, 0];

/**
 * Roof colour: the aerial photo's average is washed out by the sun and the haze, so it only
 * picks the material — reddish → brown/red tiles, else grey slate / zinc (Savoie) — and nudges
 * its shade; flat roofs are grey gravel or membrane.
 */
function roofColour(r: number, g: number, b: number, flat: boolean, k: number): number[] {
  const v = ((k * 0.754877) % 1) - 0.5;
  let base: number[];
  if (flat) base = [0.3 + v * 0.08, 0.3 + v * 0.08, 0.3 + v * 0.07];
  else if (r > b * 1.12 && r > g * 1.04) base = [0.36 + v * 0.1, 0.19 + v * 0.05, 0.13 + v * 0.03];
  else base = [0.2 + v * 0.06, 0.21 + v * 0.06, 0.23 + v * 0.06];
  return [base[0] * 0.5 + r * 0.06, base[1] * 0.5 + g * 0.06, base[2] * 0.5 + b * 0.06];
}

interface RectRoof {
  cx: number;
  cz: number;
  /** Ridge direction (unit, game x/z). */
  dx: number;
  dz: number;
  /** Half extents along / across the ridge. */
  L: number;
  W: number;
  y1: number;
  top: number;
  type: number;
  roof: number[];
  wall: number[];
  eave: number;
  st: number[];
}

/** Measured gable or hip roof on the footprint's rectangle, with overhanging eaves. */
function buildRectRoof(g: BuildingGeo, r: RectRoof): void {
  const { tri, facing } = geoWriter(g);
  const { cx, cz, dx, dz, y1, top, roof, wall, eave, st } = r;
  const lx = -dz;
  const lz = dx;
  const W = Math.max(0.5, r.W);
  const L = Math.max(0.5, r.L);
  const rise = top - y1;
  const over = 0.4;
  const drop = (rise * over) / W;
  const ye = y1 - drop;
  const P = (a: number, c: number, y: number) => [cx + dx * a + lx * c, y, cz + dz * a + lz * c];
  const slope = Math.hypot(W + over, rise + drop);
  const E = [-2, slope];
  const T = [-2, 0];
  /** Vertical triangle facing (nx, nz). */
  const outward = (a: number[], b: number[], c: number[], nx: number, nz: number, fa: number[], fb: number[], fc: number[]) => {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cxn = e1[1] * e2[2] - e1[2] * e2[1];
    const czn = e1[0] * e2[1] - e1[1] * e2[0];
    if (cxn * nx + czn * nz >= 0) tri(a, b, c, wall, fa, fb, fc, st);
    else tri(a, c, b, wall, fa, fc, fb, st);
  };
  if (r.type === ROOF.HIP) {
    const h = Math.max(0, L - W);
    const Lo = L + over;
    for (const s of [-1, 1]) {
      // Long slopes (trapezoids).
      facing(P(-Lo, s * (W + over), ye), P(Lo, s * (W + over), ye), P(h, 0, top), roof, E, E, T, st, 1);
      facing(P(-Lo, s * (W + over), ye), P(h, 0, top), P(-h, 0, top), roof, E, T, T, st, 1);
      // Hip ends.
      facing(P(s * Lo, -(W + over), ye), P(s * Lo, W + over, ye), P(s * h, 0, top), roof, E, E, T, st, 1);
    }
    return;
  }
  // Gable: two slopes and the two gable walls.
  const La = L + 0.35;
  for (const s of [-1, 1]) {
    facing(P(-La, s * (W + over), ye), P(La, s * (W + over), ye), P(La, 0, top), roof, E, E, T, st, 1);
    facing(P(-La, s * (W + over), ye), P(La, 0, top), P(-La, 0, top), roof, E, T, T, st, 1);
    outward(P(s * L, -W, y1), P(s * L, W, y1), P(s * L, 0, top), s * dx, s * dz, [-1, eave], [-1, eave], [-1, eave + rise]);
  }
}


export function buildBuildings(t: TileData, x0: number, z0: number): THREE.Object3D[] {
  const B = t.buildings;
  if (!B.count.length) return [];
  const g: BuildingGeo = { pos: [], col: [], fac: [], sty: [] };
  const { tri, facing } = geoWriter(g);
  let v = 0;
  for (let k = 0; k < B.count.length; k++) {
    const n = B.count[k];
    const I = B.info.subarray(k * 8, k * 8 + 8);
    const eave = I[0] / 10;
    const rise = I[1] / 10;
    const base = I[2] / 10;
    const type = I[3];
    const style = I[4];
    const floors = Math.max(1, I[5]);
    const fill = I[6] / 100;
    const shops = I[7];
    const R = B.rect.subarray(k * 5, k * 5 + 5);
    const wall = [srgb(B.color[k * 6 + 3]) * 0.86, srgb(B.color[k * 6 + 4]) * 0.86, srgb(B.color[k * 6 + 5]) * 0.86];
    const roof = roofColour(srgb(B.color[k * 6]), srgb(B.color[k * 6 + 1]), srgb(B.color[k * 6 + 2]), I[3] === ROOF.FLAT || I[1] < 3, k);
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
    const y1 = base + eave;
    // Floor height so that the floors fill the walls (windows line up from the ground up).
    const fh = Math.max(2.6, Math.min(4.2, eave / floors));
    const colW = style === STYLE.APARTMENTS ? 3.2 : style === STYLE.SHOPS || style === STYLE.INDUSTRIAL ? 4 : 2.9;
    // Per-building variation, a whole number of thousandths (the shader rounds it back).
    const seed = Math.floor(((k * 0.6180339) % 1) * 997);
    // ---- Walls: the windows are centred on each wall (whole columns only).
    for (let q = 0; q < n; q++) {
      const [ax, az] = ring[q];
      const [bx, bz] = ring[(q + 1) % n];
      const len = Math.hypot(bx - ax, bz - az);
      const cols = Math.floor(len / colW);
      const off = (len - cols * colW) / 2;
      const ua = -off / colW;
      const ub = (len - off) / colW;
      const st = [style, cols, Math.round(fh * 100) / 100, shops + seed * 0.001];
      tri([ax, y0, az], [bx, y0, bz], [bx, y1, bz], wall, [ua, -1], [ub, -1], [ub, eave], st);
      tri([ax, y0, az], [bx, y1, bz], [ax, y1, az], wall, [ua, -1], [ub, eave], [ua, eave], st);
    }
    // ---- Roof.
    let cx = 0;
    let cz = 0;
    for (const [x, z] of ring) {
      cx += x / n;
      cz += z / n;
    }
    const noWin = [style, 0, fh, 0];
    if (type === ROOF.FLAT || rise < 0.3) {
      const top = ring.map(([x, z]) => [x, y1, z]);
      const tris = THREE.ShapeUtils.triangulateShape(ring.map(([x, z]) => new THREE.Vector2(x, z)), []);
      for (const [a, b, c] of tris) facing(top[a], top[b], top[c], roof, FLATROOF, FLATROOF, FLATROOF, noWin, 1);
      // Parapet.
      for (let q = 0; q < n; q++) {
        const [ax, az] = ring[q];
        const [bx, bz] = ring[(q + 1) % n];
        tri([ax, y1, az], [bx, y1, bz], [bx, y1 + 0.5, bz], wall, [-1, eave], [-1, eave], [-1, eave], noWin);
        tri([ax, y1, az], [bx, y1 + 0.5, bz], [ax, y1 + 0.5, az], wall, [-1, eave], [-1, eave], [-1, eave], noWin);
      }
      continue;
    }
    const ridgeTop = y1 + rise;
    if (fill > 0.72) {
      // Rectangular house: the measured roof on the footprint's rectangle, eaves overhanging.
      const rcx = x0 + R[0] / 10;
      const rcz = z0 + TILE - R[1] / 10;
      const ang = R[4] / 100;
      // Ridge direction in game axes (Lambert y north → game z south).
      const dx = Math.cos(ang);
      const dz = -Math.sin(ang);
      buildRectRoof(g, { cx: rcx, cz: rcz, dx, dz, L: R[2] / 10, W: R[3] / 10, y1, top: ridgeTop, type, roof, wall, eave, st: noWin });
    } else {
      // Irregular footprint: slopes from the eaves up to a reduced copy of the footprint.
      const eaveRing = ring.map(([x, z]) => {
        const ex = x - cx;
        const ez = z - cz;
        const l = Math.hypot(ex, ez) || 1;
        return [x + (ex / l) * 0.45, y1 - 0.1, z + (ez / l) * 0.45];
      });
      const ridge = ring.map(([x, z]) => [cx + (x - cx) * 0.16, ridgeTop, cz + (z - cz) * 0.16]);
      for (let q = 0; q < n; q++) {
        const r = (q + 1) % n;
        const sl = Math.hypot(ridge[q][0] - eaveRing[q][0], ridge[q][2] - eaveRing[q][2], rise);
        facing(eaveRing[q], eaveRing[r], ridge[r], roof, [-2, sl], [-2, sl], [-2, 0], noWin, 1);
        facing(eaveRing[q], ridge[r], ridge[q], roof, [-2, sl], [-2, 0], [-2, 0], noWin, 1);
      }
      const tris = THREE.ShapeUtils.triangulateShape(ridge.map((p) => new THREE.Vector2(p[0], p[2])), []);
      for (const [a, b, c] of tris) facing(ridge[a], ridge[b], ridge[c], roof, [-2, 0], [-2, 0], [-2, 0], noWin, 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
  geo.setAttribute('facade', new THREE.Float32BufferAttribute(g.fac, 2));
  geo.setAttribute('fstyle', new THREE.Float32BufferAttribute(g.sty, 4));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, buildingMaterial());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return [mesh];
}
