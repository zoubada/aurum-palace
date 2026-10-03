import * as THREE from 'three';
import type { CarVisual } from '../cars/CarVisual';

/**
 * Low-beam headlights for the player's car: two spotlights with a projected beam pattern
 * (sharp cut-off above the horizon, hot spot ~10–30 m ahead, dim close to the bumper), plus
 * brighter lamp glass at night. Other cars get cheap light pools on the road instead
 * (`BeamDecal`), since every real light costs shader time on every lit surface.
 */

let beamTex: THREE.Texture | null = null;

/** Beam pattern, in the spotlight's projection (top = up). */
function beamTexture(): THREE.Texture {
  if (beamTex) return beamTex;
  const N = 128;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const img = g.createImageData(N, N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * 2 - 1;
      const y = 1 - (j / (N - 1)) * 2; // canvas top = +1 (up)
      const side = Math.exp(-((x / 0.75) ** 2));
      // Cut-off just above the axis (slightly higher on the kerb side), hot spot below it.
      const cut = 0.03 + (x < 0 ? 0 : 0.04 * Math.min(1, x * 3));
      let v: number;
      if (y > cut) v = 0.04 * Math.exp(-(((y - cut) / 0.3) ** 2));
      else v = Math.exp(-(((y + 0.07) / 0.1) ** 2)) * 0.85 + 0.15 * Math.exp(-(((y + 0.1) / 0.25) ** 2));
      const r = Math.hypot(x, y);
      const edge = 1 - THREE.MathUtils.smoothstep(r, 0.85, 1);
      const k = Math.round(Math.min(1, v * side * edge) * 255);
      const o = (j * N + i) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = k;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  beamTex = new THREE.CanvasTexture(c);
  beamTex.colorSpace = THREE.NoColorSpace;
  return beamTex;
}

export class Headlights {
  private readonly lights: THREE.SpotLight[] = [];

  constructor(
    private readonly visual: CarVisual,
    private readonly intensity = 3500,
  ) {
    const cfg = visual.config;
    const cg = cfg.physics.cgHeight;
    const half = cfg.visual.width / 2 - 0.36;
    const front = cfg.visual.frontOverhangFromCg - 0.25;
    for (const side of [1, -1]) {
      const l = new THREE.SpotLight(0xf3f5ff, intensity, 140, 0.42, 0.25, 2);
      l.map = beamTexture();
      l.position.set(side * half, 0.68 - cg, front);
      l.target.position.set(side * half * 0.6, 0.68 - cg, front + 30);
      l.castShadow = false;
      visual.body.add(l, l.target);
      this.lights.push(l);
    }
    this.setOn(true);
  }

  setOn(on: boolean): void {
    // Intensity, not `visible`: changing the light count would recompile every shader.
    for (const l of this.lights) l.intensity = on ? this.intensity : 0;
    this.visual.setNight(on);
  }

  dispose(): void {
    for (const l of this.lights) {
      l.removeFromParent();
      l.target.removeFromParent();
      l.dispose();
    }
  }
}

/** Fake headlight pool on the road for AI cars: an additive textured quad ahead of the car. */
export class BeamDecal {
  readonly mesh: THREE.Mesh;
  private static material: THREE.MeshBasicMaterial | null = null;

  constructor(visual: CarVisual) {
    if (!BeamDecal.material) {
      const N = 64;
      const c = document.createElement('canvas');
      c.width = c.height = N;
      const g = c.getContext('2d')!;
      const img = g.createImageData(N, N);
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
          const x = (i / (N - 1)) * 2 - 1;
          const y = j / (N - 1); // 0 = far end, 1 = at the bumper
          const spread = 0.25 + 0.75 * (1 - y);
          const along = Math.sin(Math.PI * Math.min(1, (1 - y) * 1.25)) ** 0.7 * (1 - y * 0.4);
          const k = Math.max(0, along * Math.exp(-((x / spread) ** 2) * 2));
          const o = (j * N + i) * 4;
          img.data[o] = img.data[o + 1] = img.data[o + 2] = Math.round(k * 255);
          img.data[o + 3] = 255;
        }
      g.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.NoColorSpace;
      BeamDecal.material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.55, 0.57, 0.62),
        alphaMap: t,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -8,
      });
    }
    const cfg = visual.config;
    const len = 26;
    const geo = new THREE.PlaneGeometry(cfg.visual.width + 4, len).rotateX(-Math.PI / 2);
    geo.translate(0, 0.06, cfg.visual.frontOverhangFromCg + len / 2 - 0.5);
    this.mesh = new THREE.Mesh(geo, BeamDecal.material);
    this.mesh.renderOrder = 2;
    visual.root.add(this.mesh);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
  }
}
