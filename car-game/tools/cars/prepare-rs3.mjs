/**
 * Audi RS 3 Sportback (8Y) — conversion of the Sketchfab model "2021 Audi RS3 Sportback" into the
 * game's model convention (assets/cars/README.md). The source is a game-ready model: named parts
 * (`LOD_A_<PART>_mm_<atlas>`), metres, +Y up, front towards +Z, driver (left) towards +X, and
 * texture atlases painted in neutral greys (the original game tinted them):
 *   - the exterior atlas mixes the white paint with black trim and lamps → triangles are sorted by
 *     the colour they sample: white → `paint_body` (colour chosen in the garage), the rest → trim;
 *   - grey atlases (cabin, trim) are re-graded towards the real black plastics and leather;
 *   - wheels, steering wheel, doors, mirrors, glass and lamps get the game's node / material names.
 *
 *   node tools/cars/prepare-rs3.mjs <source.glb> <textures dir> [--report]
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { bbox, encodeTextures, extract, flatten, indicesOf, transformAll, triCentroid } from './lib.mjs';

const SRC = process.argv[2];
const REPORT = process.argv.includes('--report');
const OUT = new URL('../../assets/cars/audi-rs3-8y/model.glb', import.meta.url).pathname;
const WHEELBASE = 2.631; // m (official)
/** Binnacle screen relative to the steering-wheel centre (m): up, forward. */
const DASH_UP = 0.04;
const DASH_AHEAD = 0.24;
/** Driver's eye relative to the steering-wheel centre (m): up, back. */
const EYE_UP = 0.32;
const EYE_BACK = 0.52;

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(SRC);
const root = doc.getRoot();
const scene = root.listScenes()[0];
const nodes = flatten(doc);
const atlas = (prim) => (prim.getMaterial()?.getName() ?? '').replace(/^2021_audi_rs3_sportsback_|^car_|\.etc\.png$/g, '');
const named = (re) => nodes.filter((n) => re.test(n.getName()));
const one = (re) => {
  const l = named(re);
  if (l.length !== 1) throw new Error(`${re}: ${l.length} nœuds`);
  return l[0];
};

// =============================================================================
// Scale to the official wheelbase (the source is already in metres, oriented like the game).
// =============================================================================
// The four wheel groups are the `BRAKE_CALIPER_FRONT_LEFT*` nodes: caliper + rim + disc + tyre.
const wheelNodes = named(/^LOD_A_BRAKE_CALIPER_FRONT_LEFT_mm_misc/);
if (wheelNodes.length !== 4) throw new Error(`4 roues attendues, ${wheelNodes.length}`);
const tyreOf = (n) => n.getMesh().listPrimitives().find((p) => atlas(p) === 'tyre_tread');
let hubs = wheelNodes.map((n) => bbox(tyreOf(n)).center);
const zF = Math.max(...hubs.map((h) => h[2]));
const zR = Math.min(...hubs.map((h) => h[2]));
const scale = WHEELBASE / (zF - zR);
const xMid = hubs.reduce((a, h) => a + h[0], 0) / 4;
transformAll(doc, [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, -xMid * scale, 0, -zF * scale, 1]);
// Model space from here: front axle at z = 0, centred on x = 0, ground at y ≈ 0.
const S = (p) => [(p[0] - xMid) * scale, p[1] * scale, (p[2] - zF) * scale];
hubs = wheelNodes.map((n) => bbox(tyreOf(n)).center);
const ids = hubs.map((h) => (h[2] > -WHEELBASE / 2 ? 'F' : 'R') + (h[0] > 0 ? 'L' : 'R'));
console.log('échelle', scale.toFixed(4), 'roues', ids.map((id, i) => `${id}(${hubs[i].map((v) => v.toFixed(3))}) R=${(bbox(tyreOf(wheelNodes[i])).size[1] / 2).toFixed(3)}`).join(' '));

if (REPORT) {
  for (const n of nodes)
    for (const p of n.getMesh().listPrimitives()) {
      const b = bbox(p);
      console.log(n.getName().padEnd(40), atlas(p).padEnd(24), String(indicesOf(p).length / 3).padEnd(6), 'c', b.center.map((v) => v.toFixed(2)).join(','), 's', b.size.map((v) => v.toFixed(2)).join('x'));
    }
  process.exit(0);
}

// =============================================================================
// Textures: decode the atlases, re-grade the greys, build the materials.
// =============================================================================
const texOf = Object.fromEntries(root.listTextures().map((t) => [t.getName().replace(/^2021_audi_rs3_sportsback_|^car_|\.etc$/g, ''), t]));
async function decode(tex) {
  const { data, info } = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
async function encode(img) {
  return new Uint8Array(await sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } }).png().toBuffer());
}
const hsv = (r, g, b) => {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return { v: mx / 255, s: mx ? (mx - mn) / mx : 0 };
};
/**
 * Neutral greys towards black (power curve, highlights kept), coloured texels untouched:
 * the source paints black plastics, leather and grilles in a flat mid-grey.
 */
function regrade(img, { gamma = 2.2, knee = 0.85, gain = 1 }) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const { v, s } = hsv(d[i], d[i + 1], d[i + 2]);
    if (v >= knee || v === 0) continue;
    const k = Math.max(0, 1 - s / 0.25); // 1 for greys, 0 from 25 % saturation
    if (!k) continue;
    const f = ((v ** gamma / knee ** (gamma - 1)) * gain) / v;
    const m = 1 + (f - 1) * k;
    for (let c = 0; c < 3; c++) d[i + c] = Math.min(255, Math.round(d[i + c] * m));
  }
  return img;
}
const sample = (img, u, v) => {
  const x = Math.min(img.w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * img.w)));
  const y = Math.min(img.h - 1, Math.max(0, Math.floor((v - Math.floor(v)) * img.h)));
  const i = (y * img.w + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
};

const ext = await decode(texOf.ext_glacier_white);
const extRaw = { ...ext, data: Buffer.from(ext.data) };
const cab = await decode(texOf.cab);
const misc = await decode(texOf.misc);
const wheel = await decode(texOf.wheel);
regrade(ext, {});
regrade(cab, { gamma: 2.0, gain: 0.9 });
regrade(misc, { gamma: 2.2 });
// Rims: the garage colour multiplies the texture → bring the rim grey up to ≈ white.
{
  const d = wheel.data;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (hsv(d[i], d[i + 1], d[i + 2]).s < 0.1) { sum += d[i + 1]; n++; }
  const g = 215 / (sum / n);
  for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = Math.min(255, Math.round(d[i + c] * g));
}
for (const [key, img] of [['ext_glacier_white', ext], ['cab', cab], ['misc', misc], ['wheel', wheel]]) texOf[key].setImage(await encode(img)).setMimeType('image/png');

const srcMat = Object.fromEntries(root.listMaterials().map((m) => [m.getName().replace(/^2021_audi_rs3_sportsback_|^car_|\.etc\.png$/g, ''), m]));
const mat = (name, from, props = {}) => {
  const m = (from ? from.clone() : doc.createMaterial()).setName(name);
  m.setMetallicFactor(props.metal ?? 0).setRoughnessFactor(props.rough ?? 0.5);
  if (props.color) m.setBaseColorFactor(props.color);
  if (props.blend) m.setAlphaMode('BLEND');
  if (props.emissive) m.setEmissiveFactor(props.emissive).setEmissiveTexture(m.getBaseColorTexture());
  if (props.doubleSided) m.setDoubleSided(true);
  return m;
};
const M = {
  paint: mat('paint_body', srcMat.ext_glacier_white, { metal: 0.4, rough: 0.3 }),
  extTrim: mat('ext_trim', srcMat.ext_glacier_white, { rough: 0.35 }),
  misc: mat('misc_trim', srcMat.misc, { rough: 0.45 }),
  mirror: mat('mirror_glass', null, { metal: 1, rough: 0.04, color: [0.9, 0.92, 0.95, 1] }),
  cab: mat('int_cabin', srcMat.cab, { rough: 0.7 }),
  wheel: mat('rim_wheel', srcMat.wheel, { metal: 0.85, rough: 0.28 }),
  disc: mat('disc_wheel', srcMat.rotor_03, { metal: 0.75, rough: 0.42 }),
  tyre: mat('tyre', srcMat.tyre_tread, { rough: 0.88, color: [0.62, 0.62, 0.62, 1] }),
  caliper: mat('caliper_body', srcMat.misc, { rough: 0.3 }),
  glass: mat('glass', srcMat.windows, { rough: 0.04, blend: true, doubleSided: true }),
  lampGlass: mat('lamp_glass', srcMat.windows, { rough: 0.02, blend: true }),
  head: mat('light_head', srcMat.lights, { metal: 0.6, rough: 0.2, emissive: [0.16, 0.16, 0.17] }),
  brake: mat('light_brake', srcMat.lights, { rough: 0.25, emissive: [0.55, 0.03, 0.02] }),
  lamps: mat('lamps_trim', srcMat.lights, { metal: 0.3, rough: 0.3 }),
  chassis: mat('chassis', srcMat.chassis, { metal: 0.3, rough: 0.6 }),
  badges: mat('badges', srcMat.badges, { metal: 0.9, rough: 0.2, blend: false }),
};
M.badges.setAlphaMode('MASK').setAlphaCutoff(0.5);
M.tyre.setAlphaMode('OPAQUE');

// =============================================================================
// Exterior atlas: white texels → paint, the rest (black trim, grilles, reflectors) → trim.
// =============================================================================
const BARY = [];
for (let i = 1; i < 6; i++) for (let j = 1; i + j < 6; j++) BARY.push([i / 6, j / 6]);
for (const n of nodes)
  for (const prim of [...n.getMesh().listPrimitives()]) {
    if (atlas(prim) !== 'ext_glacier_white') continue;
    const uv = prim.getAttribute('TEXCOORD_0').getArray();
    const idx = indicesOf(prim);
    const isPaint = new Uint8Array(idx.length / 3);
    for (let t = 0; t < isPaint.length; t++) {
      // Sample inside the triangle (away from its edges, which sit on the island borders).
      const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
      let white = 0;
      let total = 0;
      for (const [wa, wb] of BARY) {
        const wc = 1 - wa - wb;
        const u = uv[a * 2] * wa + uv[b * 2] * wb + uv[c * 2] * wc;
        const v = uv[a * 2 + 1] * wa + uv[b * 2 + 1] * wb + uv[c * 2 + 1] * wc;
        const [r, g, bl] = sample(extRaw, u, v);
        const h = hsv(r, g, bl);
        if (h.v > 0.78 && h.s < 0.12) white++;
        total++;
      }
      isPaint[t] = white >= total * 0.6 ? 1 : 0;
    }
    const p = extract(doc, prim, (t) => isPaint[t] === 1);
    const r = extract(doc, prim, (t) => isPaint[t] === 0);
    n.getMesh().removePrimitive(prim);
    prim.dispose();
    if (p) n.getMesh().addPrimitive(p.setMaterial(M.paint));
    if (r) n.getMesh().addPrimitive(r.setMaterial(M.extTrim));
  }

// =============================================================================
// Other materials by part name and atlas.
// =============================================================================
for (const n of nodes) {
  const name = n.getName();
  for (const prim of n.getMesh().listPrimitives()) {
    const a = atlas(prim);
    let m = null;
    if (a === 'cab') m = M.cab;
    else if (a === 'misc') m = /MIRROR_GLASS/.test(name) ? M.mirror : M.misc;
    else if (a === 'windows') m = /HEADLIGHT|TAILLIGHT/.test(name) ? M.lampGlass : M.glass;
    else if (a === 'lights') m = /HEADLIGHT/.test(name) ? M.head : /TAILLIGHT|BRAKES/.test(name) ? M.brake : M.lamps;
    else if (a === 'chassis') m = M.chassis;
    else if (a === 'badges') m = M.badges;
    if (m) prim.setMaterial(m);
  }
}

// =============================================================================
// Wheels: tyre + rim + disc spin (`wheel_XX`), the caliper follows the steering (`caliper_XX`).
// =============================================================================
wheelNodes.forEach((n, w) => {
  const spin = doc.createMesh(`wheel_${ids[w]}`);
  const fixed = doc.createMesh(`caliper_${ids[w]}`);
  for (const prim of [...n.getMesh().listPrimitives()]) {
    const a = atlas(prim);
    const m = a === 'tyre_tread' ? M.tyre : a === 'wheel' ? M.wheel : a === 'rotor_03' ? M.disc : M.caliper;
    const np = extract(doc, prim, () => true, hubs[w]).setMaterial(m);
    (m === M.caliper ? fixed : spin).addPrimitive(np);
  }
  scene.addChild(doc.createNode(`wheel_${ids[w]}`).setMesh(spin).setTranslation(hubs[w]));
  scene.addChild(doc.createNode(`caliper_${ids[w]}`).setMesh(fixed).setTranslation(hubs[w]));
  const mesh = n.getMesh();
  n.dispose();
  mesh.dispose();
});

// =============================================================================
// Steering wheel: rim plane from the geometry (principal axes), local +Z = column, forward.
// =============================================================================
const parts = [];
{
  const n = one(/^LOD_A_STEERING_WHEEL_mm_cab$/);
  const prim = n.getMesh().listPrimitives()[0];
  const pos = prim.getAttribute('POSITION').getArray();
  const c = bbox(prim).center;
  // Covariance → the smallest eigenvector is the wheel's axis (power iteration on (trace·I − C)).
  const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < pos.length; i += 3) {
    const d = [pos[i] - c[0], pos[i + 1] - c[1], pos[i + 2] - c[2]];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) C[r * 3 + k] += d[r] * d[k];
  }
  const tr = C[0] + C[4] + C[8];
  let ax = [0, 0, 1];
  for (let it = 0; it < 200; it++) {
    const v = [0, 1, 2].map((r) => tr * ax[r] - (C[r * 3] * ax[0] + C[r * 3 + 1] * ax[1] + C[r * 3 + 2] * ax[2]));
    const l = Math.hypot(...v);
    ax = v.map((x) => x / l);
  }
  if (ax[2] < 0) ax = ax.map((x) => -x);
  // Rotation about X taking +Z to the column axis (the column has no sideways component here).
  const tilt = Math.atan2(-ax[1], ax[2]);
  console.log('volant : axe', ax.map((v) => v.toFixed(3)).join(','), 'inclinaison', ((tilt * 180) / Math.PI).toFixed(1), '°');
  const cos = Math.cos(tilt), sin = Math.sin(tilt);
  const np = extract(doc, prim, () => true, c);
  for (const sem of ['POSITION', 'NORMAL']) {
    const acc = np.getAttribute(sem);
    const a = acc.getArray();
    for (let i = 0; i < a.length; i += 3) {
      const y = a[i + 1], z = a[i + 2];
      a[i + 1] = cos * y + sin * z; // R_x(−tilt): world → wheel frame
      a[i + 2] = -sin * y + cos * z;
    }
    acc.setArray(a);
  }
  const mesh = doc.createMesh('steering_wheel').addPrimitive(np);
  scene.addChild(doc.createNode('steering_wheel').setMesh(mesh).setTranslation(c).setRotation([Math.sin(tilt / 2), 0, 0, Math.cos(tilt / 2)]));
  parts.push({ name: 'steering', c, ax });
  n.getMesh().dispose();
  n.dispose();
}

// =============================================================================
// Doors (garage): door skin, card, trims, glass and mirror under one pivot on the front hinge.
// =============================================================================
for (const [side, word] of [['L', 'LEFT'], ['R', 'RIGHT']]) {
  const list = named(new RegExp(`^LOD_A_(DOOR|GLASS|MIRROR|MIRROR_GLASS)_${word}_mm_`));
  const skin = list.find((n) => /^LOD_A_DOOR_.*_mm_ext$/.test(n.getName()));
  const b = skin.getMesh().listPrimitives().map(bbox);
  const xOut = side === 'L' ? Math.max(...b.map((q) => q.max[0])) : Math.min(...b.map((q) => q.min[0]));
  const hinge = [xOut - (side === 'L' ? 0.04 : -0.04), 0.6, Math.max(...b.map((q) => q.max[2])) - 0.05];
  const door = doc.createNode(`door_${side}`).setTranslation(hinge);
  scene.addChild(door);
  for (const n of list) {
    const mesh = n.getMesh();
    for (const prim of mesh.listPrimitives()) {
      const a = prim.getAttribute('POSITION');
      const arr = a.getArray();
      for (let i = 0; i < arr.length; i += 3) for (let k = 0; k < 3; k++) arr[i + k] -= hinge[k];
      a.setArray(arr);
    }
    let name = n.getName().replace(/^LOD_A_/, '').toLowerCase();
    if (/^MIRROR_GLASS/.test(n.getName())) name = `mirror_${side}`;
    scene.removeChild(n);
    door.addChild(n.setName(name));
  }
}

// =============================================================================
// Instrument cluster: the game's live display on a quad in the binnacle, behind the steering wheel
// (the atlas only carries a tiny painted copy of the virtual cockpit).
// =============================================================================
{
  const sw = parts.find((p) => p.name === 'steering').c;
  // Look from the driver's eye through the wheel's upper opening: the first cabin surface hit is
  // the binnacle's screen; the live display goes 5 mm in front of it.
  const eye = [sw[0], sw[1] + EYE_UP, sw[2] - EYE_BACK];
  const aim = [sw[0], sw[1] + DASH_UP, sw[2] + DASH_AHEAD];
  const dir = aim.map((v, k) => v - eye[k]);
  const len = Math.hypot(...dir);
  const d = dir.map((v) => v / len);
  let hit = Infinity;
  let hitN = null;
  const cabin = one(/^LOD_A_INTERIOR_mm_cab$/).getMesh().listPrimitives()[0];
  const pos = cabin.getAttribute('POSITION').getArray();
  const idx = indicesOf(cabin);
  for (let t = 0; t < idx.length / 3; t++) {
    const P = [0, 1, 2].map((j) => [pos[idx[t * 3 + j] * 3], pos[idx[t * 3 + j] * 3 + 1], pos[idx[t * 3 + j] * 3 + 2]]);
    const e1 = P[1].map((v, k) => v - P[0][k]);
    const e2 = P[2].map((v, k) => v - P[0][k]);
    const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const pv = cr(d, e2);
    const det = dot(e1, pv);
    if (Math.abs(det) < 1e-12) continue;
    const tv = eye.map((v, k) => v - P[0][k]);
    const u = dot(tv, pv) / det;
    if (u < 0 || u > 1) continue;
    const qv = cr(tv, e1);
    const v = dot(d, qv) / det;
    if (v < 0 || u + v > 1) continue;
    const dist = dot(e2, qv) / det;
    if (dist > 0.3 && dist < hit) {
      hit = dist;
      const n = cr(e1, e2);
      const l = Math.hypot(...n);
      hitN = n.map((x) => x / l);
      if (dot(hitN, d) > 0) hitN = hitN.map((x) => -x); // towards the driver
    }
  }
  if (!Number.isFinite(hit)) throw new Error('combiné introuvable');
  const ctr = eye.map((v, k) => v + d[k] * (hit - 0.005));
  console.log('combiné à', hit.toFixed(3), 'm des yeux, centre', ctr.map((v) => v.toFixed(3)).join(','));
  // 12.3" Audi virtual cockpit: 0.31 × 0.115 m with the bezel, facing the driver, leaning back ≈ 15°.
  const w = 0.31, h = 0.115;
  const quad = new Float32Array([-w / 2, -h / 2, 0, w / 2, -h / 2, 0, w / 2, h / 2, 0, -w / 2, h / 2, 0]);
  const nrm = new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]);
  // Seen from the driver (looking towards +Z), +X is on the viewer's left: u runs the other way.
  const quv = new Float32Array([1, 1, 0, 1, 0, 0, 1, 0]);
  const buf = root.listBuffers()[0];
  const sp = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(quad).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nrm).setBuffer(buf))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(quv).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 2, 1, 0, 3, 2])).setBuffer(buf))
    // A (dummy) texture keeps `prune` from dropping the UV set: the game replaces the material.
    .setMaterial(doc.createMaterial('dash_screen_material').setBaseColorFactor([0, 0, 0, 1]).setBaseColorTexture(doc.createTexture('dash_dummy').setMimeType('image/png').setImage(new Uint8Array(await sharp({ create: { width: 2, height: 2, channels: 3, background: '#000' } }).png().toBuffer()))));
  // Lie flat on the binnacle surface (local −Z = its normal), rows kept horizontal.
  const Z = hitN.map((x) => -x);
  const Xr = [Z[2], 0, -Z[0]]; // up × Z
  const xl = Math.hypot(...Xr);
  const X = Xr.map((x) => x / xl);
  const Y = [Z[1] * X[2] - Z[2] * X[1], Z[2] * X[0] - Z[0] * X[2], Z[0] * X[1] - Z[1] * X[0]];
  const tr = X[0] + Y[1] + Z[2];
  const qw = Math.sqrt(Math.max(0, 1 + tr)) / 2;
  const q = [(Y[2] - Z[1]) / (4 * qw), (Z[0] - X[2]) / (4 * qw), (X[1] - Y[0]) / (4 * qw), qw];
  console.log('combiné : normale', hitN.map((v) => v.toFixed(2)).join(','));
  scene.addChild(doc.createNode('dash_screen').setMesh(doc.createMesh('dash_screen').addPrimitive(sp)).setTranslation(ctr).setRotation(q));
  parts.push({ name: 'dash', ctr });
}

// Exhaust tips (oval pipes at both ends of the diffuser) and the driver's eye.
{
  const b = one(/^LOD_A_EXHAUST_mm_chassis$/).getMesh().listPrimitives().map(bbox)[0];
  const xt = b.max[0] - 0.07;
  for (const [i, x] of [[0, xt], [1, -xt]]) scene.addChild(doc.createNode(`exhaust_tip_${i}`).setTranslation([x, b.center[1], b.min[2]]));
  const sw = parts.find((p) => p.name === 'steering').c;
  scene.addChild(doc.createNode('driver_eye').setTranslation([sw[0], sw[1] + EYE_UP, sw[2] - EYE_BACK]));
}
void S;

// =============================================================================
// Output.
// =============================================================================
await doc.transform(
  prune({ keepLeaves: true }), // keep the empty marker nodes (driver_eye, exhaust_tip_N)
  dedup(),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await encodeTextures(doc, sharp);
const asset = root.getAsset();
asset.generator = 'apex tools/cars/prepare-rs3.mjs';
asset.extras = { title: '2021 Audi RS3 Sportback', source: 'Sketchfab', license: 'voir CREDITS.txt' };
mkdirSync(dirname(OUT), { recursive: true });
await io.write(OUT, doc);
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += indicesOf(p).length / 3;
console.log('écrit', OUT, `${tris | 0} triangles, ${root.listMaterials().length} matériaux, ${root.listTextures().length} textures`);
