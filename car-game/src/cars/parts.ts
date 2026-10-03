import type * as THREE from 'three';

/**
 * The animated parts of a car model, whichever way it was built (procedural placeholder or
 * a real glTF model mapped by node names, see src/cars/gltf.ts). CarVisual only talks to this.
 *
 * Space: "shell" coordinates — x left, y up, z forward, origin on the ground under the CG.
 */
export interface WheelNode {
  /** Steering pivot at the hub (rotates about y). */
  pivot: THREE.Object3D;
  /** Spinning part (rotates about x). */
  spin: THREE.Object3D;
  /** Brake disc material, glows when hot (own instance per wheel). */
  disc: THREE.MeshStandardMaterial | null;
}

export interface CarParts {
  /** Everything carried by the suspension (body, cabin, lights…). */
  body: THREE.Object3D;
  /** FL, FR, RL, RR, positioned in shell space. */
  wheels: WheelNode[];
  steeringWheel: THREE.Object3D | null;
  paint: THREE.MeshPhysicalMaterial[];
  rims: THREE.MeshStandardMaterial[];
  calipers: THREE.MeshStandardMaterial[];
  brakeLights: THREE.MeshStandardMaterial[];
  reverseLights: THREE.MeshStandardMaterial[];
  headLights: THREE.MeshStandardMaterial[];
  /** Active wing element: rotation about x from rest to deployed angle (rad). */
  wing: { pivot: THREE.Object3D; rest: number; deployed: number } | null;
  /** Openable doors (garage). */
  doors: Array<{ pivot: THREE.Object3D; axis: THREE.Vector3; angle: number }>;
  /** Exhaust outlets (shell space), for flames. */
  exhaustTips: THREE.Vector3[];
  /** Mirror glass meshes that receive a real-time render (UV x is flipped by the renderer). */
  mirrors: Array<{ mesh: THREE.Mesh; kind: 'interior' | 'left' | 'right' }>;
  /** Instrument cluster drawn on a canvas (null if the model has its own working gauges). */
  dash: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } | null;
  /** Driver eye position (shell space). */
  eye: [number, number, number];
  /** Parts hidden in the cockpit view (headrest right behind the camera…). */
  hiddenInCockpit: THREE.Object3D[];
}
