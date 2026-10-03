/**
 * Audi RS 6 Avant (C8) — conversion of the Sketchfab model "2020 Audi RS6 Avant" by Ddiaz Design
 * (CC-BY-4.0, https://sketchfab.com/3d-models/2020-audi-rs6-avant-980dbda2cbbb4bae8decaed2fa80aa0c)
 * into the game's model convention (assets/cars/README.md). The source is a racing-game export:
 * one mesh per material group (`Kit1_Paint`, `Kit1_Interior`, `Light`…), front towards +Z, driver
 * (left) towards +X, at 1/100 scale; the wheels come as 720 small `polySurface` parts (the right
 * ones mirrored copies of the left), the steering wheel is part of the cabin mesh.
 *
 *   node tools/cars/prepare-rs6.mjs <source.glb> [--slice]   (--slice: side view of the driver's
 *                                                             seat in text, to place the wheel)
 */
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { bbox, dashScreen, encodeTextures, extract, flatten, indicesOf, steeringWheel, transformAll, triCentroid } from './lib.mjs';

const SRC = process.argv[2];
const SLICE = process.argv.includes('--slice');
const OUT = new URL('../../assets/cars/audi-rs6-c8/model.glb', import.meta.url).pathname;
const WHEELBASE = 2.928; // m (official)
/** Steering wheel (model metres, front axle at z = 0): centre and the cut-out's size. */
const WHEEL_C = [0.37, 0.91, -0.92];
const WHEEL_TILT = 0.25;
const WHEEL_R = 0.2;
const WHEEL_DEPTH = 0.07;
/** Driver's eye relative to the steering-wheel centre (m): up, back; cluster aim: up, forward. */
const EYE_UP = 0.27;
const EYE_BACK = 0.52;
const DASH_UP = 0.04;
const DASH_AHEAD = 0.24;

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(SRC);
const root = doc.getRoot();
const scene = root.listScenes()[0];
const PREFIX = /^AAudi_RS6AvantRewardRecycled_2020_?/;
for (const m of root.listMaterials()) m.setName(m.getName().replace(PREFIX, ''));
const nodes = flatten(doc);
const matName = (p) => p.getMaterial()?.getName() ?? '';
const meshNodes = () => root.listNodes().filter((n) => n.getMesh());
const allPrims = () => meshNodes().flatMap((n) => n.getMesh().listPrimitives());
const triCount = () => allPrims().reduce((a, p) => a + indicesOf(p).length / 3, 0);
const isWheelMat = (n) => /^Wheel1A/.test(n);
const isCaliperMat = (n) => /^Callipers/.test(n);

// =============================================================================
// Scale and position: hubs from the wheel parts (one cluster per corner).
// =============================================================================
const wheelParts = nodes.filter((n) => /^polySurface/.test(n.getName()));
function hubsNow() {
  // Axles told apart by the middle of the wheels' z range (the car's origin can be anywhere).
  let zLo = Infinity;
  let zHi = -Infinity;
  for (const n of wheelParts)
    for (const p of n.getMesh().listPrimitives()) {
      if (!isWheelMat(matName(p))) continue;
      const b = bbox(p);
      zLo = Math.min(zLo, b.min[2]);
      zHi = Math.max(zHi, b.max[2]);
    }
  const zMid = (zLo + zHi) / 2;
  const box = {};
  for (const n of wheelParts)
    for (const p of n.getMesh().listPrimitives()) {
      if (!isWheelMat(matName(p))) continue;
      const a = p.getAttribute('POSITION').getArray();
      for (let i = 0; i < a.length; i += 3) {
        const id = (a[i + 2] > zMid ? 'F' : 'R') + (a[i] > 0 ? 'L' : 'R');
        const b = (box[id] ??= { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] });
        for (let k = 0; k < 3; k++) {
          b.lo[k] = Math.min(b.lo[k], a[i + k]);
          b.hi[k] = Math.max(b.hi[k], a[i + k]);
        }
      }
    }
  return Object.fromEntries(Object.entries(box).map(([id, b]) => [id, { c: b.lo.map((v, k) => (v + b.hi[k]) / 2), r: (b.hi[1] - b.lo[1]) / 2, minY: b.lo[1] }]));
}
let hubs = hubsNow();
const zF = (hubs.FL.c[2] + hubs.FR.c[2]) / 2;
const zR = (hubs.RL.c[2] + hubs.RR.c[2]) / 2;
const scale = WHEELBASE / (zF - zR);
const ground = Math.min(...Object.values(hubs).map((h) => h.minY));
transformAll(doc, [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, 0, -ground * scale, -zF * scale, 1]);
hubs = hubsNow();
console.log('échelle', scale.toFixed(3), Object.entries(hubs).map(([id, h]) => `${id}(${h.c.map((v) => v.toFixed(3))}) R=${h.r.toFixed(3)}`).join(' '));

const interiorNodes = nodes.filter((n) => /Interior/.test(n.getName()));
const interiorPrims = () => interiorNodes.flatMap((n) => n.getMesh()?.listPrimitives() ?? []);

if (SLICE) {
  // Side view (z → columns, y → rows) of the cabin around the driver, 2.5 cm cells.
  for (const [x0, x1] of [[0.25, 0.5]]) {
    const grid = new Map();
    for (const p of interiorPrims()) {
      const pos = p.getAttribute('POSITION').getArray();
      const idx = indicesOf(p);
      for (let t = 0; t < idx.length / 3; t++) {
        const c = triCentroid(pos, idx, t);
        if (c[0] < x0 || c[0] > x1 || c[1] < 0.5 || c[1] > 1.3 || c[2] < -2.2 || c[2] > -0.4) continue;
        const k = `${Math.round(c[1] / 0.025)},${Math.round(c[2] / 0.025)}`;
        grid.set(k, (grid.get(k) ?? 0) + 1);
      }
    }
    console.log(`coupe x ∈ [${x0}, ${x1}] — colonnes z de -2.2 (gauche) à -0.4 (droite), lignes y de 1.3 à 0.5`);
    for (let y = Math.round(1.3 / 0.025); y >= Math.round(0.5 / 0.025); y--) {
      let row = '';
      for (let z = Math.round(-2.2 / 0.025); z <= Math.round(-0.4 / 0.025); z++) {
        const v = grid.get(`${y},${z}`) ?? 0;
        row += v === 0 ? ' ' : v < 3 ? '.' : v < 10 ? 'o' : '#';
      }
      console.log((y * 0.025).toFixed(3).padStart(6), row);
    }
  }
  process.exit(0);
}

// =============================================================================
// Wheels: each part goes whole to its corner (rims, tyres, discs spin; calipers steer).
// =============================================================================
const ids = ['FL', 'FR', 'RL', 'RR'];
const parts = Object.fromEntries(ids.map((id) => [id, { spin: [], fixed: [] }]));
for (const n of wheelParts) {
  const mesh = n.getMesh();
  for (const p of mesh.listPrimitives()) {
    const c = bbox(p).center;
    const id = (c[2] > -WHEELBASE / 2 ? 'F' : 'R') + (c[0] > 0 ? 'L' : 'R');
    parts[id][isCaliperMat(matName(p)) ? 'fixed' : 'spin'].push(extract(doc, p, () => true, hubs[id].c));
  }
  n.dispose();
  mesh.dispose();
}
for (const id of ids)
  for (const [kind, prefix] of [['spin', 'wheel_'], ['fixed', 'caliper_']]) {
    const mesh = doc.createMesh(prefix + id);
    for (const p of parts[id][kind]) mesh.addPrimitive(p);
    scene.addChild(doc.createNode(prefix + id).setMesh(mesh).setTranslation(hubs[id].c));
  }

// =============================================================================
// Materials.
// =============================================================================
const byName = (re) => root.listMaterials().find((m) => re.test(m.getName()));
const set = (re, name, o = {}) => {
  const m = byName(re);
  if (!m) throw new Error(`matériau ${re} introuvable`);
  if (o.metal !== undefined) m.setMetallicFactor(o.metal);
  if (o.rough !== undefined) m.setRoughnessFactor(o.rough);
  if (o.color) m.setBaseColorFactor(o.color);
  if (name) m.setName(name);
  return m;
};
set(/^Paint_Material1$/, 'paint_body', { metal: 0.5, rough: 0.3 });
set(/^Window_Material1$/, 'glass', { color: [0.02, 0.022, 0.025, 0.42], rough: 0.03 });
set(/^red_glass$/, 'glass_lamp_red');
set(/^CallipersCalliperGloss/, 'caliper_paint', { color: [0.55, 0.02, 0.02, 1], rough: 0.3 });
set(/^Wheel1A/, 'wheel_atlas');
for (const re of [/^InteriorA_/, /^InteriorTillingA_/, /^InteriorTillingColourZo/]) {
  const m = byName(re);
  m.setName(`int_${m.getName()}`).setRoughnessFactor(Math.max(0.6, m.getRoughnessFactor())).setMetallicFactor(Math.min(0.1, m.getMetallicFactor()));
  if (m.getAlphaMode() === 'BLEND') m.setAlphaMode('MASK').setAlphaCutoff(0.5);
}
// Lamps: one textured material for both ends → headlamps at the front, brake lamps at the back.
{
  const lamp = byName(/^LightA_Material1$/);
  const head = lamp.clone().setName('light_head').setEmissiveFactor([0.35, 0.35, 0.33]).setEmissiveTexture(lamp.getBaseColorTexture());
  const brake = lamp.clone().setName('light_brake').setEmissiveFactor([0.8, 0.05, 0.03]).setEmissiveTexture(lamp.getBaseColorTexture());
  for (const n of meshNodes())
    for (const p of [...n.getMesh().listPrimitives()]) {
      if (p.getMaterial() !== lamp) continue;
      const pos = p.getAttribute('POSITION').getArray();
      const idx = indicesOf(p);
      const front = (t) => triCentroid(pos, idx, t)[2] > -WHEELBASE / 2;
      const f = extract(doc, p, front);
      const r = extract(doc, p, (t) => !front(t));
      n.getMesh().removePrimitive(p);
      p.dispose();
      if (f) n.getMesh().addPrimitive(f.setMaterial(head));
      if (r) n.getMesh().addPrimitive(r.setMaterial(brake));
    }
}

// =============================================================================
// Steering wheel cut out of the cabin mesh; cluster screen; markers.
// =============================================================================
const axis = [0, -Math.sin(WHEEL_TILT), Math.cos(WHEEL_TILT)];
const cut = [];
for (const n of interiorNodes) {
  const mesh = n.getMesh();
  for (const p of [...mesh.listPrimitives()]) {
    const pos = p.getAttribute('POSITION').getArray();
    const idx = indicesOf(p);
    const inWheel = (t) => {
      const c = triCentroid(pos, idx, t);
      const d = [c[0] - WHEEL_C[0], c[1] - WHEEL_C[1], c[2] - WHEEL_C[2]];
      const along = d[0] * axis[0] + d[1] * axis[1] + d[2] * axis[2];
      const rad = Math.hypot(d[0] - along * axis[0], d[1] - along * axis[1], d[2] - along * axis[2]);
      return Math.abs(along) < WHEEL_DEPTH && rad < WHEEL_R;
    };
    const w = extract(doc, p, inWheel);
    if (!w) continue;
    const rest = extract(doc, p, (t) => !inWheel(t));
    mesh.removePrimitive(p);
    p.dispose();
    if (rest) mesh.addPrimitive(rest);
    cut.push(w);
  }
}
if (!cut.length) throw new Error('volant introuvable');
const sw = steeringWheel(doc, scene, cut);
console.log('volant :', cut.reduce((a, p) => a + indicesOf(p).length / 3, 0), 'triangles, centre', sw.c.map((v) => v.toFixed(3)).join(','));
const eye = [sw.c[0], sw.c[1] + EYE_UP, sw.c[2] - EYE_BACK];
await dashScreen(doc, scene, sharp, { eye, aim: [sw.c[0], sw.c[1] + DASH_UP, sw.c[2] + DASH_AHEAD], prims: interiorPrims(), w: 0.3, h: 0.115 });
scene.addChild(doc.createNode('driver_eye').setTranslation(eye));
{
  // Oval tailpipes at both ends of the diffuser.
  const zTail = Math.min(...allPrims().map((p) => bbox(p).min[2]));
  for (const [i, x] of [[0, 0.6], [1, -0.6]]) scene.addChild(doc.createNode(`exhaust_tip_${i}`).setTranslation([x, 0.32, zTail + 0.08]));
}

// =============================================================================
// Output.
// =============================================================================
await doc.transform(
  prune({ keepLeaves: true }), // keep the empty marker nodes
  // Materials are never merged: their names drive the game (lights, paint, rims…).
  dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await encodeTextures(doc, sharp);
const asset = root.getAsset();
asset.generator = 'apex tools/cars/prepare-rs6.mjs';
asset.extras = { author: 'Ddiaz Design (https://sketchfab.com/ddiaz-design)', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/2020-audi-rs6-avant-980dbda2cbbb4bae8decaed2fa80aa0c', title: '2020 Audi RS6 Avant' };
mkdirSync(dirname(OUT), { recursive: true });
await io.write(OUT, doc);
console.log('écrit', OUT, `${triCount() | 0} triangles, ${root.listMaterials().length} matériaux, ${root.listTextures().length} textures`);
