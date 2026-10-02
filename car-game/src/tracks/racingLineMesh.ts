import * as THREE from 'three';
import type { TrackSpline } from './TrackSpline';
import type { RacingLine } from '../ai/RacingLine';

/**
 * The ideal racing line drawn on the road (optional driving aid, SPEC §3), coloured from a
 * car's speed profile: green = accelerate, yellow = lift, red = brake.
 */
export function racingLineMesh(spline: TrackSpline, line: RacingLine, profile: Float64Array): THREE.Mesh {
  const M = line.count;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  const tmp = new THREE.Vector3();
  for (let k = 0; k <= M; k++) {
    const i = k % M;
    const p = line.points[i];
    const smp = spline.sample(spline.indexAt(p.s));
    const ahead = profile[(i + 4) % M];
    const decel = (profile[i] - ahead) / Math.max(1, profile[i]);
    if (decel > 0.02) c.setRGB(0.9, 0.06, 0.04);
    else if (decel > 0.004) c.setRGB(0.9, 0.6, 0.05);
    else c.setRGB(0.08, 0.75, 0.22);
    for (const side of [1, -1]) {
      spline.pointAt(p.s, p.offset + side * 0.25, tmp);
      tmp.addScaledVector(smp.up, 0.03);
      pos.push(tmp.x, tmp.y, tmp.z);
      col.push(c.r, c.g, c.b);
    }
    if (k > 0) {
      const v = k * 2;
      idx.push(v - 2, v - 1, v, v - 1, v + 1, v);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -10,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;
  return mesh;
}
