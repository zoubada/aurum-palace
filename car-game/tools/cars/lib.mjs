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
    for (const prim of mesh.listPrimitives()) {
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
    if (meta.hasAlpha) alpha = (await sharp(Buffer.from(src)).stats()).channels[3].min < 250;
    const out = alpha ? await img.png({ compressionLevel: 9, palette: false }).toBuffer() : await img.flatten({ background: '#000' }).jpeg({ quality, mozjpeg: true }).toBuffer();
    tex.setImage(new Uint8Array(out)).setMimeType(alpha ? 'image/png' : 'image/jpeg');
    const uri = tex.getURI();
    if (uri) tex.setURI(uri.replace(/\.[a-z0-9]+$/i, alpha ? '.png' : '.jpg'));
  }
}
