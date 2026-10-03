/**
 * Exterior-only Sketchfab cars (no cabin modelled) → the game's model convention, one recipe per
 * car below. Shared steps:
 *   - orientation (front towards +Z), official wheelbase, front axle at z = 0, ground at y = 0;
 *   - dense meshes simplified (meshoptimizer, a few mm of error at most): these models carry
 *     ~600 k triangles, a third of them in the tyres;
 *   - wheels: the four hubs are found from the tyre geometry (one cluster per corner), then every
 *     wheel triangle goes to its nearest hub → `wheel_XX` (spins) / `caliper_XX` (steers only);
 *   - materials renamed for the game, glass made see-through, finishes fixed;
 *   - markers: `driver_eye`, `exhaust_tip_N` and `cabin_kit` (the game fits its stand-in cabin:
 *     dashboard, live cluster, steering wheel, seats).
 *
 *   node tools/cars/prepare-exterior.mjs <mustang|nissan> <source.glb>
 */
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { bbox, encodeTextures, extract, flatten, indicesOf, transformAll, triCentroid } from './lib.mjs';

const GLASS_WINDOW = { color: [0.02, 0.022, 0.025, 0.42], metal: 0, rough: 0.03, blend: true };
const GLASS_LAMP = { color: [1, 1, 1, 0.1], metal: 0, rough: 0.02, blend: true };

const RECIPES = {
  mustang: {
    id: 'ford-mustang-gt-2021',
    wheelbase: 2.72,
    /** Direction of the car's front in the source. */
    forward: '-z',
    wheelNodes: /^Tire/,
    tyre: 'Tyre_base',
    spin: ['Tyre_base', 'Tire_screw', 'Tyre_metal', 'lambert1'],
    fixed: ['Brakes'],
    materials: {
      Base_yellow: ['paint_body', { metal: 0.4, rough: 0.3 }],
      White_Strip1: ['stripes', { metal: 0.2, rough: 0.35 }],
      Back_Light: ['light_brake', { emissive: [1, 0.02, 0.01] }],
      headlight: ['light_head', { emissive: [0.25, 0.24, 0.2] }],
      glass_headlight: ['glass_lamp_front', GLASS_LAMP],
      Glass: ['glass', GLASS_WINDOW],
      Mirror_Glass: ['mirror_glass', { color: [0.85, 0.87, 0.9, 1], metal: 1, rough: 0.03, opaque: true }],
      Tyre_base: ['tyre', { metal: 0, rough: 0.88 }],
      Tyre_metal: ['rim_wheel', { metal: 0.85, rough: 0.28 }],
      Brakes: ['caliper_paint', {}],
      Black: ['trim_black', {}],
    },
    eye: [0.37, 1.24, -1.72],
    /** The roof panel is made of the windows' glass: kept dark and opaque above this height. */
    roofGlassAbove: 1.38,
    seats: false,
    exhaust: { x: 0.52, y: 0.3 },
    credit: { author: 'Asura007 (https://sketchfab.com/Asura007)', source: 'https://sketchfab.com/3d-models/ford-mustang-gt-2021-free-1b55d6edc6e5450a939b274f157a875d', title: 'Ford Mustang Gt 2021 (Free!!)' },
  },
  nissan: {
    id: 'nissan-gt-r-r35',
    wheelbase: 2.78,
    forward: '-x',
    wheelNodes: /^Brakes$/,
    tyre: 'Plastic.001',
    spin: ['Plastic.001', 'Metal.001', 'Metal'],
    fixed: ['Material', 'Material.001'],
    /** Wheel triangles of a shared material get their own copy (the discs glow when hot). */
    wheelMaterials: { Metal: 'disc_wheel' },
    materials: {
      CarPaint: ['paint_body', { metal: 0.5, rough: 0.3 }],
      'Metal.001': ['rim_wheel', { color: [0.6, 0.6, 0.62, 1], metal: 0.85, rough: 0.3 }],
      'Plastic.001': ['tyre', { color: [0.03, 0.03, 0.03, 1], metal: 0, rough: 0.88 }],
      Material: ['caliper_paint', { rough: 0.3 }],
      Red_Light: ['light_brake', {}],
      Mirror: ['mirror_glass', { color: [0.85, 0.87, 0.9, 1], metal: 1, rough: 0.03 }],
      Glass: ['glass_lamp', GLASS_LAMP],
      'Glass.001': ['glass_lamp_red', { color: [0.5, 0.02, 0.02, 0.35], metal: 0, rough: 0.02, blend: true }],
      Reflective_Plastic: [null, { rough: 0.25 }],
    },
    /** One material lit at both ends: the front LED strips (DRL) and the rear reversing light. */
    splitFrontRear: { Light: ['light_drl', 'light_reverse'] },
    /** Windows share the lamps' glass: they get a tinted see-through copy. */
    windows: { nodes: /^(Door Window|Doors\.002|Rear Window|Back Body\.001|Hood\.001)$/, from: 'glass_lamp', to: 'glass', props: GLASS_WINDOW },
    eye: [0.37, 1.15, -1.6],
    seats: true,
    exhaust: { node: /^Exhausts$/ },
    credit: { author: 'Ciasny (https://sketchfab.com/Ciasny)', source: 'https://sketchfab.com/3d-models/nissan-gtr-r35-51c912a8310c4e00a82ad7673d84228a', title: 'Nissan GTR R35' },
  },
};

const R = RECIPES[process.argv[2]];
const SRC = process.argv[3];
if (!R || !SRC) throw new Error('usage: prepare-exterior.mjs <mustang|nissan> <source.glb>');
const OUT = new URL(`../../assets/cars/${R.id}/model.glb`, import.meta.url).pathname;

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(SRC);
const root = doc.getRoot();
const scene = root.listScenes()[0];

// Node names: the Sketchfab export puts the part name on the parent group.
const partOf = new Map();
for (const n of root.listNodes()) if (n.getMesh()) partOf.set(n, n.getParentNode()?.getName() ?? n.getName());
const nodes = flatten(doc);
const matName = (p) => p.getMaterial()?.getName() ?? '';
const prims = (list) => list.flatMap((n) => n.getMesh()?.listPrimitives() ?? []);
let triCount = () => prims(root.listNodes().filter((n) => n.getMesh())).reduce((a, p) => a + indicesOf(p).length / 3, 0);
console.log('source :', triCount(), 'triangles');

// =============================================================================
// Orientation, scale, position.
// =============================================================================
// Rotation about Y taking the source's front to +Z (column-major).
const ROT = { '-z': [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1], '-x': [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1], '+z': [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }[R.forward];
transformAll(doc, ROT);
const wheelNodes = nodes.filter((n) => R.wheelNodes.test(partOf.get(n)));
const tyrePrims = prims(wheelNodes).filter((p) => matName(p) === R.tyre);
/** Bounding box of a (large) point list. */
function boxOf(pts) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const q of pts)
    for (let k = 0; k < 3; k++) {
      if (q[k] < lo[k]) lo[k] = q[k];
      if (q[k] > hi[k]) hi[k] = q[k];
    }
  return [lo, hi];
}
/** Hubs: tyre vertices split by side (x) and axle (z), the centre of each corner's box. */
function findHubs() {
  const pts = [];
  for (const p of tyrePrims) {
    const a = p.getAttribute('POSITION').getArray();
    for (let i = 0; i < a.length; i += 3) pts.push([a[i], a[i + 1], a[i + 2]]);
  }
  const [lo, hi] = boxOf(pts);
  const cx = (lo[0] + hi[0]) / 2;
  const cz = (lo[2] + hi[2]) / 2;
  const corners = { FL: [], FR: [], RL: [], RR: [] };
  for (const q of pts) corners[(q[2] > cz ? 'F' : 'R') + (q[0] > cx ? 'L' : 'R')].push(q);
  return Object.fromEntries(
    Object.entries(corners).map(([id, list]) => {
      const [l, h] = boxOf(list);
      return [id, { c: l.map((v, k) => (v + h[k]) / 2), r: (h[1] - l[1]) / 2, minY: l[1] }];
    }),
  );
}
let hubs = findHubs();
const zF = (hubs.FL.c[2] + hubs.FR.c[2]) / 2;
const zR = (hubs.RL.c[2] + hubs.RR.c[2]) / 2;
const scale = R.wheelbase / (zF - zR);
const xMid = (hubs.FL.c[0] + hubs.FR.c[0] + hubs.RL.c[0] + hubs.RR.c[0]) / 4;
const ground = Math.min(...Object.values(hubs).map((h) => h.minY));
transformAll(doc, [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, -xMid * scale, -ground * scale, -zF * scale, 1]);
hubs = findHubs();
console.log('échelle', scale.toFixed(4), Object.entries(hubs).map(([id, h]) => `${id}(${h.c.map((v) => v.toFixed(3))}) R=${h.r.toFixed(3)}`).join(' '));

// =============================================================================
// Simplify the dense meshes (error bound relative to each mesh's size).
// =============================================================================
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.35, error: 0.0006, lockBorder: true }));
console.log('simplifié :', triCount(), 'triangles');

// =============================================================================
// Materials.
// =============================================================================
const byName = (n) => root.listMaterials().find((m) => m.getName() === n);
function finish(m, o) {
  if (o.color) m.setBaseColorFactor(o.color);
  if (o.metal !== undefined) m.setMetallicFactor(o.metal);
  if (o.rough !== undefined) m.setRoughnessFactor(o.rough);
  if (o.blend) m.setAlphaMode('BLEND').setDoubleSided(true);
  if (o.opaque) m.setAlphaMode('OPAQUE');
  if (o.emissive) m.setEmissiveFactor(o.emissive);
}
for (const [from, [to, o]] of Object.entries(R.materials)) {
  const m = byName(from);
  if (!m) throw new Error(`matériau ${from} introuvable`);
  finish(m, o);
  if (to) m.setName(to);
}
// Shared lit material split front / rear.
for (const [from, [front, rear]] of Object.entries(R.splitFrontRear ?? {})) {
  const src = byName(from);
  const fm = src.clone().setName(front);
  const rm = src.clone().setName(rear);
  for (const n of nodes) for (const p of n.getMesh()?.listPrimitives() ?? []) if (p.getMaterial() === src) p.setMaterial(bbox(p).center[2] > -R.wheelbase / 2 ? fm : rm);
}
// Windows sharing the lamps' glass.
if (R.windows) {
  const src = byName(R.windows.from);
  const win = src.clone().setName(R.windows.to);
  finish(win, R.windows.props);
  for (const n of nodes) if (R.windows.nodes.test(partOf.get(n))) for (const p of n.getMesh().listPrimitives()) if (p.getMaterial() === src) p.setMaterial(win);
}

if (R.roofGlassAbove) {
  const glass = byName('glass');
  const roof = glass.clone().setName('glass_roof').setAlphaMode('OPAQUE').setBaseColorFactor([0.01, 0.01, 0.012, 1]).setRoughnessFactor(0.08);
  for (const n of nodes)
    for (const p of [...(n.getMesh()?.listPrimitives() ?? [])]) {
      if (p.getMaterial() !== glass) continue;
      const pos = p.getAttribute('POSITION').getArray();
      const idx = indicesOf(p);
      const up = (t) => triCentroid(pos, idx, t)[1] > R.roofGlassAbove;
      const top = extract(doc, p, (t) => up(t));
      const rest = extract(doc, p, (t) => !up(t));
      n.getMesh().removePrimitive(p);
      p.dispose();
      if (top) n.getMesh().addPrimitive(top.setMaterial(roof));
      if (rest) n.getMesh().addPrimitive(rest);
    }
}

// =============================================================================
// Wheels.
// =============================================================================
const ids = ['FL', 'FR', 'RL', 'RR'];
const spinNames = R.spin.map((n) => R.materials[n]?.[0] ?? n);
const fixedNames = R.fixed.map((n) => R.materials[n]?.[0] ?? n);
const wheelMat = new Map(); // shared material → its wheel copy
for (const [from, to] of Object.entries(R.wheelMaterials ?? {})) wheelMat.set(byName(from), byName(from).clone().setName(to).setMetallicFactor(0.7).setRoughnessFactor(0.45));
const parts = Object.fromEntries(ids.map((id) => [id, { spin: [], fixed: [] }]));
for (const n of wheelNodes) {
  const mesh = n.getMesh();
  for (const p of [...mesh.listPrimitives()]) {
    const name = matName(p);
    const kind = spinNames.includes(name) ? 'spin' : fixedNames.includes(name) ? 'fixed' : null;
    if (!kind) continue;
    const pos = p.getAttribute('POSITION').getArray();
    const idx = indicesOf(p);
    const owner = new Array(idx.length / 3).fill(null);
    for (let t = 0; t < owner.length; t++) {
      const c = triCentroid(pos, idx, t);
      let best = null;
      let bd = Infinity;
      for (const id of ids) {
        const h = hubs[id];
        const d = Math.hypot(c[0] - h.c[0], c[1] - h.c[1], c[2] - h.c[2]);
        if (d < bd && d < h.r * 1.35) {
          bd = d;
          best = id;
        }
      }
      owner[t] = best;
    }
    for (const id of ids) {
      const np = extract(doc, p, (t) => owner[t] === id, hubs[id].c);
      if (!np) continue;
      if (wheelMat.has(np.getMaterial())) np.setMaterial(wheelMat.get(np.getMaterial()));
      parts[id][kind].push(np);
    }
    const rest = extract(doc, p, (t) => owner[t] === null);
    mesh.removePrimitive(p);
    p.dispose();
    if (rest) mesh.addPrimitive(rest);
  }
}
for (const id of ids) {
  for (const [kind, prefix] of [['spin', 'wheel_'], ['fixed', 'caliper_']]) {
    if (!parts[id][kind].length) continue;
    const mesh = doc.createMesh(prefix + id);
    for (const p of parts[id][kind]) mesh.addPrimitive(p);
    scene.addChild(doc.createNode(prefix + id).setMesh(mesh).setTranslation(hubs[id].c));
  }
  console.log(`roue ${id} :`, parts[id].spin.reduce((a, p) => a + indicesOf(p).length / 3, 0), 'triangles,', parts[id].fixed.length ? 'étrier' : 'sans étrier');
}

// =============================================================================
// Markers: driver's eye, exhaust tips, stand-in cabin.
// =============================================================================
scene.addChild(doc.createNode('driver_eye').setTranslation(R.eye));
{
  // The cabin marker sits on the windscreen's base (its lowest, front-most point in the middle):
  // the game's dashboard rises to it.
  let cowl = null;
  for (const n of nodes)
    for (const p of n.getMesh()?.listPrimitives() ?? []) {
      if (matName(p) !== 'glass') continue;
      const a = p.getAttribute('POSITION').getArray();
      for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i]) < 0.25 && a[i + 2] > R.eye[2] + 0.4 && (!cowl || a[i + 2] > cowl[2])) cowl = [0, a[i + 1], a[i + 2]];
    }
  if (!cowl) throw new Error('pare-brise introuvable');
  console.log('base du pare-brise :', cowl.map((v) => v.toFixed(3)).join(','), '— yeux', R.eye.join(','));
  scene.addChild(doc.createNode(R.seats ? 'cabin_kit' : 'cabin_kit_noseats').setTranslation(cowl));
}
{
  let tips;
  if (R.exhaust.node) {
    const list = prims(nodes.filter((n) => R.exhaust.node.test(partOf.get(n)) && n.getMesh()));
    const b = list.map(bbox);
    const lo = [0, 1, 2].map((k) => Math.min(...b.map((q) => q.min[k])));
    const hi = [0, 1, 2].map((k) => Math.max(...b.map((q) => q.max[k])));
    const x = (hi[0] - lo[0]) / 2 - 0.06;
    tips = [[x, (lo[1] + hi[1]) / 2, lo[2]], [-x, (lo[1] + hi[1]) / 2, lo[2]]];
  } else {
    const zTail = Math.min(...prims(nodes.filter((n) => n.getMesh())).map((p) => bbox(p).min[2]));
    tips = [[R.exhaust.x, R.exhaust.y, zTail + 0.05], [-R.exhaust.x, R.exhaust.y, zTail + 0.05]];
  }
  tips.forEach((t, i) => scene.addChild(doc.createNode(`exhaust_tip_${i}`).setTranslation(t)));
  console.log('échappements :', tips.map((t) => t.map((v) => v.toFixed(2)).join(',')).join(' | '));
}

{
  const b = prims(root.listNodes().filter((n) => n.getMesh())).map(bbox);
  const lo = [0, 1, 2].map((k) => Math.min(...b.map((q) => q.min[k])));
  const hi = [0, 1, 2].map((k) => Math.max(...b.map((q) => q.max[k])));
  console.log('voiture (hors roues décalées) : l', (hi[0] - lo[0]).toFixed(3), 'h', (hi[1] - lo[1]).toFixed(3), 'L', (hi[2] - lo[2]).toFixed(3), 'm');
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
asset.generator = 'apex tools/cars/prepare-exterior.mjs';
asset.extras = { ...R.credit, license: 'CC-BY-4.0' };
mkdirSync(dirname(OUT), { recursive: true });
await io.write(OUT, doc);
console.log('écrit', OUT, `${triCount() | 0} triangles, ${root.listMaterials().length} matériaux, ${root.listTextures().length} textures`);
