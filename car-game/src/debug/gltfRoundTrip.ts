import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getCar } from '../cars/registry';
import { buildPlaceholder } from '../cars/procedural/buildPlaceholder';
import { mapCarModel } from '../cars/gltf';

/**
 * Pipeline self-test (loaded on demand by the smoke test): export a placeholder car to GLB
 * with the documented node names, load it back through GLTFLoader and the CarParts mapper,
 * and report what was found. Proves a model following assets/cars/README.md plugs in.
 */
export async function gltfRoundTrip(carId: string): Promise<Record<string, unknown>> {
  const car = getCar(carId);
  const L = car.physics.wheelbase;
  const b = car.physics.frontWeightFraction * L;
  const a = L - b;
  const parts = buildPlaceholder(car, a, b);
  const model = new THREE.Group();
  model.add(parts.body);
  for (const w of parts.wheels) model.add(w.pivot);
  // Shift the export so the mapper has to re-align it (as with a real model).
  model.position.set(0.3, 0.1, -0.7);
  const glb = (await new GLTFExporter().parseAsync(model, { binary: true })) as ArrayBuffer;
  const gltf = await new GLTFLoader().parseAsync(glb, '');
  const mapped = mapCarModel(gltf.scene, car, a);
  const hub = mapped.wheels[0].pivot.position;
  return {
    bytes: glb.byteLength,
    wheels: mapped.wheels.length,
    frontLeftHub: [hub.x, hub.y, hub.z].map((v) => +v.toFixed(3)),
    expectedFrontLeftHub: [+(car.physics.trackFront / 2).toFixed(3), +car.physics.tires.front.radius.toFixed(3), +a.toFixed(3)],
    discs: mapped.wheels.filter((w) => w.disc).length,
    steeringWheel: !!mapped.steeringWheel,
    paint: mapped.paint.length,
    brakeLights: mapped.brakeLights.length,
    reverseLights: mapped.reverseLights.length,
    headLights: mapped.headLights.length,
    rims: mapped.rims.length,
    doors: mapped.doors.length,
    wing: !!mapped.wing,
    mirrors: mapped.mirrors.map((m) => m.kind),
    exhaustTips: mapped.exhaustTips.length,
    dash: !!mapped.dash,
    eye: mapped.eye.map((v) => +v.toFixed(3)),
  };
}
