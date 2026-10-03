import * as THREE from 'three';
import type { QualitySettings } from '../core/quality';

/**
 * Night sky for the city circuit: deep blue zenith, orange light-pollution glow on the horizon,
 * stars, the moon (its light casts the soft shadows) and urban haze. The image-based lighting is
 * captured from the city itself once it is built (`captureCity`), so cars and wet roads reflect
 * the lit windows, neon signs and street lights.
 */
export class NightEnvironment {
  readonly moon: THREE.DirectionalLight;
  private readonly sky: THREE.Mesh;
  private readonly hemi: THREE.HemisphereLight;
  private readonly moonDir = new THREE.Vector3();
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private readonly fog: THREE.FogExp2;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly renderer: THREE.WebGLRenderer,
    quality: QualitySettings,
  ) {
    this.moonDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 38), THREE.MathUtils.degToRad(210));
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { moonDir: { value: this.moonDir }, rain: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 moonDir;
        uniform float rain;
        varying vec3 vDir;
        float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        void main() {
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          // Linear HDR radiance: dark navy zenith, sodium-orange city glow near the horizon.
          vec3 zenith = vec3(0.004, 0.007, 0.02);
          vec3 glow = vec3(0.10, 0.05, 0.035) * (1.0 + rain);
          vec3 col = mix(glow, zenith, pow(h, 0.35));
          col += vec3(0.03, 0.025, 0.04) * exp(-h * 18.0);
          // Stars (hidden by rain clouds).
          vec3 cell = floor(d * 380.0);
          float s = hash(cell);
          col += vec3(0.6, 0.65, 0.8) * step(0.9975, s) * smoothstep(0.05, 0.4, h) * (1.0 - rain);
          // Moon disc and halo.
          float m = dot(d, moonDir);
          col += vec3(1.0, 0.97, 0.9) * smoothstep(0.99955, 0.99975, m) * 6.0 * (1.0 - rain * 0.8);
          col += vec3(0.05, 0.06, 0.09) * pow(max(m, 0.0), 60.0) * (1.0 - rain * 0.5);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), mat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1;
    scene.add(this.sky);

    this.moon = new THREE.DirectionalLight(0x9fb4e6, 0.35);
    this.moon.castShadow = true;
    const cam = this.moon.shadow.camera;
    cam.left = -45;
    cam.right = 45;
    cam.top = 45;
    cam.bottom = -45;
    cam.near = 1;
    cam.far = 500;
    this.moon.shadow.bias = -0.0004;
    this.moon.shadow.normalBias = 0.03;
    scene.add(this.moon, this.moon.target);

    this.hemi = new THREE.HemisphereLight(0x2a3550, 0x1a1410, 0.12);
    scene.add(this.hemi);

    this.fog = new THREE.FogExp2(0x161420, 0.0017);
    scene.fog = this.fog;
    scene.background = null;
    this.applyQuality(quality);
  }

  private moonIntensity = 0.35;

  setRain(rain: boolean): void {
    (this.sky.material as THREE.ShaderMaterial).uniforms.rain.value = rain ? 1 : 0;
    this.fog.density = rain ? 0.0032 : 0.0017;
    this.fog.color.setHex(rain ? 0x1c1c26 : 0x161420);
    this.moonIntensity = rain ? 0.08 : 0.35;
    this.moon.intensity = this.moonIntensity;
  }

  /**
   * 0 = open air, 1 = inside the tunnel: sky light (IBL, hemisphere, moon) fades out so the
   * tunnel is lit by its own fixtures only.
   */
  setEnclosure(e: number): void {
    this.scene.environmentIntensity = 1 - 0.75 * e;
    this.hemi.intensity = 0.12 * (1 - 0.8 * e);
    this.moon.intensity = this.moonIntensity * (1 - e);
  }

  /** Bake the lit city into the environment map (call once the city is built). */
  captureCity(at: THREE.Vector3): void {
    const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    const cube = new THREE.CubeCamera(1, 3000, rt);
    cube.position.copy(at);
    this.scene.add(cube);
    cube.update(this.renderer, this.scene);
    this.scene.remove(cube);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTarget?.dispose();
    this.envTarget = pmrem.fromCubemap(rt.texture);
    pmrem.dispose();
    rt.dispose();
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 1;
  }

  applyQuality(q: QualitySettings): void {
    this.moon.castShadow = q.shadows;
    if (this.moon.shadow.mapSize.x !== q.shadowMapSize) {
      this.moon.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
      this.moon.shadow.map?.dispose();
      this.moon.shadow.map = null;
    }
  }

  follow(target: THREE.Vector3): void {
    const texel = 90 / this.moon.shadow.mapSize.x;
    const x = Math.round(target.x / texel) * texel;
    const z = Math.round(target.z / texel) * texel;
    this.moon.target.position.set(x, target.y, z);
    this.moon.position.set(x + this.moonDir.x * 200, target.y + this.moonDir.y * 200, z + this.moonDir.z * 200);
    this.sky.position.set(target.x, 0, target.z);
  }

  dispose(): void {
    this.envTarget?.dispose();
    this.sky.geometry.dispose();
    (this.sky.material as THREE.Material).dispose();
  }
}
