import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rectangleWalls, type Wall } from '../physics/collision';
import type { Vehicle } from '../physics/vehicle';
import type { QualitySettings } from '../core/quality';
import { asphaltTextures, concreteTexture, grassTexture, signTexture } from '../render/textures';

/**
 * Phase 1 flat test area ("piste d'essai"):
 *  - 800 m straight with distance boards and braking boxes (0–100, top speed, braking tests)
 *  - 50 m skidpad (lateral grip)
 *  - cone slalom (knockable cones)
 *  - a painted handling loop to practise on
 *  - concrete barriers all around (collisions), trees, light poles, a grandstand for scale.
 *
 * Everything here is a development environment, not one of the 3 circuits of SPEC §5.
 */

const MIN_X = -420;
const MAX_X = 420;
const MIN_Z = -260;
const MAX_Z = 260;

interface Cone {
  home: THREE.Vector3;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  tilt: number;
  tiltAxis: THREE.Vector3;
  spinY: number;
  moving: boolean;
}

/** Seeded RNG so the scenery is identical on every load. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class TestTrack {
  readonly group = new THREE.Group();
  readonly walls: Wall[] = rectangleWalls(MIN_X, MAX_X, MIN_Z, MAX_Z);
  /** Spawn on the main straight, facing +X (east). */
  readonly spawn = { x: -385, z: -200, yaw: Math.PI / 2 };
  readonly name = "Piste d'essai";

  private cones: Cone[] = [];
  private coneMesh!: THREE.InstancedMesh;
  private trunks!: THREE.InstancedMesh;
  private crowns!: THREE.InstancedMesh;
  private readonly tmpM = new THREE.Matrix4();
  private readonly tmpQ = new THREE.Quaternion();
  private readonly tmpS = new THREE.Vector3(1, 1, 1);

  constructor(quality: QualitySettings, maxAnisotropy: number) {
    this.buildGround(Math.min(quality.anisotropy, maxAnisotropy));
    this.buildMarkings();
    this.buildBarriers();
    this.buildCones();
    this.buildScenery();
    this.applyQuality(quality);
  }

  applyQuality(q: QualitySettings): void {
    this.trunks.count = Math.min(q.treeCount, this.trunks.instanceMatrix.count);
    this.crowns.count = this.trunks.count;
  }

  // ---------------------------------------------------------------------------

  private buildGround(anisotropy: number): void {
    const tex = asphaltTextures(1024);
    const tile = 7; // metres per texture tile
    const w = MAX_X - MIN_X + 6;
    const h = MAX_Z - MIN_Z + 6;
    for (const t of [tex.map, tex.roughness, tex.bump]) {
      t.repeat.set(w / tile, h / tile);
      t.anisotropy = anisotropy;
    }
    const macro = tex.map.clone();
    macro.repeat.set(1, 1);
    const asphalt = new THREE.MeshStandardMaterial({
      map: tex.map,
      roughnessMap: tex.roughness,
      bumpMap: tex.bump,
      bumpScale: 0.6,
      roughness: 1,
      metalness: 0,
    });
    // Large-scale tone variation breaks up visible texture tiling.
    asphalt.onBeforeCompile = (shader) => {
      shader.uniforms.macroMap = { value: macro };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vMacroUv;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMacroUv = uv * 2.3;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D macroMap;\nvarying vec2 vMacroUv;')
        .replace(
          '#include <map_fragment>',
          '#include <map_fragment>\nfloat macroV = texture2D(macroMap, vMacroUv).r;\ndiffuseColor.rgb *= mix(0.75, 1.3, smoothstep(0.1, 0.35, macroV));',
        );
    };
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(w, h), asphalt);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((MIN_X + MAX_X) / 2, 0, (MIN_Z + MAX_Z) / 2);
    ground.receiveShadow = true;
    this.group.add(ground);

    const grassMap = grassTexture(512);
    grassMap.repeat.set(600, 600);
    grassMap.anisotropy = anisotropy;
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      new THREE.MeshStandardMaterial({ map: grassMap, roughness: 0.95 }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.03;
    grass.receiveShadow = true;
    this.group.add(grass);
  }

  /** Painted lines, merged into a single draw call. */
  private buildMarkings(): void {
    const white: THREE.BufferGeometry[] = [];
    const yellow: THREE.BufferGeometry[] = [];
    const y = 0.006;

    const strip = (pts: THREE.Vector2[], width: number, closed: boolean): THREE.BufferGeometry => {
      const pos: number[] = [];
      const idx: number[] = [];
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const prev = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
        const next = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
        const dx = next.x - prev.x;
        const dz = next.y - prev.y;
        const len = Math.hypot(dx, dz) || 1;
        const nx = (-dz / len) * (width / 2);
        const nz = (dx / len) * (width / 2);
        pos.push(pts[i].x + nx, y, pts[i].y + nz, pts[i].x - nx, y, pts[i].y - nz);
      }
      const segs = closed ? n : n - 1;
      for (let i = 0; i < segs; i++) {
        const a = i * 2;
        const b = ((i + 1) % n) * 2;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    const line = (x1: number, z1: number, x2: number, z2: number, w: number) =>
      strip([new THREE.Vector2(x1, z1), new THREE.Vector2(x2, z2)], w, false);
    const circle = (cx: number, cz: number, r: number, w: number) => {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i < 160; i++) {
        const a = (i / 160) * Math.PI * 2;
        pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cz + Math.sin(a) * r));
      }
      return strip(pts, w, true);
    };

    // Main straight: edges, dashed centre, start line, a board every 100 m.
    const zs = this.spawn.z;
    white.push(line(-405, zs - 10, 405, zs - 10, 0.2), line(-405, zs + 10, 405, zs + 10, 0.2));
    for (let x = -400; x < 400; x += 12) white.push(line(x, zs, x + 6, zs, 0.15));
    white.push(line(-375, zs - 10, -375, zs + 10, 0.6));
    for (let d = 100; d <= 700; d += 100) {
      white.push(line(-375 + d, zs - 10, -375 + d, zs - 7, 0.3), line(-375 + d, zs + 7, -375 + d, zs + 10, 0.3));
    }
    // Braking boxes at the end of the straight.
    for (let x = 330; x <= 390; x += 15) yellow.push(line(x, zs - 6, x, zs + 6, 0.4));

    // Skidpad: R = 50 m (inner and outer guide circles).
    white.push(circle(-230, 60, 45, 0.25), circle(-230, 60, 55, 0.25));
    yellow.push(circle(-230, 60, 50, 0.12));

    // Handling loop.
    const loopPts = [
      [-60, -130],
      [150, -140],
      [320, -120],
      [375, -50],
      [345, 30],
      [240, 45],
      [160, 95],
      [190, 170],
      [300, 195],
      [370, 215],
      [330, 238],
      [100, 225],
      [-60, 205],
      [-120, 125],
      [-105, 0],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(loopPts, true, 'centripetal');
    const samples = curve.getSpacedPoints(700).slice(0, -1);
    const offset = (d: number) => {
      const out: THREE.Vector2[] = [];
      for (let i = 0; i < samples.length; i++) {
        const p = samples[i];
        const q = samples[(i + 1) % samples.length];
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        const len = Math.hypot(dx, dz) || 1;
        out.push(new THREE.Vector2(p.x - (dz / len) * d, p.z + (dx / len) * d));
      }
      return out;
    };
    white.push(strip(offset(7), 0.22, true), strip(offset(-7), 0.22, true));
    for (let i = 0; i < samples.length; i += 6) {
      const seg = [samples[i], samples[(i + 2) % samples.length]].map((p) => new THREE.Vector2(p.x, p.z));
      yellow.push(strip(seg, 0.12, false));
    }

    const paint = (color: number, geos: THREE.BufferGeometry[]) => {
      const mesh = new THREE.Mesh(
        mergeGeometries(geos),
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.6,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      );
      mesh.receiveShadow = true;
      this.group.add(mesh);
      geos.forEach((g) => g.dispose());
    };
    paint(0xe9e9e4, white);
    paint(0xe2b21c, yellow);

    // Distance boards along the straight.
    for (let d = 100; d <= 700; d += 100) {
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 1.2),
        new THREE.MeshStandardMaterial({ map: signTexture(String(d), '#f2f2f2', '#c01818'), roughness: 0.6 }),
      );
      board.position.set(-375 + d, 1.9, zs - 14);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 1.9, 8),
        new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.4 }),
      );
      post.position.set(-375 + d, 0.95, zs - 14.05);
      board.castShadow = post.castShadow = true;
      this.group.add(board, post);
    }
  }

  private buildBarriers(): void {
    // Jersey barrier cross-section (lateral offset, height), extruded 3.9 m.
    const s = new THREE.Shape();
    s.moveTo(-0.3, 0);
    s.lineTo(0.3, 0);
    s.lineTo(0.3, 0.08);
    s.lineTo(0.18, 0.28);
    s.lineTo(0.08, 0.81);
    s.lineTo(-0.08, 0.81);
    s.lineTo(-0.18, 0.28);
    s.lineTo(-0.3, 0.08);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 3.9, bevelEnabled: false });
    geo.translate(0, 0, -1.95);
    const map = concreteTexture(512);
    map.repeat.set(0.5, 0.5);
    const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.9 });

    const placements: Array<[number, number, number]> = [];
    const run = (x1: number, z1: number, x2: number, z2: number) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const n = Math.ceil(len / 4);
      const yaw = Math.atan2(x2 - x1, z2 - z1);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        placements.push([x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, yaw]);
      }
    };
    const o = 0.3; // barrier half-width: its inner face sits on the collision wall
    run(MIN_X - o, MIN_Z - o, MAX_X + o, MIN_Z - o);
    run(MIN_X - o, MAX_Z + o, MAX_X + o, MAX_Z + o);
    run(MIN_X - o, MIN_Z - o, MIN_X - o, MAX_Z + o);
    run(MAX_X + o, MIN_Z - o, MAX_X + o, MAX_Z + o);

    const mesh = new THREE.InstancedMesh(geo, mat, placements.length);
    placements.forEach(([x, z, yaw], i) => {
      this.tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      this.tmpM.compose(new THREE.Vector3(x, 0, z), this.tmpQ, this.tmpS);
      mesh.setMatrixAt(i, this.tmpM);
    });
    mesh.castShadow = mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private buildCones(): void {
    const zs = this.spawn.z;
    const homes: THREE.Vector3[] = [];
    for (let i = 0; i < 13; i++) homes.push(new THREE.Vector3(-300 + i * 18, 0, zs + 35));
    // Lane-change gate (ISO 3888-like) further along.
    for (const x of [-20, -8, 4]) homes.push(new THREE.Vector3(x, 0, zs + 31), new THREE.Vector3(x, 0, zs + 34));
    for (const x of [24, 36]) homes.push(new THREE.Vector3(x, 0, zs + 34.5), new THREE.Vector3(x, 0, zs + 37.5));
    for (const x of [56, 68, 80]) homes.push(new THREE.Vector3(x, 0, zs + 31), new THREE.Vector3(x, 0, zs + 34));

    const body = new THREE.ConeGeometry(0.16, 0.7, 20, 1, true);
    body.translate(0, 0.38, 0);
    const base = new THREE.BoxGeometry(0.42, 0.04, 0.42);
    base.translate(0, 0.02, 0);
    const geo = mergeGeometries([body.toNonIndexed(), base.toNonIndexed()]);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff5a0a, roughness: 0.55 });
    this.coneMesh = new THREE.InstancedMesh(geo, mat, homes.length);
    this.coneMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coneMesh.castShadow = true;
    this.cones = homes.map((h) => ({
      home: h.clone(),
      pos: h.clone(),
      vel: new THREE.Vector3(),
      tilt: 0,
      tiltAxis: new THREE.Vector3(1, 0, 0),
      spinY: 0,
      moving: false,
    }));
    this.cones.forEach((_, i) => this.writeCone(i));
    this.group.add(this.coneMesh);
  }

  private writeCone(i: number): void {
    const c = this.cones[i];
    this.tmpQ.setFromAxisAngle(c.tiltAxis, c.tilt);
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.spinY);
    this.tmpQ.multiply(qy);
    this.tmpM.compose(c.pos, this.tmpQ, this.tmpS);
    this.coneMesh.setMatrixAt(i, this.tmpM);
  }

  resetCones(): void {
    this.cones.forEach((c, i) => {
      c.pos.copy(c.home);
      c.vel.set(0, 0, 0);
      c.tilt = 0;
      c.spinY = 0;
      c.moving = false;
      this.writeCone(i);
    });
    this.coneMesh.instanceMatrix.needsUpdate = true;
  }

  private buildScenery(): void {
    const rand = mulberry32(1234);
    // Trees scattered outside the barriers.
    const maxTrees = 1600;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 3, 6);
    trunkGeo.translate(0, 1.5, 0);
    const crownGeo = new THREE.ConeGeometry(2.4, 7, 8);
    crownGeo.translate(0, 6, 0);
    this.trunks = new THREE.InstancedMesh(
      trunkGeo,
      new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.95 }),
      maxTrees,
    );
    this.crowns = new THREE.InstancedMesh(
      crownGeo,
      new THREE.MeshStandardMaterial({ color: 0x2f4a26, roughness: 0.9 }),
      maxTrees,
    );
    const color = new THREE.Color();
    for (let i = 0; i < maxTrees; i++) {
      let x = 0;
      let z = 0;
      do {
        x = (rand() - 0.5) * 2400;
        z = (rand() - 0.5) * 1800;
      } while (x > MIN_X - 25 && x < MAX_X + 25 && z > MIN_Z - 45 && z < MAX_Z + 25);
      const s = 0.7 + rand() * 0.8;
      this.tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
      this.tmpM.compose(new THREE.Vector3(x, 0, z), this.tmpQ, new THREE.Vector3(s, s * (0.8 + rand() * 0.5), s));
      this.trunks.setMatrixAt(i, this.tmpM);
      this.crowns.setMatrixAt(i, this.tmpM);
      color.setHSL(0.27 + rand() * 0.06, 0.35 + rand() * 0.2, 0.18 + rand() * 0.1);
      this.crowns.setColorAt(i, color);
    }
    this.trunks.castShadow = this.crowns.castShadow = true;
    this.trunks.frustumCulled = this.crowns.frustumCulled = false;
    this.group.add(this.trunks, this.crowns);

    // Light poles along the straight.
    const poleGeo = mergeGeometries([
      new THREE.CylinderGeometry(0.12, 0.18, 10, 8).translate(0, 5, 0),
      new THREE.BoxGeometry(0.15, 0.15, 2.5).translate(0, 9.9, 1.2),
      new THREE.BoxGeometry(0.6, 0.15, 0.35).translate(0, 9.85, 2.4),
    ]);
    const poles = new THREE.InstancedMesh(
      poleGeo,
      new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.35 }),
      17,
    );
    for (let i = 0; i < 17; i++) {
      this.tmpQ.identity();
      this.tmpM.compose(new THREE.Vector3(-400 + i * 50, 0, MIN_Z - 2.5), this.tmpQ, this.tmpS);
      poles.setMatrixAt(i, this.tmpM);
    }
    poles.castShadow = true;
    this.group.add(poles);

    // Grandstand + control tower next to the start.
    const concrete = new THREE.MeshStandardMaterial({ map: concreteTexture(256), roughness: 0.85 });
    const seats = new THREE.MeshStandardMaterial({ color: 0x1f5fae, roughness: 0.6 });
    for (let row = 0; row < 8; row++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(220, 0.5, 1.1), row % 2 ? concrete : seats);
      step.position.set(-150, 0.5 + row * 0.55, MIN_Z - 12 - row * 1.1);
      step.castShadow = step.receiveShadow = true;
      this.group.add(step);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(224, 0.3, 12), concrete);
    roof.position.set(-150, 9.5, MIN_Z - 15.5);
    roof.castShadow = true;
    this.group.add(roof);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(10, 18, 10), concrete);
    tower.position.set(-372, 9, MIN_Z - 20);
    const glassBand = new THREE.Mesh(
      new THREE.BoxGeometry(10.4, 3, 10.4),
      new THREE.MeshPhysicalMaterial({ color: 0x0d1a26, metalness: 0.2, roughness: 0.05, clearcoat: 1 }),
    );
    glassBand.position.set(-372, 15.5, MIN_Z - 20);
    tower.castShadow = glassBand.castShadow = true;
    this.group.add(tower, glassBand);
  }

  // ---------------------------------------------------------------------------

  /** Knock cones the car drives into (cheap kinematic response, not Rapier). */
  update(dt: number, vehicle: Vehicle, front: number, rear: number, halfWidth: number): void {
    const sy = Math.sin(vehicle.yaw);
    const cy = Math.cos(vehicle.yaw);
    let dirty = false;
    for (let i = 0; i < this.cones.length; i++) {
      const c = this.cones[i];
      if (c.pos.y < 0.05 && c.vel.lengthSq() < 0.01 && c.tilt === 0) {
        const dx = c.pos.x - vehicle.x;
        const dz = c.pos.z - vehicle.z;
        const f = dx * sy + dz * cy;
        const l = dx * cy - dz * sy;
        if (f < front + 0.2 && f > -rear - 0.2 && Math.abs(l) < halfWidth + 0.2) {
          const [vx, vz] = vehicle.pointVelocity(c.pos.x, c.pos.z);
          const speed = Math.hypot(vx, vz);
          if (speed > 0.5) {
            c.vel.set(vx * 1.15 + (Math.random() - 0.5) * 2, 1.5 + speed * 0.12, vz * 1.15 + (Math.random() - 0.5) * 2);
            c.tiltAxis.set(vz, 0, -vx).normalize();
            c.moving = true;
          }
        }
      }
      if (!c.moving) continue;
      dirty = true;
      c.vel.y -= 9.81 * dt;
      c.pos.addScaledVector(c.vel, dt);
      c.tilt = Math.min(Math.PI / 2, c.tilt + dt * 6);
      c.spinY += dt * 4;
      if (c.pos.y <= 0) {
        c.pos.y = 0;
        c.vel.y = Math.abs(c.vel.y) > 1 ? -c.vel.y * 0.3 : 0;
        c.vel.x *= Math.exp(-4 * dt);
        c.vel.z *= Math.exp(-4 * dt);
        if (c.vel.lengthSq() < 0.02) {
          c.vel.set(0, 0, 0);
          c.moving = false;
        }
      }
      this.writeCone(i);
    }
    if (dirty) this.coneMesh.instanceMatrix.needsUpdate = true;
  }
}
