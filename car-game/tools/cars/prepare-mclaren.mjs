/**
 * McLaren 675LT — conversion of the Sketchfab model "Maclaren 675LT" by MdMahib (CC-BY-4.0,
 * https://sketchfab.com/3d-models/maclaren-675lt-305fede1879d4b7e83596640c4c4c170) into the game's
 * model convention (assets/cars/README.md). The source keeps its parts in named groups
 * (`wheels_40`, `hub_lf_43`, `movsteer_0_5_4`, `door_lf_ok_36`, `movspoiler_22_800_6`…), front
 * towards +Z and the driver (left) towards +X, at 0.71 scale. Its materials come from a game
 * export with a broken metal/roughness map (metal = 1 everywhere, roughness = the colour), so
 * every finish is set again here: matt plastics, lacquered carbon, Alcantara, glass, metal.
 *
 *   node tools/cars/prepare-mclaren.mjs <source.glb>
 */
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { bbox, dashScreen, encodeTextures, extract, flatten, indicesOf, steeringWheel, transformAll } from './lib.mjs';

const SRC = process.argv[2];
const OUT = new URL('../../assets/cars/mclaren-675lt/model.glb', import.meta.url).pathname;
const WHEELBASE = 2.67; // m (official)
/** Driver's eye relative to the steering-wheel centre (m): up, back. Low racing seat. */
const EYE_UP = 0.28;
const EYE_BACK = 0.5;
/** Aim point for the cluster, relative to the steering-wheel centre (m): up, forward. */
const DASH_UP = 0.03;
const DASH_AHEAD = 0.22;

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(SRC);
const root = doc.getRoot();
const scene = root.listScenes()[0];

// Part group of every mesh node (`wheels.002_46` → `wheels.002`), before flatten drops the groups.
const groupOf = new Map();
for (const n of root.listNodes()) {
  if (!n.getMesh()) continue;
  const g = n.getParentNode();
  groupOf.set(n, (g?.getName() ?? '').replace(/_\d+$/, ''));
}
const nodes = flatten(doc);
const inGroup = (re) => nodes.filter((n) => re.test(groupOf.get(n)));
const prims = (list) => list.flatMap((n) => n.getMesh().listPrimitives());
const matName = (p) => p.getMaterial()?.getName() ?? '';
const boxOf = (list) => {
  const b = prims(list).map(bbox);
  const min = [0, 1, 2].map((k) => Math.min(...b.map((q) => q.min[k])));
  const max = [0, 1, 2].map((k) => Math.max(...b.map((q) => q.max[k])));
  return { min, max, center: min.map((v, k) => (v + max[k]) / 2), size: min.map((v, k) => max[k] - v) };
};
const drop = (n) => {
  const mesh = n.getMesh();
  n.dispose();
  mesh?.dispose();
};

// =============================================================================
// Scale to the official wheelbase, front axle at z = 0, centred on x = 0.
// =============================================================================
const wheelGroups = ['wheels', 'wheels.001', 'wheels.002', 'wheels.003'].map((g) => inGroup(new RegExp(`^${g.replace('.', '\\.')}$`)));
if (wheelGroups.some((l) => !l.length)) throw new Error('groupes de roues introuvables');
const tread = (list) => prims(list).find((p) => matName(p) === 'thread');
let hubs = wheelGroups.map((l) => bbox(tread(l)).center);
const zF = Math.max(...hubs.map((h) => h[2]));
const zR = Math.min(...hubs.map((h) => h[2]));
const scale = WHEELBASE / (zF - zR);
const xMid = hubs.reduce((a, h) => a + h[0], 0) / 4;
const groundY = Math.min(...wheelGroups.map((l) => bbox(tread(l)).min[1]));
transformAll(doc, [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, -xMid * scale, -groundY * scale, -zF * scale, 1]);
hubs = wheelGroups.map((l) => bbox(tread(l)).center);
const ids = hubs.map((h) => (h[2] > -WHEELBASE / 2 ? 'F' : 'R') + (h[0] > 0 ? 'L' : 'R'));
console.log('échelle', scale.toFixed(4), 'roues', ids.map((id, i) => `${id}(${hubs[i].map((v) => v.toFixed(3))}) R=${(bbox(tread(wheelGroups[i])).size[1] / 2).toFixed(3)}`).join(' '));
const car = boxOf(nodes);
console.log('voiture', car.size.map((v) => v.toFixed(3)).join(' × '), 'm (l × h × L)');

// =============================================================================
// Materials: names the game recognises, finishes set again (the source's metal/roughness maps
// are unusable: metal = 1 everywhere, roughness = the colour's luminance).
// =============================================================================
/** name → [new name or null, metalness, roughness, extra] */
const FINISH = {
  remap__prim_env_19_spec: ['paint_body', 0.5, 0.3],
  misc__prim_spec: ['caliper_paint', 0, 0.35, { color: [0.85, 0.28, 0.02, 1], noTexture: true }],
  wheels2__env_19_spec: ['rim_wheel', 0.85, 0.3, { brighten: 215 }],
  discbrake2: ['disc_wheel', 0.7, 0.5],
  thread: ['tyre_tread', 0, 0.92],
  sidewall: ['tyre_sidewall', 0, 0.85],
  plastic__spec: [null, 0, 0.5],
  plastic: [null, 0, 0.55],
  carbon__env_14_spec: [null, 0, 0.22],
  carbon__spec: [null, 0, 0.22],
  light__spec: ['lamp_reflector', 0.85, 0.22],
  perforated__spec: ['int_perforated', 0, 0.8],
  cockpit__spec: ['int_cockpit', 0, 0.75],
  moket__spec: ['int_alcantara', 0, 0.95, { color: [0.5, 0.5, 0.52, 1] }], // black Alcantara (the texture is mid-grey)
  interior__spec: ['int_seats', 0, 0.8, { opaque: true }],
  trim__sec_spec: ['int_seat_trim', 0, 0.9, { color: [0.045, 0.045, 0.05, 1] }],
  stitch__sec_spec: ['int_stitching', 0, 0.8],
  speakers__spec: ['int_speakers', 0.2, 0.6],
  gray__spec: [null, 0, 0.6],
  decals__spec: [null, 0, 0.5],
  'decals__spec_.001': ['tyre_lettering', 0, 0.85],
  'Material.002': [null, 0, 0.5],
  'Material.003': [null, 0.6, 0.3],
  mechanics: [null, 0.6, 0.5],
  misc__spec: [null, 0, 0.6],
  'Matte__FFA2A2A2__env_50_spec': [null, 1, 0.25],
  Matte__FF202020: [null, 0, 0.6],
  Matte__FF151515: [null, 0, 0.6],
  Matte__FF141414__spec: [null, 0, 0.6],
  Matte__FFCCCCCC: ['exhaust_chrome', 1, 0.22],
  Matte__FFFE6601__spec: [null, 0, 0.35],
  Matte__FFB4B4B4: [null, 0, 0.5],
  'Matte__FF808080__env_50_spec': ['mirror_glass', 1, 0.03],
  'Matte__992D2D2D__env_50_spec_trans': ['glass', 0, 0.03, { glass: [0.02, 0.022, 0.025, 0.45] }],
  'Matte__992D2D2D__env_50_spec_trans_.001': ['glass_wing_lamp', 0, 0.03, { glass: [0.6, 0.6, 0.6, 0.2] }],
  headlight_glass: ['glass_lamp_front', 0, 0.02, { glass: [1, 1, 1, 0.08] }],
  brake_light_glass: ['glass_lamp_rear', 0, 0.02, { glass: [0.5, 0.05, 0.05, 0.25] }],
  head_light: ['light_head', 0.3, 0.2],
  vehiclelights__spec: ['light_drl', 0.3, 0.2],
  Hard_brake_light: ['light_brake', 0.2, 0.3],
  brake_park_light: ['light_brake_park', 0.2, 0.3],
  spol_brake_light: ['light_brake_wing', 0.2, 0.3],
  back_light: ['light_reverse', 0.2, 0.3],
  back_int_light: ['indicator_rear', 0.2, 0.3],
  down_light: [null, 0.2, 0.3],
  plate_light: [null, 0.2, 0.3],
  display: ['int_display', 0, 0.3],
  logo__spec: [null, 0.7, 0.3],
  badge__spec: [null, 0.8, 0.3],
};
for (const m of root.listMaterials()) {
  const f = FINISH[m.getName()];
  const [name, metal, rough, extra = {}] = f ?? [null, 0, 0.5];
  if (!f) console.log('matériau sans réglage (mat, rugosité 0,5) :', m.getName());
  m.setMetallicRoughnessTexture(null).setMetallicFactor(metal).setRoughnessFactor(rough);
  if (extra.color) m.setBaseColorFactor(extra.color);
  if (extra.noTexture) m.setBaseColorTexture(null);
  if (extra.opaque) m.setAlphaMode('OPAQUE');
  if (extra.glass) m.setBaseColorTexture(null).setBaseColorFactor(extra.glass).setAlphaMode('BLEND').setDoubleSided(true);
  if (extra.brighten) {
    // The garage's rim colour multiplies the texture: bring the dark source up to ≈ white.
    const tex = m.getBaseColorTexture();
    const { data, info } = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += data[i + 1];
    const g = extra.brighten / (sum / (data.length / 4));
    for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) data[i + c] = Math.min(255, Math.round(data[i + c] * g));
    tex.setImage(new Uint8Array(await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer())).setMimeType('image/png');
  }
  if (name) m.setName(name);
}
// The front indicators repeat the DRL strip's geometry (z-fighting): keep one.
for (const n of inGroup(/^indicator_f$/)) drop(n);

// =============================================================================
// Wheels (`wheel_XX`: rim, tyre, disc, lettering) and calipers (`caliper_XX`, in the hub groups).
// =============================================================================
const nearestHub = (p) => {
  let best = 0;
  hubs.forEach((h, i) => {
    if (Math.hypot(p[0] - h[0], p[2] - h[2]) < Math.hypot(p[0] - hubs[best][0], p[2] - hubs[best][2])) best = i;
  });
  return best;
};
wheelGroups.forEach((list, w) => {
  const mesh = doc.createMesh(`wheel_${ids[w]}`);
  for (const p of prims(list)) mesh.addPrimitive(extract(doc, p, () => true, hubs[w]));
  scene.addChild(doc.createNode(`wheel_${ids[w]}`).setMesh(mesh).setTranslation(hubs[w]));
  list.forEach(drop);
});
const calipers = hubs.map(() => []);
for (const n of inGroup(/^hub_/)) {
  for (const p of [...n.getMesh().listPrimitives()]) {
    if (matName(p) !== 'caliper_paint') continue;
    const w = nearestHub(bbox(p).center);
    calipers[w].push(extract(doc, p, () => true, hubs[w]));
    n.getMesh().removePrimitive(p);
    p.dispose();
  }
  if (!n.getMesh().listPrimitives().length) drop(n);
}
calipers.forEach((list, w) => {
  if (!list.length) return;
  const mesh = doc.createMesh(`caliper_${ids[w]}`);
  for (const p of list) mesh.addPrimitive(p);
  scene.addChild(doc.createNode(`caliper_${ids[w]}`).setMesh(mesh).setTranslation(hubs[w]));
});

// =============================================================================
// Steering wheel (rim + centre badge).
// =============================================================================
const steerNodes = inGroup(/^(movsteer_0_5|steer_badge)$/);
const sw = steeringWheel(doc, scene, prims(steerNodes));
steerNodes.forEach(drop);

// =============================================================================
// Airbrake (`wing_active`): the blade and its lamp hinge on the blade's leading edge.
// =============================================================================
{
  const list = inGroup(/^(movspoiler_22_800|spoiler_glass)$/);
  const b = boxOf(list);
  const pivot = [0, b.center[1], b.max[2] - 0.02];
  const mesh = doc.createMesh('wing_active');
  for (const p of prims(list)) mesh.addPrimitive(extract(doc, p, () => true, pivot));
  scene.addChild(doc.createNode('wing_active').setMesh(mesh).setTranslation(pivot));
  list.forEach(drop);
  console.log('aileron : pivot', pivot.map((v) => v.toFixed(3)).join(','), 'largeur', b.size[0].toFixed(2), 'm');
}

// =============================================================================
// Dihedral doors: skin, trims, window and mirror under a pivot at the top of the front edge.
// =============================================================================
for (const [side, s] of [['L', 'l'], ['R', 'r']]) {
  const list = inGroup(new RegExp(`^(door_${s}f_ok|badge_${s}f_ok|window_${s}f)$`));
  const skin = list.flatMap((n) => n.getMesh().listPrimitives()).filter((p) => matName(p) === 'paint_body');
  const b = skin.map(bbox);
  const xOut = side === 'L' ? Math.max(...b.map((q) => q.max[0])) : Math.min(...b.map((q) => q.min[0]));
  const yTop = Math.max(...b.map((q) => q.max[1]));
  const zFront = Math.max(...b.map((q) => q.max[2]));
  const hinge = [xOut - (side === 'L' ? 0.12 : -0.12), yTop - 0.08, zFront - 0.06];
  const door = doc.createNode(`door_${side}`).setTranslation(hinge);
  scene.addChild(door);
  for (const n of list) {
    for (const p of n.getMesh().listPrimitives()) {
      const a = p.getAttribute('POSITION');
      const arr = a.getArray();
      for (let i = 0; i < arr.length; i += 3) for (let k = 0; k < 3; k++) arr[i + k] -= hinge[k];
      a.setArray(arr);
    }
    // The mirror glass gets its own node: the game renders the live rear view on it.
    const glass = n.getMesh().listPrimitives().find((p) => matName(p) === 'mirror_glass');
    if (glass) {
      n.getMesh().removePrimitive(glass);
      door.addChild(doc.createNode(`mirror_${side}`).setMesh(doc.createMesh(`mirror_${side}`).addPrimitive(glass)));
    }
    scene.removeChild(n);
    door.addChild(n);
  }
  console.log(`porte ${side} : charnière`, hinge.map((v) => v.toFixed(3)).join(','));
}

// =============================================================================
// Instrument cluster (live display), driver's eye, exhaust tips.
// =============================================================================
await dashScreen(doc, scene, sharp, {
  eye: [sw.c[0], sw.c[1] + EYE_UP, sw.c[2] - EYE_BACK],
  aim: [sw.c[0], sw.c[1] + DASH_UP, sw.c[2] + DASH_AHEAD],
  prims: prims(inGroup(/^(cockpit|display)$/)),
  w: 0.24,
  h: 0.1,
});
scene.addChild(doc.createNode('driver_eye').setTranslation([sw.c[0], sw.c[1] + EYE_UP, sw.c[2] - EYE_BACK]));
{
  // Two round tailpipes side by side, high in the middle of the rear grille.
  const pipe = prims(inGroup(/^exhaust$/)).find((p) => matName(p) === 'chassis__spec') ?? prims(inGroup(/^exhaust$/))[0];
  const pos = pipe.getAttribute('POSITION').getArray();
  const side = [[], []];
  for (let i = 0; i < pos.length; i += 3) side[pos[i] > 0 ? 0 : 1].push([pos[i], pos[i + 1], pos[i + 2]]);
  side.forEach((pts, i) => {
    const c = [0, 1, 2].map((k) => pts.reduce((a, p) => a + p[k], 0) / pts.length);
    const zMin = Math.min(...pts.map((p) => p[2]));
    scene.addChild(doc.createNode(`exhaust_tip_${i}`).setTranslation([c[0], c[1], zMin]));
    console.log(`échappement ${i} :`, [c[0], c[1], zMin].map((v) => v.toFixed(3)).join(','));
  });
}

// =============================================================================
// Output.
// =============================================================================
await doc.transform(
  prune({ keepLeaves: true }), // keep the empty marker nodes (driver_eye, exhaust_tip_N)
  // Materials are never merged: their names drive the game (lights, paint, rims…).
  dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await encodeTextures(doc, sharp);
const asset = root.getAsset();
asset.generator = 'apex tools/cars/prepare-mclaren.mjs';
asset.extras = { author: 'MdMahib (https://sketchfab.com/MdMahib)', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/maclaren-675lt-305fede1879d4b7e83596640c4c4c170', title: 'Maclaren 675LT' };
mkdirSync(dirname(OUT), { recursive: true });
await io.write(OUT, doc);
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += indicesOf(p).length / 3;
console.log('écrit', OUT, `${tris | 0} triangles, ${root.listMaterials().length} matériaux, ${root.listTextures().length} textures`);
