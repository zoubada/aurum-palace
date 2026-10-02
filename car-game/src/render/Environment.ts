import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import type { QualitySettings } from '../core/quality';

/**
 * Physical sky + sun + image-based lighting.
 *
 * The same sky feeds a PMREM environment map so cars and asphalt get coherent
 * reflections. The sun's shadow frustum follows the player (tight, sharp shadows
 * near the car). Day/night cycle and weather are Phase 7 (SPEC §2); the sun
 * position is already parameterised by elevation/azimuth for that.
 */
/**
 * Three's Sky outputs radiance ~2–4 (blue sky) and ~30 near the sun, i.e. ~5× too bright
 * relative to a sunlit white surface lit by our 3.2-intensity sun (real ratio: blue sky
 * ≈ 0.1–0.2 × sunlit white). Scaling it keeps sky, IBL, exposure and bloom consistent.
 */
const SKY_RADIANCE_SCALE = 0.22;

function createSky(scale: number): Sky {
  const sky = new Sky();
  const m = sky.material;
  m.uniforms.skyScale = { value: SKY_RADIANCE_SCALE };
  m.fragmentShader = m.fragmentShader
    .replace('uniform float showSunDisc;', 'uniform float showSunDisc;\nuniform float skyScale;')
    .replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( texColor * skyScale, 1.0 );');
  sky.scale.setScalar(scale);
  const u = m.uniforms;
  u.turbidity.value = 4.5;
  u.rayleigh.value = 1.4;
  u.mieCoefficient.value = 0.0025;
  u.mieDirectionalG.value = 0.78;
  return sky;
}

export class Environment {
  readonly sun: THREE.DirectionalLight;
  readonly sky: Sky;
  private readonly sunDir = new THREE.Vector3();
  private envTarget: THREE.WebGLRenderTarget | null = null;

  constructor(
    private scene: THREE.Scene,
    private renderer: THREE.WebGLRenderer,
    quality: QualitySettings,
  ) {
    this.sky = createSky(20000);
    scene.add(this.sky);

    this.sun = new THREE.DirectionalLight(0xfff1dd, 3.2);
    this.sun.castShadow = true;
    const cam = this.sun.shadow.camera;
    cam.left = -45;
    cam.right = 45;
    cam.top = 45;
    cam.bottom = -45;
    cam.near = 1;
    cam.far = 400;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun, this.sun.target);

    scene.fog = new THREE.FogExp2(0xc9d6e2, 0.0011);

    // Afternoon sun behind-left of the start grid (the straight runs east).
    this.setSun(36, 230);
    this.applyQuality(quality);
  }

  /** Sun elevation / azimuth in degrees. Rebuilds the environment map. */
  setSun(elevationDeg: number, azimuthDeg: number): void {
    const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
    const theta = THREE.MathUtils.degToRad(azimuthDeg);
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir);

    // Image-based lighting from the sky only (not the scene) so it stays cheap to rebuild.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    const skyCopy = createSky(1000);
    skyCopy.material.uniforms.sunPosition.value.copy(this.sunDir);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG'] as const) skyCopy.material.uniforms[k].value = this.sky.material.uniforms[k].value;
    // The sun disc is ~60 000 in HDR: baked into the IBL it would add a second sun on top of
    // the directional light. The directional light alone carries the direct sunlight.
    skyCopy.material.uniforms.showSunDisc.value = 0;
    envScene.add(skyCopy);
    // Ground hemisphere (sunlit asphalt/grass radiance) for bounce light and lower-body reflections.
    const ground = new THREE.Mesh(
      new THREE.SphereGeometry(500, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.14, 0.135, 0.12), side: THREE.BackSide }),
    );
    envScene.add(ground);
    this.envTarget?.dispose();
    this.envTarget = pmrem.fromScene(envScene, 0.02);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 1;
    pmrem.dispose();
    skyCopy.geometry.dispose();
    skyCopy.material.dispose();
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();
  }

  /** Long-distance haze (big outdoor circuits) instead of the test area's short fog. */
  setFog(color: number, density: number): void {
    this.scene.fog = new THREE.FogExp2(color, density);
  }

  /** Grey overcast sky (rain): flat light, no sun disc, denser haze. Rebuilds the IBL. */
  setOvercast(on: boolean): void {
    const u = this.sky.material.uniforms;
    u.turbidity.value = on ? 18 : 4.5;
    u.rayleigh.value = on ? 0.25 : 1.4;
    u.mieCoefficient.value = on ? 0.03 : 0.0025;
    u.mieDirectionalG.value = on ? 0.3 : 0.78;
  }

  /** Keep the sky box centred on the camera (circuits several km wide). */
  centreSky(camera: THREE.Vector3): void {
    this.sky.position.copy(camera);
  }

  applyQuality(q: QualitySettings): void {
    this.sun.castShadow = q.shadows;
    if (this.sun.shadow.mapSize.x !== q.shadowMapSize) {
      this.sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  /** Keep the shadow frustum centred on the player. Snapped to texels to avoid shimmering. */
  follow(target: THREE.Vector3): void {
    const texel = 90 / this.sun.shadow.mapSize.x;
    const x = Math.round(target.x / texel) * texel;
    const z = Math.round(target.z / texel) * texel;
    this.sun.target.position.set(x, target.y, z);
    this.sun.position.set(x + this.sunDir.x * 150, target.y + this.sunDir.y * 150, z + this.sunDir.z * 150);
  }
}
