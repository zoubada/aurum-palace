import * as THREE from 'three';

/**
 * Falling rain around the camera: thin streaks animated entirely on the GPU (each drop wraps
 * inside a box that follows the camera), stretched along the fall direction and dimmed with
 * distance. Covered areas (tunnel) are handled by fading the whole effect out.
 */

const BOX = new THREE.Vector3(60, 26, 60);

export class Rain {
  readonly mesh: THREE.LineSegments;
  private readonly mat: THREE.ShaderMaterial;
  private readonly geo = new THREE.BufferGeometry();

  constructor(count: number) {
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uBox: { value: BOX },
        uWind: { value: new THREE.Vector2(1.2, 0.6) },
        uStrength: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aDrop; // xyz = random offset in the box, w = 0 head / 1 tail
        uniform float uTime;
        uniform vec3 uCenter;
        uniform vec3 uBox;
        uniform vec2 uWind;
        varying float vFade;
        void main() {
          float speed = 9.0 + aDrop.x * 0.05;
          vec3 p = aDrop.xyz * uBox;
          p.y -= uTime * speed;
          p.xz += uWind * uTime;
          // Wrap into the box centred on the camera.
          vec3 base = uCenter - uBox * 0.5;
          p = base + mod(p - base, uBox);
          // Streak: the tail is one motion-blur length above the head.
          p.y += position.y * 0.55;
          p.xz -= uWind * position.y * 0.06;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = length(mv.xyz);
          vFade = (1.0 - smoothstep(6.0, 30.0, d)) * smoothstep(0.6, 2.0, d);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uStrength;
        varying float vFade;
        void main() {
          gl_FragColor = vec4(vec3(0.16, 0.17, 0.2) * vFade * uStrength, 1.0);
        }`,
    });
    const pos = new Float32Array(count * 2 * 3);
    const drop = new Float32Array(count * 2 * 4);
    for (let i = 0; i < count; i++) {
      const x = Math.random();
      const y = Math.random();
      const z = Math.random();
      for (let k = 0; k < 2; k++) {
        pos[(i * 2 + k) * 3 + 1] = k; // 0 = head, 1 = tail
        drop.set([x, y, z, k], (i * 2 + k) * 4);
      }
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('aDrop', new THREE.BufferAttribute(drop, 4));
    this.mesh = new THREE.LineSegments(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
  }

  /** `cover` 0–1: 1 under a roof (tunnel), where no rain falls. */
  update(time: number, camera: THREE.Camera, cover: number): void {
    const u = this.mat.uniforms;
    u.uTime.value = time;
    u.uCenter.value.copy(camera.position);
    u.uStrength.value = 1 - cover;
    this.mesh.visible = cover < 0.98;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
