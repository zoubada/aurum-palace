import * as THREE from 'three';
import type { Vehicle } from '../physics/vehicle';
import { radialTexture } from './textures';

/**
 * Tire effects driven by the physics: skid marks laid where the contact patch
 * slides, and tire smoke. Both use fixed-size GPU buffers (ring buffers).
 */

const MAX_MARKS = 8000;
const MARK_WIDTH = 0.24;
const MAX_SMOKE = 600;

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  strength: number;
}

export class TireEffects {
  readonly group = new THREE.Group();

  // Skid marks
  private readonly markPos = new Float32Array(MAX_MARKS * 4 * 3);
  private readonly markCol = new Float32Array(MAX_MARKS * 4 * 4);
  private readonly markGeo = new THREE.BufferGeometry();
  private markHead = 0;
  private markCount = 0;
  /** Last laid edge per wheel (centre, left edge, right edge). */
  private readonly last: Array<{ x: number; z: number; lx: number; lz: number; rx: number; rz: number } | null> = [
    null,
    null,
    null,
    null,
  ];

  // Smoke
  private readonly particles: Particle[] = [];
  private readonly smokePos = new Float32Array(MAX_SMOKE * 3);
  private readonly smokeSize = new Float32Array(MAX_SMOKE);
  private readonly smokeAlpha = new Float32Array(MAX_SMOKE);
  private readonly smokeGeo = new THREE.BufferGeometry();
  private readonly smokeMat: THREE.ShaderMaterial;
  private emitAcc = [0, 0, 0, 0];

  constructor() {
    // --- Skid marks: indexed quads, RGBA vertex colours (alpha fades with intensity).
    const idx = new Uint32Array(MAX_MARKS * 6);
    for (let i = 0; i < MAX_MARKS; i++) {
      const v = i * 4;
      idx.set([v, v + 2, v + 1, v + 1, v + 2, v + 3], i * 6);
    }
    this.markGeo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.markGeo.setAttribute('position', new THREE.BufferAttribute(this.markPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.markGeo.setAttribute('color', new THREE.BufferAttribute(this.markCol, 4).setUsage(THREE.DynamicDrawUsage));
    this.markGeo.setDrawRange(0, 0);
    const marks = new THREE.Mesh(
      this.markGeo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      }),
    );
    marks.frustumCulled = false;
    marks.renderOrder = 2;
    this.group.add(marks);

    // --- Smoke: soft point sprites.
    this.smokeGeo.setAttribute('position', new THREE.BufferAttribute(this.smokePos, 3).setUsage(THREE.DynamicDrawUsage));
    this.smokeGeo.setAttribute('aSize', new THREE.BufferAttribute(this.smokeSize, 1).setUsage(THREE.DynamicDrawUsage));
    this.smokeGeo.setAttribute('aAlpha', new THREE.BufferAttribute(this.smokeAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.smokeMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: radialTexture(64) }, uScale: { value: 500 }, uColor: { value: new THREE.Color(0xd8d8d6) } },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aAlpha;
        uniform float uScale;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / max(0.1, -mv.z);
          vAlpha = aAlpha;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          float a = texture2D(uMap, gl_PointCoord).r * vAlpha;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor, a);
        }`,
      transparent: true,
      depthWrite: false,
    });
    const smoke = new THREE.Points(this.smokeGeo, this.smokeMat);
    smoke.frustumCulled = false;
    smoke.renderOrder = 3;
    this.group.add(smoke);
  }

  /** Pixels per metre at 1 m distance, for point-sprite sizing. */
  setViewport(heightPx: number, fovDeg: number): void {
    this.smokeMat.uniforms.uScale.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
  }

  clear(): void {
    this.markCount = this.markHead = 0;
    this.markGeo.setDrawRange(0, 0);
    this.particles.length = 0;
    this.last.fill(null);
  }

  update(dt: number, vehicle: Vehicle): void {
    const sy = Math.sin(vehicle.yaw);
    const cy = Math.cos(vehicle.yaw);
    let marksDirty = false;

    vehicle.wheels.forEach((w, i) => {
      // World contact point (at the wheel position, steering ignored for the mark).
      const [x, z] = vehicle.bodyToWorld(w.x, w.y);
      const intensity = w.fz > 400 ? Math.min(1, Math.max(0, (w.slipSpeed - 2.5) / 7)) : 0;
      if (intensity > 0.04) {
        const prev = this.last[i];
        // Mark direction follows the travel of the contact patch.
        if (prev) {
          const dx = x - prev.x;
          const dz = z - prev.z;
          const len = Math.hypot(dx, dz);
          if (len > 0.3) {
            const nx = (-dz / len) * (MARK_WIDTH / 2);
            const nz = (dx / len) * (MARK_WIDTH / 2);
            this.addMark(prev.lx, prev.lz, prev.rx, prev.rz, x + nx, z + nz, x - nx, z - nz, intensity);
            this.last[i] = { x, z, lx: x + nx, lz: z + nz, rx: x - nx, rz: z - nz };
            marksDirty = true;
          }
        } else {
          // Start a new trail: edges perpendicular to the car heading.
          const hx = cy * MARK_WIDTH * 0.5;
          const hz = -sy * MARK_WIDTH * 0.5;
          this.last[i] = { x, z, lx: x + hx, lz: z + hz, rx: x - hx, rz: z - hz };
        }
        // Smoke only from a real slide (burnout, drift, locked wheels), proportional to it.
        const smoke = Math.max(0, (w.slipSpeed - 5) / 12);
        this.emitAcc[i] += dt * Math.min(1, smoke) * 16;
        while (this.emitAcc[i] > 1) {
          this.emitAcc[i] -= 1;
          this.spawnSmoke(x, z, vehicle, Math.min(1, smoke));
        }
      } else {
        this.last[i] = null;
      }
    });

    if (marksDirty) {
      (this.markGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.markGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      this.markGeo.setDrawRange(0, this.markCount * 6);
    }
    this.updateSmoke(dt);
  }

  private addMark(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    cx: number,
    cz: number,
    dx: number,
    dz: number,
    intensity: number,
  ): void {
    const y = 0.008;
    const i = this.markHead;
    // Quad: previous left/right edge → current left/right edge.
    this.markPos.set([ax, y, az, bx, y, bz, cx, y, cz, dx, y, dz], i * 12);
    const a = 0.55 * intensity;
    for (let k = 0; k < 4; k++) this.markCol.set([0.02, 0.02, 0.02, a], i * 16 + k * 4);
    this.markHead = (this.markHead + 1) % MAX_MARKS;
    this.markCount = Math.min(MAX_MARKS, this.markCount + 1);
  }

  private spawnSmoke(x: number, z: number, vehicle: Vehicle, strength: number): void {
    if (this.particles.length >= MAX_SMOKE) this.particles.shift();
    const [vx, vz] = vehicle.worldVelocity();
    this.particles.push({
      x: x + (Math.random() - 0.5) * 0.3,
      y: 0.25,
      z: z + (Math.random() - 0.5) * 0.3,
      vx: vx * 0.25 + (Math.random() - 0.5) * 1.5,
      vy: 0.4 + Math.random() * 0.6,
      vz: vz * 0.25 + (Math.random() - 0.5) * 1.5,
      age: 0,
      life: 2 + Math.random() * 1.5,
      size: 0.8,
      strength,
    });
  }

  private updateSmoke(dt: number): void {
    const ps = this.particles;
    let n = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      const drag = Math.exp(-1.6 * dt);
      p.vx *= drag;
      p.vz *= drag;
      p.vy = p.vy * drag + 0.25 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = p.age / p.life;
      ps[n++] = p;
      const j = n - 1;
      this.smokePos[j * 3] = p.x;
      this.smokePos[j * 3 + 1] = p.y;
      this.smokePos[j * 3 + 2] = p.z;
      this.smokeSize[j] = p.size + t * 4;
      this.smokeAlpha[j] = p.strength * 0.16 * Math.min(1, p.age * 4) * (1 - t) * (1 - t);
    }
    ps.length = n;
    this.smokeGeo.setDrawRange(0, n);
    (this.smokeGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.smokeGeo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (this.smokeGeo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  }
}
