import * as THREE from 'three';
import type { CarVisual } from '../cars/CarVisual';

/**
 * Real-time rear-view mirrors (SPEC §4): each mirror glass gets a small render target filled
 * from a camera placed on the mirror and looking backwards. Only one mirror is refreshed per
 * frame (round robin) and only in the views where mirrors are visible, to keep the cost low.
 */
export class Mirrors {
  private readonly entries: Array<{ mesh: THREE.Mesh; rt: THREE.WebGLRenderTarget; cam: THREE.PerspectiveCamera; yaw: number }> = [];
  private next = 0;
  private readonly tmp = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly turn = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(visual: CarVisual) {
    this.attach(visual);
  }

  /** (Re)bind to the visual's mirror meshes (called again when a glTF model replaces the placeholder). */
  attach(visual: CarVisual): void {
    this.dispose();
    for (const m of visual.parts.mirrors) {
      const interior = m.kind === 'interior';
      const rt = new THREE.WebGLRenderTarget(interior ? 384 : 224, interior ? 96 : 112, { type: THREE.HalfFloatType });
      rt.texture.wrapS = THREE.RepeatWrapping;
      rt.texture.repeat.x = -1; // a mirror shows the scene flipped left/right
      rt.texture.offset.x = 1;
      const cam = new THREE.PerspectiveCamera(interior ? 22 : 26, interior ? 4 : 2, 0.2, 350);
      m.mesh.material = new THREE.MeshBasicMaterial({ map: rt.texture });
      // Exterior mirrors are aimed slightly outwards (left mirror looks back-left).
      const yaw = m.kind === 'left' ? -0.22 : m.kind === 'right' ? 0.22 : 0;
      this.entries.push({ mesh: m.mesh, rt, cam, yaw });
    }
  }

  /** Render one mirror view. `visible` = mirrors can be seen from the current camera. */
  update(renderer: THREE.WebGLRenderer, scene: THREE.Scene, visual: CarVisual, visible: boolean): void {
    if (!visible || this.entries.length === 0) return;
    const e = this.entries[this.next % this.entries.length];
    this.next++;
    e.mesh.getWorldPosition(this.tmp);
    visual.body.getWorldQuaternion(this.q);
    // A camera looks along its own −z: with the car's orientation it looks backwards.
    e.cam.position.copy(this.tmp);
    e.cam.quaternion.copy(this.q).multiply(this.turn.setFromAxisAngle(this.up, e.yaw));
    e.cam.updateMatrixWorld();
    const prevTarget = renderer.getRenderTarget();
    const shadow = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false; // reuse the main pass's shadow maps
    e.mesh.visible = false;
    renderer.setRenderTarget(e.rt);
    renderer.render(scene, e.cam);
    renderer.setRenderTarget(prevTarget);
    e.mesh.visible = true;
    renderer.shadowMap.autoUpdate = shadow;
  }

  dispose(): void {
    for (const e of this.entries) {
      e.rt.dispose();
      (e.mesh.material as THREE.Material).dispose();
    }
    this.entries.length = 0;
  }
}
