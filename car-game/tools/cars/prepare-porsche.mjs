/**
 * Porsche 911 GT3 RS (992) — conversion of the Sketchfab model "Porsche 911 GT3 RS (992) '23"
 * by Mona x Supercars (CC-BY-4.0, https://sketchfab.com/3d-models/porsche-911-gt3-rs-992-23-99c74d8fa7df42d984903868f6e593f6)
 * into the game's model convention. The source has unnamed nodes, an odd scale and a diagonal
 * orientation, so everything is recognised from geometry and material names:
 *   - rims = the four `Paint1Mtl` meshes (front pair smaller than the rear pair) → hubs and axes;
 *   - tyre, brake and hub triangles inside each wheel's cylinder → `wheel_XX` nodes;
 *   - the headlight / tail-light glass (one mesh) is split front / rear.
 *
 *   node tools/cars/prepare-porsche.mjs <source.glb> [--report]
 */
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { bbox, encodeTextures, extract, flatten, indicesOf, transformAll, triCentroid } from './lib.mjs';

const SRC = process.argv[2];
const REPORT = process.argv.includes('--report');
const OUT = new URL('../../assets/cars/porsche-911-gt3-rs-992/model.glb', import.meta.url).pathname;
const WHEELBASE = 2.457; // m (official)

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(SRC);
const root = doc.getRoot();
const scene = root.listScenes()[0];
const nodes = flatten(doc);
const byMat = (name) => nodes.filter((n) => n.getMesh().listPrimitives().some((p) => p.getMaterial()?.getName() === name));

// --- Rims → hubs, front/rear, orientation.
const rims = byMat('Paint1Mtl').map((n) => ({ node: n, ...bbox(n.getMesh().listPrimitives()[0]) }));
if (rims.length !== 4) throw new Error(`4 jantes attendues, ${rims.length} trouvées`);
rims.sort((a, b) => a.size[1] - b.size[1]);
const front = rims.slice(0, 2);
const rear = rims.slice(2);
const mid = (arr) => [0, 1, 2].map((k) => (arr[0].center[k] + arr[1].center[k]) / 3 * 1.5);
const fm = mid(front);
const rm = mid(rear);
// Forward = from rear axle to front axle, horizontally (the model's up axis is +Y after flatten).
let fx = fm[0] - rm[0];
let fz = fm[2] - rm[2];
const fl = Math.hypot(fx, fz);
fx /= fl;
fz /= fl;
const scale = WHEELBASE / fl;
// Rotation about Y taking (fx, fz) to +Z: x' = fz·x − fx·z ; z' = fx·x + fz·z (right-handed, det = +1).
const R = [fz, 0, fx, 0, 0, 1, 0, 0, -fx, 0, fz, 0, 0, 0, 0, 1];
const ax = (p) => [(fz * p[0] - fx * p[2]) * scale, p[1] * scale, (fx * p[0] + fz * p[2]) * scale];
const frontMid = ax(fm);
const M = [R[0] * scale, 0, R[2] * scale, 0, 0, scale, 0, 0, R[8] * scale, 0, R[10] * scale, 0, 0, 0, 0, 1];
// Ground at y = 0: tyre bottom. Front axle at z = 0, car centred on x = 0.
const rimC = rims.map((r) => ax(r.center));
const cx = rimC.reduce((a, c) => a + c[0], 0) / 4;
const minY = Math.min(...nodes.map((n) => ax(bbox(n.getMesh().listPrimitives()[0]).min)[1]));
M[12] = -cx;
M[13] = 0;
M[14] = -frontMid[2];
transformAll(doc, M);
// ax() only rotates/scales: apply the same translation so that wheel data lines up.
const T = (c) => [c[0] - cx, c[1], c[2] - frontMid[2]];
void minY;

// Post-transform measurements from the tyres themselves.
const tyres = byMat('Tire1Mtl')[0];
const tyrePrim = tyres.getMesh().listPrimitives()[0];
const tp = tyrePrim.getAttribute('POSITION').getArray();
const tIdx = indicesOf(tyrePrim);
// Hubs after the transform: rim bbox centres (recomputed, the meshes moved).
const hubs = rims.map((r) => bbox(r.node.getMesh().listPrimitives()[0]).center);
const wheelOf = (p, maxDist = 0.6) => {
  let best = -1;
  let bd = Infinity;
  hubs.forEach((h, i) => {
    const d = Math.hypot(p[0] - h[0], p[1] - h[1], p[2] - h[2]);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return bd < maxDist ? best : -1;
};
// Wheel ids: x > 0 = left (driver's side), z > mid = front.
const ids = hubs.map((h, i) => ({ i, id: (rims[i] === front[0] || rims[i] === front[1] ? 'F' : 'R') + (h[0] > 0 ? 'L' : 'R') }));
const radius = [0, 0, 0, 0];
const halfW = [0, 0, 0, 0];
for (let t = 0; t < tIdx.length / 3; t++) {
  const c = triCentroid(tp, tIdx, t);
  const w = wheelOf(c);
  if (w < 0) continue;
  radius[w] = Math.max(radius[w], Math.hypot(c[1] - hubs[w][1], c[2] - hubs[w][2]));
  halfW[w] = Math.max(halfW[w], Math.abs(c[0] - hubs[w][0]));
}
console.log('échelle', scale.toFixed(4), 'empattement', WHEELBASE, 'm');
console.log('roues', ids.map((o) => `${o.id} hub(${hubs[o.i].map((v) => v.toFixed(3)).join(',')}) R=${radius[o.i].toFixed(3)} demi-largeur=${halfW[o.i].toFixed(3)}`).join('\n      '));

// --- Rapport par matériau : triangles dans un cylindre de roue.
const inWheel = (c, w, k = 1.02) => Math.hypot(c[1] - hubs[w][1], c[2] - hubs[w][2]) < radius[w] * k && Math.abs(c[0] - hubs[w][0]) < halfW[w] * 1.15;
if (REPORT) {
  for (const n of nodes) {
    const prim = n.getMesh().listPrimitives()[0];
    const pos = prim.getAttribute('POSITION').getArray();
    const idx = indicesOf(prim);
    let inside = 0;
    const total = idx.length / 3;
    for (let t = 0; t < total; t++) {
      const c = triCentroid(pos, idx, t);
      for (let w = 0; w < 4; w++) if (inWheel(c, w)) { inside++; break; }
    }
    const b = bbox(prim);
    console.log(n.getName().padEnd(10), (prim.getMaterial()?.getName() ?? '').padEnd(24), `${inside}/${total}`.padEnd(12), 'c', b.center.map((v) => v.toFixed(2)).join(','), 's', b.size.map((v) => v.toFixed(2)).join('x'));
  }
  process.exit(0);
}

// =============================================================================
// Wheels: spinning parts (tyre, rim, disc, hub, trim) and fixed parts (calipers, pads).
// =============================================================================
const WHEEL_IDS = ids.map((o) => o.id); // by hub index
const SPIN = ['Tire1Mtl', 'Paint1Mtl', 'Wheel01lf0161Mtl', 'Hub1Mtl', 'Trim1Mtl'];
const FIXED = ['Paint2Mtl', 'Caliperlf0011Mtl', 'Caliperlf0021Mtl'];
const wheelPrims = hubs.map(() => ({ spin: [], fixed: [] }));
const dropNodes = [];
for (const n of nodes) {
  const mesh = n.getMesh();
  const prim = mesh.listPrimitives()[0];
  const mat = prim.getMaterial()?.getName();
  const kind = SPIN.includes(mat) ? 'spin' : FIXED.includes(mat) ? 'fixed' : null;
  if (!kind) continue;
  const pos = prim.getAttribute('POSITION').getArray();
  const idx = indicesOf(prim);
  const owner = new Int8Array(idx.length / 3).fill(-1);
  for (let t = 0; t < owner.length; t++) owner[t] = wheelOf(triCentroid(pos, idx, t), 0.5);
  for (let w = 0; w < 4; w++) {
    const np = extract(doc, prim, (t) => owner[t] === w, hubs[w]);
    if (np) wheelPrims[w][kind].push(np);
  }
  const rest = extract(doc, prim, (t) => owner[t] < 0);
  mesh.removePrimitive(prim);
  prim.dispose();
  if (rest) mesh.addPrimitive(rest);
  else dropNodes.push(n);
}
WHEEL_IDS.forEach((id, w) => {
  for (const [kind, prefix] of [['spin', 'wheel_'], ['fixed', 'caliper_']]) {
    if (!wheelPrims[w][kind].length) continue;
    const mesh = doc.createMesh(prefix + id);
    for (const p of wheelPrims[w][kind]) mesh.addPrimitive(p);
    const node = doc.createNode(prefix + id).setMesh(mesh).setTranslation(hubs[w]);
    scene.addChild(node);
  }
});

// =============================================================================
// Lights: the glass mesh `Light0101Mtl` mixes headlights and tail-lights → split by z.
// =============================================================================
const zMid = -1.25;
const lightMat = root.listMaterials().find((m) => m.getName() === 'Light0101Mtl');
const headMat = lightMat.clone().setName('light_head_glass');
const tailMat = lightMat.clone().setName('light_brake_glass');
for (const n of nodes) {
  const mesh = n.getMesh();
  for (const prim of [...mesh.listPrimitives()]) {
    if (prim.getMaterial() !== lightMat) continue;
    const pos = prim.getAttribute('POSITION').getArray();
    const idx = indicesOf(prim);
    const isFront = (t) => triCentroid(pos, idx, t)[2] > zMid;
    const f = extract(doc, prim, (t) => isFront(t));
    const r = extract(doc, prim, (t) => !isFront(t));
    mesh.removePrimitive(prim);
    prim.dispose();
    if (f) mesh.addPrimitive(f.setMaterial(headMat));
    if (r) mesh.addPrimitive(r.setMaterial(tailMat));
  }
}

// =============================================================================
// Names the game recognises (materials), hidden duplicate layers removed.
// =============================================================================
const RENAME = {
  Paint11Mtl: 'paint_body',
  Paint1Mtl: 'rim_wheel',
  Paint2Mtl: 'caliper_paint',
  Paint21Mtl: 'overlay_layer',
  Caliperlf0021Mtl: 'caliper_detail',
  Caliperlf0011Mtl: 'caliper_pads',
  Wheel01lf0161Mtl: 'disc_wheel',
  Ln2Mtl: 'light_brake_bar',
  Ln1Mtl: 'light_brake_lens',
};
for (const m of root.listMaterials()) if (RENAME[m.getName()]) m.setName(RENAME[m.getName()]);
// Cabin materials: the source sets most of them to roughness 0 (mirror-like leather, Alcantara and
// plastics that reflect the whole sky). Prefix `int_` (the game dims their sky reflections, a
// closed cabin sees little of it) and give them the satin finish of the real materials.
const INTERIOR = {
  Interior0481Mtl: 0.62, // dashboard, door cards, headliner
  Interior2091Mtl: 0.7,
  Seatbelt0021Mtl: 0.85, // seats, belts, Race-Tex
  Carbon1m0021Mtl: 0.35, // clear-coated carbon trim
  Csb1Mtl: 0.45,
  Usagemeral1Mtl: 0.6,
  Usagemeral2Mtl: 0.6,
  Grille20021Mtl: 0.6,
  Grille40011Mtl: 0.6,
  Grille40021Mtl: 0.6,
  Grille60011Mtl: 0.6,
  Grille71Mtl: 0.6,
  Grille81Mtl: 0.6,
  PatternColor1Mtl: 0.6,
  PatternColor3Mtl: 0.6,
  Rollcage1Mtl: 0.5,
  Rollcage2Mtl: 0.5,
  W1Mtl: 0.6,
  Needle1Mtl: 0.4,
  Interioremissive0041Mtl: 0.5,
  Interioremissive1Mtl: 0.5,
  Dashpadscreen1Mtl: 0.12, // glass over the instruments
};
for (const m of root.listMaterials()) {
  const r = INTERIOR[m.getName()];
  if (r === undefined) continue;
  // With a metal/rough texture the factor multiplies its green channel (≈ 1 in these maps).
  m.setRoughnessFactor(Math.max(m.getRoughnessFactor(), r));
  if (m.getName() !== 'Dashpadscreen1Mtl') m.setMetallicFactor(Math.min(m.getMetallicFactor(), m.getName().startsWith('Csb') ? 0.6 : 0.05));
  m.setName(`int_${m.getName()}`);
}
for (const n of nodes) {
  const prims = n.getMesh()?.listPrimitives() ?? [];
  // Objects 46 and 47 are copies of the body panels carrying a fully transparent layer.
  if (prims.length && prims.every((p) => p.getMaterial()?.getName() === 'overlay_layer' && p.getAttribute('POSITION').getCount() > 5000)) dropNodes.push(n);
}
for (const n of dropNodes) {
  const mesh = n.getMesh();
  n.dispose();
  mesh?.dispose();
}

// =============================================================================
// Steering wheel and active rear wing: triangles cut out of the body meshes by region.
// =============================================================================
const carNodes = () => root.listNodes().filter((n) => n.getMesh() && !/^(wheel|caliper)_/.test(n.getName()));
/** Cut every triangle satisfying inside(centroid) out of the body meshes; returns primitives re-based on `origin`. */
function cutOut(inside, origin, onlyMaterials = null) {
  const out = [];
  for (const n of carNodes()) {
    const mesh = n.getMesh();
    for (const prim of [...mesh.listPrimitives()]) {
      if (onlyMaterials && !onlyMaterials.includes(prim.getMaterial()?.getName().replace(/^int_/, ''))) continue;
      const pos = prim.getAttribute('POSITION').getArray();
      const idx = indicesOf(prim);
      const sel = new Uint8Array(idx.length / 3);
      let any = false;
      for (let t = 0; t < sel.length; t++) if (inside(triCentroid(pos, idx, t))) { sel[t] = 1; any = true; }
      if (!any) continue;
      const cut = extract(doc, prim, (t) => sel[t] === 1, origin);
      const rest = extract(doc, prim, (t) => sel[t] === 0);
      mesh.removePrimitive(prim);
      prim.dispose();
      if (rest) mesh.addPrimitive(rest);
      if (cut) out.push(cut);
    }
  }
  return out;
}
{
  // Steering wheel: centre on the crest badge, column axis tilted 0.3 rad (local +Z = forward, down).
  const C = [0.34, 0.79, -1.01];
  const tilt = 0.3;
  const axis = [0, -Math.sin(tilt), Math.cos(tilt)];
  const swMats = ['Interior0481Mtl', 'Interior2091Mtl', 'Badge0031Mtl', 'Seatbelt0021Mtl', 'Carbon1m0021Mtl', 'Usagemeral1Mtl', 'Grille71Mtl', 'Grille60011Mtl'];
  const inWheelRegion = (c) => {
    const d = [c[0] - C[0], c[1] - C[1], c[2] - C[2]];
    const along = d[0] * axis[0] + d[1] * axis[1] + d[2] * axis[2];
    const rad = Math.hypot(d[0] - along * axis[0], d[1] - along * axis[1], d[2] - along * axis[2]);
    return along > -0.075 && along < 0.075 && rad < 0.2;
  };
  const prims = cutOut(inWheelRegion, C, swMats);
  // Rotate the cut vertices into the wheel's local frame (undo the tilt about X).
  const cos = Math.cos(tilt), sin = Math.sin(tilt);
  for (const p of prims) {
    for (const [sem, stride] of [['POSITION', 3], ['NORMAL', 3]]) {
      const acc = p.getAttribute(sem);
      if (!acc) continue;
      const a = acc.getArray();
      for (let i = 0; i < a.length; i += stride) {
        const y = a[i + 1], z = a[i + 2];
        a[i + 1] = cos * y + sin * z; // R_x(−tilt)
        a[i + 2] = -sin * y + cos * z;
      }
      acc.setArray(a);
    }
  }
  if (prims.length) {
    const mesh = doc.createMesh('steering_wheel');
    for (const p of prims) mesh.addPrimitive(p);
    const half = tilt / 2;
    scene.addChild(doc.createNode('steering_wheel').setMesh(mesh).setTranslation(C).setRotation([Math.sin(half), 0, 0, Math.cos(half)]));
    console.log('volant :', prims.reduce((a, p) => a + p.getIndices().getCount() / 3, 0), 'triangles');
  }
}
{
  // Rear wing (DRS): everything above 1.14 m behind z = −3.05, pivot on the blade's leading edge.
  const P = [0, 1.26, -3.34];
  const prims = cutOut((c) => c[1] > 1.14 && c[2] < -3.05 && Math.abs(c[0]) < 1.0, P);
  if (prims.length) {
    const mesh = doc.createMesh('wing_active');
    for (const p of prims) mesh.addPrimitive(p);
    scene.addChild(doc.createNode('wing_active').setMesh(mesh).setTranslation(P));
    console.log('aileron :', prims.reduce((a, p) => a + p.getIndices().getCount() / 3, 0), 'triangles');
  }
}

// Instrument cluster: a quad in front of the original dials receives the game's live gauges.
{
  const w = 0.32, h = 0.12;
  const pos = new Float32Array([-w / 2, -h / 2, 0, w / 2, -h / 2, 0, w / 2, h / 2, 0, -w / 2, h / 2, 0]);
  const nrm = new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]);
  // Viewed from the driver (looking toward +Z) +X of the model is on the viewer's left: flip u.
  const uv = new Float32Array([1, 1, 0, 1, 0, 0, 1, 0]);
  const buf = root.listBuffers()[0];
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nrm).setBuffer(buf))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 2, 1, 0, 3, 2])).setBuffer(buf))
    // A (dummy) texture keeps `prune` from dropping the UV set: the game replaces the material.
    .setMaterial(doc.createMaterial('dash_screen_material').setBaseColorFactor([0, 0, 0, 1]).setBaseColorTexture(doc.createTexture('dash_dummy').setMimeType('image/png').setImage(new Uint8Array(await sharp({ create: { width: 2, height: 2, channels: 3, background: '#000' } }).png().toBuffer()))));
  const mesh = doc.createMesh('dash_screen').addPrimitive(prim);
  const a = 0.25; // faces the driver, tilted up like the dash
  scene.addChild(doc.createNode('dash_screen').setMesh(mesh).setTranslation([0.345, 0.845, -0.79]).setRotation([Math.sin(a / 2), 0, 0, Math.cos(a / 2)]));
}

// Exhaust tips and the driver's eye (model space: x left, y up, z forward, front axle at z = 0).
for (const [i, x] of [[0, 0.1], [1, -0.1]]) scene.addChild(doc.createNode(`exhaust_tip_${i}`).setTranslation([x, 0.32, -3.45]));
scene.addChild(doc.createNode('driver_eye').setTranslation([0.36, 0.99, -1.52]));

// =============================================================================
// Output: weld/dedup/prune, textures to JPEG / PNG ≤ 1024 px.
// =============================================================================
await doc.transform(
  prune({ keepLeaves: true }), // keep the empty marker nodes (driver_eye, exhaust_tip_N)
  // Materials are never merged: their names drive the game (lights, paint, rims…).
  dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await encodeTextures(doc, sharp);
const asset = root.getAsset();
asset.generator = 'apex tools/cars/prepare-porsche.mjs';
asset.extras = { author: 'Mona x Supercars (https://sketchfab.com/Car2022)', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/porsche-911-gt3-rs-992-23-99c74d8fa7df42d984903868f6e593f6', title: "Porsche 911 GT3 RS (992) '23" };
mkdirSync(dirname(OUT), { recursive: true });
await io.write(OUT, doc);
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += indicesOf(p).length / 3;
console.log('écrit', OUT, `${tris | 0} triangles, ${root.listMaterials().length} matériaux, ${root.listTextures().length} textures`);
