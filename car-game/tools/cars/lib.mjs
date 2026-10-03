/**
 * Helpers to turn a third-party glTF car (unnamed nodes, arbitrary scale and orientation) into
 * a model that follows the game's convention (assets/cars/README.md): metres, +Y up, front
 * towards +Z, driver's side (left) towards +X, wheels as nodes `wheel_FL…` with their origin at
 * the hub, optional `caliper_XX`, lights split into `light_head` / `light_brake` materials.
 */
import { Accessor } from '@gltf-transform/core';

export const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** column-major 4×4 helpers */
export function mulMat(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

/** Bake every mesh node's world matrix into its vertices and put all mesh nodes under the scene root. */
export function flatten(doc) {
  const scene = doc.getRoot().listScenes()[0];
  const nodes = doc.getRoot().listNodes().filter((n) => n.getMesh());
  const done = new Set();
  for (const n of nodes) {
    const m = n.getWorldMatrix();
    const mesh = n.getMesh();
    if (done.has(mesh)) throw new Error('mesh shared by several nodes: not handled');
    done.add(mesh);
    // Mirrored instances (negative scale, e.g. right-hand wheels copied from the left ones): once
    // the reflection is baked into the vertices the triangles must turn the other way round, or
    // their front faces point inwards and get culled (the part looks missing).
    const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
    for (const prim of mesh.listPrimitives()) {
      unshare(prim);
      if (det < 0) flipWinding(doc, prim);
      const pos = prim.getAttribute('POSITION');
      const a = pos.getArray();
      for (let i = 0; i < a.length; i += 3) {
        const x = a[i], y = a[i + 1], z = a[i + 2];
        a[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
        a[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
        a[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      }
      pos.setArray(a);
      const nor = prim.getAttribute('NORMAL');
      if (nor) {
        const b = nor.getArray();
        for (let i = 0; i < b.length; i += 3) {
          const x = b[i], y = b[i + 1], z = b[i + 2];
          // Uniform-scale rotation assumed (checked by the caller via unit normals).
          const nx = m[0] * x + m[4] * y + m[8] * z;
          const ny = m[1] * x + m[5] * y + m[9] * z;
          const nz = m[2] * x + m[6] * y + m[10] * z;
          const l = Math.hypot(nx, ny, nz) || 1;
          b[i] = nx / l;
          b[i + 1] = ny / l;
          b[i + 2] = nz / l;
        }
        nor.setArray(b);
      }
      const tan = prim.getAttribute('TANGENT');
      if (tan) {
        const t = tan.getArray();
        for (let i = 0; i < t.length; i += 4) {
          const x = t[i], y = t[i + 1], z = t[i + 2];
          const nx = m[0] * x + m[4] * y + m[8] * z;
          const ny = m[1] * x + m[5] * y + m[9] * z;
          const nz = m[2] * x + m[6] * y + m[10] * z;
          const l = Math.hypot(nx, ny, nz) || 1;
          t[i] = nx / l;
          t[i + 1] = ny / l;
          t[i + 2] = nz / l;
        }
        tan.setArray(t);
      }
    }
  }
  for (const n of doc.getRoot().listNodes()) {
    const p = n.getParentNode();
    if (p) p.removeChild(n);
    if (n.getMesh()) {
      n.setMatrix(IDENT);
      scene.addChild(n);
    }
  }
  for (const n of doc.getRoot().listNodes()) if (!n.getMesh() && !n.getParentNode() && !scene.listChildren().includes(n)) n.dispose();
  return doc.getRoot().listNodes().filter((n) => n.getMesh());
}

/**
 * Give the primitive its own copy of any accessor another primitive also uses (exporters share
 * identical index lists between copies of a part): baking one node's matrix must not move or
 * re-wind the others.
 */
function unshare(prim) {
  const shared = (acc) => acc.listParents().filter((p) => p.propertyType === 'Primitive').length > 1;
  for (const sem of prim.listSemantics()) {
    const acc = prim.getAttribute(sem);
    if (shared(acc)) prim.setAttribute(sem, acc.clone());
  }
  const idx = prim.getIndices();
  if (idx && shared(idx)) prim.setIndices(idx.clone());
}

/** Reverse the vertex order of every triangle (indexes the primitive when it is not). */
function flipWinding(doc, prim) {
  const idx = indicesOf(prim);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t + 1];
    idx[t + 1] = idx[t + 2];
    idx[t + 2] = a;
  }
  const n = prim.getAttribute('POSITION').getCount();
  const arr = n > 65535 ? idx : Uint16Array.from(idx);
  const acc = prim.getIndices();
  if (acc) acc.setArray(arr);
  else prim.setIndices(doc.createAccessor().setType(Accessor.Type.SCALAR).setArray(arr).setBuffer(prim.getAttribute('POSITION').getBuffer()));
}

/** Apply p' = M·p to every vertex of every mesh (rotation + uniform scale + translation, column-major). */
export function transformAll(doc, M) {
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const a = pos.getArray();
      for (let i = 0; i < a.length; i += 3) {
        const x = a[i], y = a[i + 1], z = a[i + 2];
        a[i] = M[0] * x + M[4] * y + M[8] * z + M[12];
        a[i + 1] = M[1] * x + M[5] * y + M[9] * z + M[13];
        a[i + 2] = M[2] * x + M[6] * y + M[10] * z + M[14];
      }
      pos.setArray(a);
      for (const [name, stride] of [['NORMAL', 3], ['TANGENT', 4]]) {
        const acc = prim.getAttribute(name);
        if (!acc) continue;
        const b = acc.getArray();
        for (let i = 0; i < b.length; i += stride) {
          const x = b[i], y = b[i + 1], z = b[i + 2];
          const nx = M[0] * x + M[4] * y + M[8] * z;
          const ny = M[1] * x + M[5] * y + M[9] * z;
          const nz = M[2] * x + M[6] * y + M[10] * z;
          const l = Math.hypot(nx, ny, nz) || 1;
          b[i] = nx / l;
          b[i + 1] = ny / l;
          b[i + 2] = nz / l;
        }
        acc.setArray(b);
      }
    }
}

export function bbox(prim) {
  const a = prim.getAttribute('POSITION').getArray();
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < a.length; i += 3)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], a[i + k]);
      max[k] = Math.max(max[k], a[i + k]);
    }
  return { min, max, center: min.map((v, k) => (v + max[k]) / 2), size: min.map((v, k) => max[k] - v) };
}

/** Indices of a primitive as a plain Uint32Array (generated when the primitive is not indexed). */
export function indicesOf(prim) {
  const idx = prim.getIndices();
  if (idx) return Uint32Array.from(idx.getArray());
  const n = prim.getAttribute('POSITION').getCount();
  return Uint32Array.from({ length: n }, (_, i) => i);
}

export function triCentroid(pos, idx, t) {
  const i = idx[t * 3] * 3, j = idx[t * 3 + 1] * 3, k = idx[t * 3 + 2] * 3;
  return [(pos[i] + pos[j] + pos[k]) / 3, (pos[i + 1] + pos[j + 1] + pos[k + 1]) / 3, (pos[i + 2] + pos[j + 2] + pos[k + 2]) / 3];
}

/**
 * New primitive holding the triangles of `prim` for which keep(t) is true, with compacted
 * vertices; `offset` is subtracted from positions (to re-centre wheel parts on their hub).
 */
export function extract(doc, prim, keep, offset = [0, 0, 0]) {
  const idx = indicesOf(prim);
  const remap = new Map();
  const list = [];
  const out = [];
  for (let t = 0; t < idx.length / 3; t++) {
    if (!keep(t)) continue;
    for (let c = 0; c < 3; c++) {
      const v = idx[t * 3 + c];
      let n = remap.get(v);
      if (n === undefined) {
        n = list.length;
        remap.set(v, n);
        list.push(v);
      }
      out.push(n);
    }
  }
  if (!out.length) return null;
  const np = doc.createPrimitive();
  for (const sem of prim.listSemantics()) {
    const src = prim.getAttribute(sem);
    const size = src.getElementSize();
    const Arr = src.getArray().constructor;
    const dst = new Arr(list.length * size);
    const s = src.getArray();
    for (let i = 0; i < list.length; i++) for (let c = 0; c < size; c++) dst[i * size + c] = s[list[i] * size + c];
    if (sem === 'POSITION') for (let i = 0; i < list.length; i++) for (let c = 0; c < 3; c++) dst[i * 3 + c] -= offset[c];
    np.setAttribute(sem, doc.createAccessor().setType(src.getType()).setArray(dst).setBuffer(src.getBuffer()).setNormalized(src.getNormalized()));
  }
  np.setIndices(doc.createAccessor().setType(Accessor.Type.SCALAR).setArray(list.length > 65535 ? Uint32Array.from(out) : Uint16Array.from(out)).setBuffer(prim.getAttribute('POSITION').getBuffer()));
  np.setMaterial(prim.getMaterial());
  np.setMode(prim.getMode());
  return np;
}

/**
 * Textures re-encoded in formats every browser decodes (older Safari has no WebP): JPEG, or PNG
 * when the alpha channel is used. Longest side capped at `max` px.
 */
export async function encodeTextures(doc, sharp, { max = 1024, quality = 86 } = {}) {
  for (const tex of doc.getRoot().listTextures()) {
    const src = tex.getImage();
    if (!src) continue;
    let img = sharp(Buffer.from(src));
    const meta = await img.metadata();
    if (Math.max(meta.width, meta.height) > max) img = img.resize(max, max, { fit: 'inside' });
    let alpha = false;
    if (meta.hasAlpha) {
      const ch = (await sharp(Buffer.from(src)).stats()).channels;
      alpha = ch[ch.length - 1].min < 250; // last channel (grey + alpha images have two)
    }
    const out = alpha ? await img.png({ compressionLevel: 9, palette: false }).toBuffer() : await img.flatten({ background: '#000' }).jpeg({ quality, mozjpeg: true }).toBuffer();
    tex.setImage(new Uint8Array(out)).setMimeType(alpha ? 'image/png' : 'image/jpeg');
    const uri = tex.getURI();
    if (uri) tex.setURI(uri.replace(/\.[a-z0-9]+$/i, alpha ? '.png' : '.jpg'));
  }
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Steering wheel made from the given primitives (taken out of their meshes by the caller): its
 * axis is the smallest principal axis of the rim's vertices, the node gets local +Z along the
 * column (forward) and its origin at the wheel's centre. Returns the centre and the axis.
 */
export function steeringWheel(doc, scene, prims) {
  const all = [];
  for (const p of prims) {
    const a = p.getAttribute('POSITION').getArray();
    for (let i = 0; i < a.length; i += 3) all.push([a[i], a[i + 1], a[i + 2]]);
  }
  const lo = [0, 1, 2].map((k) => Math.min(...all.map((p) => p[k])));
  const hi = [0, 1, 2].map((k) => Math.max(...all.map((p) => p[k])));
  const c = lo.map((v, k) => (v + hi[k]) / 2);
  // Covariance → the smallest eigenvector is the wheel's axis (power iteration on (trace·I − C)).
  const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const p of all) {
    const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
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
  // Rotation about X taking +Z to the column axis (the column has no sideways component).
  const tilt = Math.atan2(-ax[1], ax[2]);
  console.log('volant : axe', ax.map((v) => v.toFixed(3)).join(','), 'inclinaison', ((tilt * 180) / Math.PI).toFixed(1), '°');
  const cos = Math.cos(tilt), sin = Math.sin(tilt);
  const mesh = doc.createMesh('steering_wheel');
  for (const p of prims) {
    const np = extract(doc, p, () => true, c);
    for (const sem of ['POSITION', 'NORMAL']) {
      const acc = np.getAttribute(sem);
      if (!acc) continue;
      const a = acc.getArray();
      for (let i = 0; i < a.length; i += 3) {
        const y = a[i + 1], z = a[i + 2];
        a[i + 1] = cos * y + sin * z; // R_x(−tilt): world → wheel frame
        a[i + 2] = -sin * y + cos * z;
      }
      acc.setArray(a);
    }
    mesh.addPrimitive(np);
  }
  scene.addChild(doc.createNode('steering_wheel').setMesh(mesh).setTranslation(c).setRotation([Math.sin(tilt / 2), 0, 0, Math.cos(tilt / 2)]));
  return { c, ax };
}

/**
 * Instrument cluster: from the driver's eye towards `aim` (through the wheel's upper opening),
 * the first surface of `prims` hit is the cluster; a w × h quad named `dash_screen` (the game
 * draws its live display on it) is laid flat on it, 5 mm in front, rows kept horizontal.
 */
export async function dashScreen(doc, scene, sharp, { eye, aim, prims, w, h }) {
  const dir = aim.map((v, k) => v - eye[k]);
  const len = Math.hypot(...dir);
  const d = dir.map((v) => v / len);
  let hit = Infinity;
  let hitN = null;
  for (const prim of prims) {
    const pos = prim.getAttribute('POSITION').getArray();
    const idx = indicesOf(prim);
    for (let t = 0; t < idx.length / 3; t++) {
      const P = [0, 1, 2].map((j) => [pos[idx[t * 3 + j] * 3], pos[idx[t * 3 + j] * 3 + 1], pos[idx[t * 3 + j] * 3 + 2]]);
      const e1 = P[1].map((v, k) => v - P[0][k]);
      const e2 = P[2].map((v, k) => v - P[0][k]);
      const pv = cross(d, e2);
      const det = dot(e1, pv);
      if (Math.abs(det) < 1e-12) continue;
      const tv = eye.map((v, k) => v - P[0][k]);
      const u = dot(tv, pv) / det;
      if (u < 0 || u > 1) continue;
      const qv = cross(tv, e1);
      const v = dot(d, qv) / det;
      if (v < 0 || u + v > 1) continue;
      const dist = dot(e2, qv) / det;
      if (dist > 0.3 && dist < hit) {
        hit = dist;
        const n = cross(e1, e2);
        const l = Math.hypot(...n);
        hitN = n.map((x) => x / l);
        if (dot(hitN, d) > 0) hitN = hitN.map((x) => -x); // towards the driver
      }
    }
  }
  if (!Number.isFinite(hit)) throw new Error('combiné introuvable');
  const ctr = eye.map((v, k) => v + d[k] * (hit - 0.005));
  console.log('combiné à', hit.toFixed(3), 'm des yeux, centre', ctr.map((v) => v.toFixed(3)).join(','), 'normale', hitN.map((v) => v.toFixed(2)).join(','));
  const quad = new Float32Array([-w / 2, -h / 2, 0, w / 2, -h / 2, 0, w / 2, h / 2, 0, -w / 2, h / 2, 0]);
  const nrm = new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]);
  // Seen from the driver (looking towards +Z), +X is on the viewer's left: u runs the other way.
  const quv = new Float32Array([1, 1, 0, 1, 0, 0, 1, 0]);
  const buf = doc.getRoot().listBuffers()[0];
  const sp = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(quad).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nrm).setBuffer(buf))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(quv).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 2, 1, 0, 3, 2])).setBuffer(buf))
    // A (dummy) texture keeps `prune` from dropping the UV set: the game replaces the material.
    .setMaterial(doc.createMaterial('dash_screen_material').setBaseColorFactor([0, 0, 0, 1]).setBaseColorTexture(doc.createTexture('dash_dummy').setMimeType('image/png').setImage(new Uint8Array(await sharp({ create: { width: 2, height: 2, channels: 3, background: '#000' } }).png().toBuffer()))));
  // Local −Z = the surface normal, local X horizontal.
  const Z = hitN.map((x) => -x);
  const Xr = [Z[2], 0, -Z[0]]; // up × Z
  const xl = Math.hypot(...Xr);
  const X = Xr.map((x) => x / xl);
  const Y = cross(Z, X);
  const tr = X[0] + Y[1] + Z[2];
  const qw = Math.sqrt(Math.max(0, 1 + tr)) / 2;
  const q = [(Y[2] - Z[1]) / (4 * qw), (Z[0] - X[2]) / (4 * qw), (X[1] - Y[0]) / (4 * qw), qw];
  scene.addChild(doc.createNode('dash_screen').setMesh(doc.createMesh('dash_screen').addPrimitive(sp)).setTranslation(ctr).setRotation(q));
  return ctr;
}
