import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TrackSample, TrackSpline } from '../TrackSpline';
import { ribbon, type Fn } from '../roadBuilder';

/**
 * Road furniture of a real country road closed for the race (Annecy circuit): asphalt, French
 * markings (3 m dashes / 10 m gaps on straights, continuous line in bends, none in
 * roundabouts, edge lines), grass verges, kerbs and pavements in the villages, steel
 * guardrails on posts, low walls in town, bridge decks, start/finish lines, and the village
 * entry/exit signs (white panel, red border; red bar when leaving). Built in 400 m chunks so
 * frustum culling keeps only what is in view.
 */

export interface RuralMaterials {
  road: THREE.Material;
  line: THREE.Material;
  verge: THREE.Material;
  sidewalk: THREE.Material;
  kerb: THREE.Material;
  rail: THREE.Material;
  post: THREE.Material;
  wall: THREE.Material;
  deck: THREE.Material;
  chequer: THREE.Material;
}

export interface Sign {
  s: number;
  name: string;
  entering: boolean;
}

const CHUNK = 400;
const URBAN = (s: TrackSample) => s.wallL - s.hw < 2;
const BRIDGE = (s: TrackSample) => s.zone === 'bridge';
/** Roundabout ring: tight radius. */
const RING = (s: TrackSample) => Math.abs(s.kappa) > 0.028;

function signTexture(name: string, leaving: boolean): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 192;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4f4f0';
  g.fillRect(0, 0, 512, 192);
  g.strokeStyle = '#c8102e';
  g.lineWidth = 16;
  g.beginPath();
  g.roundRect(14, 14, 484, 164, 18);
  g.stroke();
  g.fillStyle = '#111';
  const text = name.toUpperCase();
  let size = 64;
  g.font = `bold ${size}px "Arial Narrow", Arial, sans-serif`;
  while (g.measureText(text).width > 440 && size > 24) {
    size -= 2;
    g.font = `bold ${size}px "Arial Narrow", Arial, sans-serif`;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 100);
  if (leaving) {
    g.strokeStyle = '#c8102e';
    g.lineWidth = 18;
    g.beginPath();
    g.moveTo(40, 168);
    g.lineTo(472, 24);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function buildRuralRoad(track: TrackSpline, mats: RuralMaterials, signs: Sign[], lines: number[], crossings: Array<[number, number]> = []): THREE.Group {
  const group = new THREE.Group();
  group.name = 'rural-road';
  const n = track.count;
  const zebraIdx = crossings.map(([s]) => track.indexAt(s));
  const nearZebra = (i: number) => zebraIdx.some((z) => Math.abs(z - i) < 7);
  const wall = (side: number): Fn => (s) => side * (side > 0 ? s.wallL : s.wallR);

  for (let c0 = 0; c0 < n; c0 += CHUNK) {
    const c1 = Math.min(n, c0 + CHUNK);
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const add = (m: THREE.Material, g: THREE.BufferGeometry) => {
      if (!byMat.has(m)) byMat.set(m, []);
      byMat.get(m)!.push(g);
    };
    /** Sub-ranges of [c0, c1] where pred holds. */
    const runs = (pred: (s: TrackSample) => boolean) => {
      const out: Array<[number, number]> = [];
      let from = -1;
      for (let i = c0; i <= c1; i++) {
        const on = i < c1 && pred(track.sample(i));
        if (on && from < 0) from = i;
        if (!on && from >= 0) {
          out.push([from, Math.min(i, n)]);
          from = -1;
        }
      }
      return out;
    };

    // Asphalt and edge lines.
    add(mats.road, ribbon(track, c0, c1, 2, (s) => -s.hw, (s) => s.hw, undefined, undefined, 7, 7));
    for (const side of [1, -1]) {
      add(mats.line, ribbon(track, c0, c1, 2, (s) => side * (s.hw - 0.4), (s) => side * (s.hw - 0.25), () => 0.012, () => 0.012));
    }
    // Centre line: dashes on straights, continuous in bends, none in roundabouts / narrow lanes.
    for (const [a, b] of runs((s) => !RING(s) && s.hw >= 2.9 && Math.abs(s.kappa) < 1 / 300)) {
      for (let i = Math.ceil(a / 13) * 13; i + 3 <= b; i += 13) if (!nearZebra(i)) add(mats.line, ribbon(track, i, i + 3, 1, () => -0.07, () => 0.07, () => 0.012, () => 0.012));
    }
    for (const [a, b] of runs((s) => !RING(s) && s.hw >= 2.9 && Math.abs(s.kappa) >= 1 / 300)) {
      add(mats.line, ribbon(track, a, b, 2, () => -0.07, () => 0.07, () => 0.012, () => 0.012));
    }

    // Verges (country) / kerbs and pavements (villages), then the barriers.
    for (const side of [1, -1]) {
      const edge: Fn = (s) => side * s.hw;
      const w = wall(side);
      for (const [a, b] of runs((s) => !URBAN(s) && !BRIDGE(s))) {
        add(mats.verge, ribbon(track, a, b, 2, edge, w, () => 0, () => -0.22, 3, 3));
        // Guardrail: W-beam at 0.45–0.78 m, slightly beyond the verge.
        const r: Fn = (s) => w(s) + side * 0.05;
        add(mats.rail, ribbon(track, a, b, 2, r, r, () => 0.42, () => 0.78, 1, 4));
      }
      for (const [a, b] of runs((s) => URBAN(s) && !BRIDGE(s))) {
        add(mats.kerb, ribbon(track, a, b, 2, edge, edge, () => 0, () => 0.13, 1, 2));
        add(mats.sidewalk, ribbon(track, a, b, 2, edge, w, () => 0.13, () => 0.13, 2, 2));
        // Low wall along the pavement.
        const w2: Fn = (s) => w(s) + side * 0.25;
        add(mats.wall, ribbon(track, a, b, 2, w, w, () => 0.13, () => 0.68, 1, 2));
        add(mats.wall, ribbon(track, a, b, 2, w, w2, () => 0.68, () => 0.68));
        add(mats.wall, ribbon(track, a, b, 2, w2, w2, () => 0.68, () => -0.5));
      }
      for (const [a, b] of runs(BRIDGE)) {
        // Concrete parapet and deck edge.
        const w2: Fn = (s) => w(s) + side * 0.3;
        add(mats.sidewalk, ribbon(track, a, b, 2, edge, w, () => 0.05, () => 0.05));
        add(mats.wall, ribbon(track, a, b, 2, w, w, () => 0.05, () => 0.95));
        add(mats.wall, ribbon(track, a, b, 2, w, w2, () => 0.95, () => 0.95));
        add(mats.wall, ribbon(track, a, b, 2, w2, w2, () => 0.95, () => -1.4));
      }
    }
    for (const [a, b] of runs(BRIDGE)) {
      add(mats.deck, ribbon(track, a, b, 2, (s) => s.wallL + 0.3, (s) => -(s.wallR + 0.3), () => -1.4, () => -1.4));
    }
    // Zebra crossings where OSM maps them: 0.5 m bands, 0.5 m apart, 4 m long, parallel to the
    // traffic; a stop line before the ones with traffic lights.
    for (const [s, lights] of crossings) {
      const i = track.indexAt(s);
      if (i < c0 + 3 || i >= c1 - 3) continue;
      const hw = track.sample(i).hw;
      const bands = Math.floor((2 * hw - 0.6) / 1);
      const first = -((bands - 1) * 1) / 2 - 0.25;
      for (let b = 0; b < bands; b++) {
        const o = first + b;
        add(mats.line, ribbon(track, i - 2, i + 2, 1, () => o, () => o + 0.5, () => 0.014, () => 0.014));
      }
      if (lights) {
        // Traffic keeps right: forward lane is the right half (negative offsets).
        add(mats.line, ribbon(track, i - 6, i - 5, 1, (q) => -q.hw + 0.4, () => -0.15, () => 0.014, () => 0.014));
        add(mats.line, ribbon(track, i + 5, i + 6, 1, () => 0.15, (q) => q.hw - 0.4, () => 0.014, () => 0.014));
      }
    }
    // Start / finish lines.
    for (const s of lines) {
      const i = track.indexAt(s);
      if (i < c0 || i >= c1) continue;
      add(mats.chequer, ribbon(track, i, i + 1, 1, (q) => -q.hw, (q) => q.hw, () => 0.016, () => 0.016, 1.875, 1));
    }

    const chunk = new THREE.Group();
    for (const [m, geos] of byMat) {
      const g = mergeGeometries(geos, false);
      for (const x of geos) x.dispose();
      if (!g) continue;
      const mesh = new THREE.Mesh(g, m);
      mesh.receiveShadow = true;
      mesh.castShadow = m === mats.rail || m === mats.wall;
      chunk.add(mesh);
    }

    // Guardrail posts every 4 m (instanced).
    const posts: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion();
    const tmp = new THREE.Vector3();
    for (let i = c0; i < c1; i += 4) {
      const s = track.sample(i);
      if (URBAN(s) || BRIDGE(s)) continue;
      for (const side of [1, -1]) {
        tmp.copy(s.p).addScaledVector(s.left, side * ((side > 0 ? s.wallL : s.wallR) + 0.18));
        tmp.y += 0.2;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.heading);
        posts.push(new THREE.Matrix4().compose(tmp.clone(), q.clone(), new THREE.Vector3(1, 1, 1)));
      }
    }
    if (posts.length) {
      const geo = new THREE.BoxGeometry(0.1, 1.0, 0.1);
      const inst = new THREE.InstancedMesh(geo, mats.post, posts.length);
      posts.forEach((m, k) => inst.setMatrixAt(k, m));
      inst.castShadow = true;
      inst.computeBoundingSphere();
      chunk.add(inst);
    }
    group.add(chunk);
  }

  // Village signs on the right-hand verge, facing the traffic.
  for (const sg of signs) {
    const i = track.indexAt(sg.s);
    const s = track.sample(i);
    const tex = signTexture(sg.name, !sg.entering);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 0.64),
      [new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 })][0],
    );
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.64), mats.post);
    back.rotation.y = Math.PI;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), mats.post);
    post.position.y = -0.7;
    const sign = new THREE.Group();
    sign.add(panel, back, post);
    sign.position.copy(s.p).addScaledVector(s.left, -(s.wallR + 0.7));
    sign.position.y += 1.8;
    // Face the oncoming car (panel normal opposite to the direction of travel), turned slightly.
    sign.rotation.y = s.heading + Math.PI - 0.15;
    panel.castShadow = post.castShadow = true;
    group.add(sign);
  }
  return group;
}
