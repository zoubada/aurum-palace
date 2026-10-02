import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { QualitySettings } from '../core/quality';

/**
 * WebGL2 renderer with an HDR post-processing chain (MSAA → bloom → ACES tone mapping).
 *
 * WebGPU (SPEC §1) is not wired yet: Three's WebGPURenderer needs the post chain
 * rewritten with TSL nodes. Planned for the optimisation phase; WebGL2 is the
 * fallback the spec asks for anyway.
 */
export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    quality: QualitySettings,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !quality.postProcessing,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.applyQuality(quality);
  }

  get maxAnisotropy(): number {
    return this.renderer.capabilities.getMaxAnisotropy();
  }

  applyQuality(q: QualitySettings): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.maxPixelRatio));
    this.renderer.shadowMap.enabled = q.shadows;
    this.composer?.dispose();
    this.composer = null;
    if (q.postProcessing) {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      const target = new THREE.WebGLRenderTarget(size.x, size.y, {
        type: THREE.HalfFloatType,
        samples: q.msaa,
      });
      const composer = new EffectComposer(this.renderer, target);
      composer.addPass(new RenderPass(this.scene, this.camera));
      if (q.bloom) {
        // Threshold in linear HDR, well above the (scaled) sky so only lights, the sun and glints bloom.
        const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.2, 0.35, 3);
        // Firefly clamp: the sun disc and its halo reach thousands in HDR and would otherwise
        // flood the whole screen through the blur chain.
        bloom.materialHighPassFilter.fragmentShader = bloom.materialHighPassFilter.fragmentShader.replace(
          'vec4 texel = texture2D( tDiffuse, vUv );',
          'vec4 texel = texture2D( tDiffuse, vUv ); texel.rgb = min( texel.rgb, vec3( 8.0 ) );',
        );
        bloom.materialHighPassFilter.needsUpdate = true;
        composer.addPass(bloom);
      }
      composer.addPass(new OutputPass());
      this.composer = composer;
    }
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
