import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import type { QualitySettings } from '../../core/quality';

/**
 * Lake Annecy, from its OpenStreetMap outline. High / Ultra: real planar reflections of the
 * mountains and shores (mirror render), small ripples, sun glitter. Low / Medium: glossy
 * transparent water reflecting the sky, the shallow lake bed visible near the shore.
 */

function rippleNormals(): THREE.Texture {
  const N = 256;
  const data = new Uint8Array(N * N * 4);
  const waves: Array<[number, number, number, number]> = [];
  for (let k = 0; k < 14; k++) {
    const a = k * 2.399;
    const f = 2 + ((k * 5) % 11);
    waves.push([Math.cos(a) * f, Math.sin(a) * f, 1 / f, k * 1.7]);
  }
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let dx = 0;
      let dy = 0;
      for (const [kx, ky, amp, ph] of waves) {
        const p = ((kx * x + ky * y) / N) * Math.PI * 2 + ph;
        const c = Math.cos(p) * amp;
        dx += c * kx;
        dy += c * ky;
      }
      const l = Math.hypot(dx * 0.05, dy * 0.05, 1);
      const k = (y * N + x) * 4;
      data[k] = ((dx * 0.05) / l) * 127 + 128;
      data[k + 1] = ((dy * 0.05) / l) * 127 + 128;
      data[k + 2] = (1 / l) * 127 + 128;
      data[k + 3] = 255;
    }
  const t = new THREE.DataTexture(data, N, N);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export class Lake {
  readonly mesh: THREE.Mesh;
  private readonly water: Water | null;

  constructor(outer: Array<Array<[number, number]>>, inner: Array<Array<[number, number]>>, quality: QualitySettings, sunDir: THREE.Vector3, sunColor: THREE.Color, rain: boolean) {
    // Shape in (x, −z) so that rotating −90° about x lays it on the ground.
    const shapes = outer.map((ring) => {
      const sh = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z)));
      for (const hole of inner) sh.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
      return sh;
    });
    const geo = new THREE.ShapeGeometry(shapes, 1);
    const normals = rippleNormals();
    const reflections = quality.id === 'high' || quality.id === 'ultra';
    if (reflections) {
      const size = quality.id === 'ultra' ? 1024 : 512;
      this.water = new Water(geo, {
        textureWidth: size,
        textureHeight: size,
        waterNormals: normals,
        sunDirection: sunDir.clone(),
        sunColor: sunColor.clone(),
        waterColor: rain ? 0x0a2a30 : 0x0b3f47,
        distortionScale: rain ? 3.5 : 1.6,
        fog: true,
        alpha: 1,
      });
      this.water.material.uniforms.size.value = 3.2;
      this.mesh = this.water;
    } else {
      this.water = null;
      this.mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: rain ? 0x0d2a30 : 0x0f4a52,
          roughness: rain ? 0.25 : 0.06,
          metalness: 0,
          normalMap: normals,
          normalScale: new THREE.Vector2(0.15, 0.15),
          transparent: true,
          opacity: 0.86,
          envMapIntensity: 1.2,
        }),
      );
      const m = this.mesh.material as THREE.MeshStandardMaterial;
      m.normalMap!.repeat.set(1 / 40, 1 / 40);
    }
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0;
    this.mesh.receiveShadow = !reflections;
    this.mesh.renderOrder = 1;
  }

  update(time: number): void {
    if (this.water) this.water.material.uniforms.time.value = time * 0.6;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    const m = this.mesh.material as THREE.Material;
    m.dispose();
    (this.water as unknown as { getRenderTarget?: () => THREE.WebGLRenderTarget } | null)?.getRenderTarget?.()?.dispose();
  }
}
