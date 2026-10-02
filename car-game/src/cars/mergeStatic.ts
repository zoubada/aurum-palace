import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Merge the static meshes under `root` into one mesh per material (draw-call saver for cars
 * seen from outside, e.g. AI opponents: ~160 meshes → ~30). Nodes in `keep` (and everything
 * under them) are left alone because they move or change visibility. Returns the number of
 * meshes removed.
 */
export function mergeStatic(root: THREE.Object3D, keep: Set<THREE.Object3D>): number {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const rel = new THREE.Matrix4();
  const groups = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean; order: number }>();
  const merged: THREE.Mesh[] = [];

  const visit = (o: THREE.Object3D) => {
    if (keep.has(o)) return;
    for (const c of o.children) visit(c);
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || (m as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (Array.isArray(m.material) || !m.visible || m.material.transparent || m.geometry.morphAttributes.position) return;
    const g = m.geometry;
    const sig = `${m.material.uuid}|${Object.keys(g.attributes).sort().join(',')}|${g.index ? 'i' : 'n'}`;
    rel.multiplyMatrices(inv, m.matrixWorld);
    const geo = g.clone();
    geo.clearGroups();
    geo.applyMatrix4(rel);
    // Mirrored parts: restore the triangle winding.
    if (rel.determinant() < 0) {
      if (geo.index) {
        const idx = geo.index.array;
        for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      } else {
        for (const attr of Object.values(geo.attributes) as THREE.BufferAttribute[]) {
          const n = attr.itemSize;
          const a = attr.array;
          for (let v = 0; v < attr.count; v += 3)
            for (let k = 0; k < n; k++) [a[(v + 1) * n + k], a[(v + 2) * n + k]] = [a[(v + 2) * n + k], a[(v + 1) * n + k]];
        }
      }
    }
    let grp = groups.get(sig);
    if (!grp) {
      grp = { mat: m.material, geos: [], cast: false, receive: false, order: m.renderOrder };
      groups.set(sig, grp);
    }
    grp.geos.push(geo);
    grp.cast ||= m.castShadow;
    grp.receive ||= m.receiveShadow;
    merged.push(m);
  };
  visit(root);

  for (const m of merged) m.removeFromParent();
  for (const grp of groups.values()) {
    const geo = grp.geos.length === 1 ? grp.geos[0] : mergeGeometries(grp.geos, false);
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, grp.mat);
    mesh.castShadow = grp.cast;
    mesh.receiveShadow = grp.receive;
    mesh.renderOrder = grp.order;
    root.add(mesh);
    if (grp.geos.length > 1) for (const g of grp.geos) g.dispose();
  }
  return merged.length - groups.size;
}
