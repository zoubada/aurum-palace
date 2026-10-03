import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { CarConfig } from './types';
import type { CarParts, WheelNode } from './parts';
import { DASH_HEIGHT, DASH_WIDTH } from './dashboards';
import { buildCabinKit } from './procedural/buildPlaceholder';

/**
 * Real car models (SPEC §4): glTF/GLB, optionally Draco / meshopt compressed with KTX2 textures.
 * The model is mapped onto CarParts by node and material names (see assets/cars/README.md),
 * scaled to the real wheelbase and aligned on the axles of the physics model.
 */

let loader: GLTFLoader | null = null;

function getLoader(renderer: THREE.WebGLRenderer): GLTFLoader {
  if (!loader) {
    const draco = new DRACOLoader().setDecoderPath('decoders/draco/');
    const ktx2 = new KTX2Loader().setTranscoderPath('decoders/basis/').detectSupport(renderer);
    loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
    loader.register((parser) => {
      decodeEmbeddedImages(parser);
      return { name: 'apex_embedded_images' };
    });
  }
  return loader;
}

type Parser = Parameters<Parameters<GLTFLoader['register']>[0]>[0];

/**
 * Embedded GLB images decoded straight from their bytes with createImageBitmap. The stock path
 * goes through a `blob:` object URL loaded by an <img> (Safari < 17), which the sandboxed page
 * host can refuse: the model then shows up untextured (white cabin, opaque grey windows).
 */
function decodeEmbeddedImages(parser: Parser): void {
  if (typeof createImageBitmap === 'undefined') return;
  const p = parser as unknown as {
    json: { images?: Array<{ bufferView?: number; mimeType?: string; name?: string }> };
    sourceCache: Record<number, Promise<THREE.Texture>>;
    loadImageSource: (index: number, loader: unknown) => Promise<THREE.Texture>;
    getDependency: (type: string, index: number) => Promise<ArrayBuffer>;
  };
  const original = p.loadImageSource.bind(parser);
  p.loadImageSource = (index, imageLoader) => {
    const def = p.json.images?.[index];
    if (!def || def.bufferView === undefined) return original(index, imageLoader);
    if (p.sourceCache[index] !== undefined) return p.sourceCache[index].then((t) => t.clone());
    const promise = p.getDependency('bufferView', def.bufferView).then(async (bytes) => {
      const blob = new Blob([bytes], { type: def.mimeType });
      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      } catch {
        bitmap = await createImageBitmap(blob);
      }
      const texture = new THREE.Texture(bitmap);
      texture.needsUpdate = true;
      texture.userData.mimeType = def.mimeType;
      return texture;
    });
    p.sourceCache[index] = promise;
    return promise;
  };
}

/** Shared single-file build: binaries come as base64 text (`<file>.txt`), the host serves text only. */
const asText = () => !!(window as unknown as { __BIN_AS_TEXT__?: boolean }).__BIN_AS_TEXT__;

/** True when the model file exists (dev servers answer missing files with index.html). */
export async function modelAvailable(url: string): Promise<boolean> {
  // Single-file builds opened from disk carry no model files: skip the probe.
  if ((window as unknown as { __NO_MODELS__?: boolean }).__NO_MODELS__ || location.protocol === 'file:') return false;
  try {
    const res = await fetch(asText() ? `${url}.txt` : url, { method: asText() ? 'GET' : 'HEAD' });
    const type = res.headers.get('content-type') ?? '';
    const ok = res.ok && !type.includes('text/html');
    if (asText()) void res.body?.cancel();
    return ok;
  } catch {
    return false;
  }
}

export async function loadCarModel(url: string, car: CarConfig, frontAxleZ: number, renderer: THREE.WebGLRenderer): Promise<CarParts> {
  const loader = getLoader(renderer);
  let gltf;
  if (asText()) {
    const bin = atob((await (await fetch(`${url}.txt`)).text()).trim());
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    gltf = await loader.parseAsync(bytes.buffer, url.replace(/[^/]*$/, ''));
  } else gltf = await loader.loadAsync(url);
  return mapCarModel(gltf.scene, car, frontAxleZ);
}

const WHEEL_IDS = ['FL', 'FR', 'RL', 'RR'] as const;

function findNode(root: THREE.Object3D, re: RegExp): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!found && re.test(o.name)) found = o;
  });
  return found;
}

/** Map a loaded scene onto CarParts. Exported for the round-trip test with the placeholder. */
export function mapCarModel(scene: THREE.Object3D, car: CarConfig, a: number): CarParts {
  const shell = new THREE.Group();
  shell.name = 'model-body';
  shell.add(scene);
  shell.updateMatrixWorld(true);

  // --- Align: wheelbase scale, front axle on z = a, wheel hubs at tire radius, centred in x.
  const hubs = WHEEL_IDS.map((id) => findNode(scene, new RegExp(`^wheel[_-]?${id}$`, 'i')));
  if (hubs.some((h) => !h)) throw new Error(`Modèle ${car.id} : nœuds wheel_FL/FR/RL/RR introuvables`);
  const hubPos = hubs.map((h) => h!.getWorldPosition(new THREE.Vector3()));
  const zFront = (hubPos[0].z + hubPos[1].z) / 2;
  const zRear = (hubPos[2].z + hubPos[3].z) / 2;
  const modelWb = zFront - zRear;
  let scale = car.physics.wheelbase / modelWb;
  if (!(scale > 0.7 && scale < 1.4)) {
    console.warn(`Modèle ${car.id} : empattement ${modelWb.toFixed(3)} m incohérent, échelle ignorée`);
    scale = 1;
  }
  scene.scale.multiplyScalar(scale);
  const hubY = ((hubPos[0].y + hubPos[1].y) / 2) * scale;
  const xMid = ((hubPos[0].x + hubPos[1].x + hubPos[2].x + hubPos[3].x) / 4) * scale;
  scene.position.set(-xMid, car.physics.tires.front.radius - hubY, a - zFront * scale);
  shell.updateMatrixWorld(true);

  const parts: CarParts = {
    body: shell,
    wheels: [],
    steeringWheel: findNode(scene, /^steering[_-]?wheel$/i),
    paint: [],
    rims: [],
    calipers: [],
    brakeLights: [],
    reverseLights: [],
    headLights: [],
    wing: null,
    doors: [],
    exhaustTips: [],
    mirrors: [],
    dash: null,
    eye: car.visual.driverEye,
    hiddenInCockpit: [],
  };

  // --- Wheels: each one moves to its own steering pivot + spin group, outside the body.
  WHEEL_IDS.forEach((id, i) => {
    const node = hubs[i]!;
    const pivot = new THREE.Group();
    pivot.name = `pivot_${id}`;
    node.getWorldPosition(pivot.position);
    const spin = new THREE.Group();
    pivot.add(spin);
    pivot.updateMatrixWorld(true);
    spin.attach(node);
    const caliper = findNode(scene, new RegExp(`^caliper[_-]?${id}$`, 'i'));
    if (caliper) pivot.attach(caliper);
    let disc: THREE.MeshStandardMaterial | null = null;
    node.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && /disc|rotor/i.test((m.material as THREE.Material).name)) {
        disc = (m.material as THREE.MeshStandardMaterial).clone();
        disc.emissive = new THREE.Color(0xff2a00);
        disc.emissiveIntensity = 0;
        m.material = disc;
      }
    });
    const w: WheelNode = { pivot, spin, disc };
    parts.wheels.push(w);
  });

  // --- Materials by name (body and the wheels, which now live under their own pivots).
  const seen = new Set<THREE.Material>();
  const roots: THREE.Object3D[] = [shell, ...parts.wheels.map((w) => w.pivot)];
  for (const root of roots) root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = true;
    const list = Array.isArray(m.material) ? m.material : [m.material];
    list.forEach((mat, idx) => {
      const n = mat.name.toLowerCase();
      // Body paint (garage colour); painted calipers keep their own colour.
      const bodyPaint = /paint/.test(n) && !/caliper/.test(n);
      if (bodyPaint && !(mat as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
        // Upgrade the body paint to a clear-coated physical material.
        const std = mat as THREE.MeshStandardMaterial;
        const phys = new THREE.MeshPhysicalMaterial({ name: mat.name, color: std.color, map: std.map, metalness: std.metalness, roughness: std.roughness, clearcoat: 1, clearcoatRoughness: 0.03 });
        if (Array.isArray(m.material)) m.material[idx] = phys;
        else m.material = phys;
        mat = phys;
      }
      if (seen.has(mat)) return;
      seen.add(mat);
      const s = mat as THREE.MeshStandardMaterial;
      // Cabin (`int_…`): the roof and pillars hide most of the sky from the interior.
      if (/^int_/.test(n) && s.isMeshStandardMaterial) s.envMapIntensity = 0.3;
      if (bodyPaint) parts.paint.push(mat as THREE.MeshPhysicalMaterial);
      else if (/brake|tail/.test(n) && /light/.test(n)) parts.brakeLights.push(s);
      else if (/reverse/.test(n)) parts.reverseLights.push(s);
      else if (/head|drl/.test(n)) parts.headLights.push(s);
      else if (/^rim|wheel_rim/.test(n)) parts.rims.push(s);
      else if (/caliper/.test(n)) parts.calipers.push(s);
    });
  });

  // --- Animated parts and markers.
  for (const side of ['L', 'R'] as const) {
    const door = findNode(scene, new RegExp(`^door[_-]?${side}$`, 'i'));
    if (door) {
      const s = side === 'L' ? 1 : -1;
      const dihedral = car.visual.doors === 'dihedral';
      parts.doors.push({
        pivot: door,
        axis: dihedral ? new THREE.Vector3(s * 0.35, 0.25, 1).normalize() : new THREE.Vector3(0, 1, 0),
        angle: dihedral ? s * 1.15 : -s * 1.05,
      });
    }
  }
  const wing = findNode(scene, /^wing[_-]?active$/i);
  if (wing) {
    const mode = car.physics.aero.activeWing?.mode;
    parts.wing = { pivot: wing, rest: wing.rotation.x, deployed: wing.rotation.x + (mode === 'drs' ? -0.37 : 0.92) };
  }
  for (const [name, kind] of [
    [/^mirror[_-]?l$/i, 'left'],
    [/^mirror[_-]?r$/i, 'right'],
    [/^mirror[_-]?interior$/i, 'interior'],
  ] as const) {
    const m = findNode(scene, name) as THREE.Mesh | null;
    if (m?.isMesh) parts.mirrors.push({ mesh: m, kind });
  }
  shell.updateMatrixWorld(true);
  shell.traverse((o) => {
    if (/^exhaust[_-]?tip/i.test(o.name)) parts.exhaustTips.push(o.getWorldPosition(new THREE.Vector3()));
    if (/^hide[_-]?in[_-]?cockpit/i.test(o.name)) parts.hiddenInCockpit.push(o);
  });
  const eye = findNode(scene, /^driver[_-]?eye$/i);
  if (eye) {
    const p = eye.getWorldPosition(new THREE.Vector3());
    parts.eye = [p.x, p.y, p.z];
  }
  // Exterior-only models (marker `cabin_kit` on the windscreen's base, `cabin_kit_noseats` when
  // the model has its own seats): the game's stand-in cabin is fitted around the driver's eye.
  const kitMarker = findNode(scene, /^cabin[_-]?kit/i);
  if (kitMarker && !parts.steeringWheel) {
    const cowl = kitMarker.getWorldPosition(new THREE.Vector3());
    const kit = buildCabinKit(car, parts.eye, !/noseats/i.test(kitMarker.name), [cowl.x, cowl.y, cowl.z]);
    shell.add(kit.group);
    parts.steeringWheel = kit.steeringWheel;
    parts.dash = kit.dash;
    parts.mirrors.push(kit.mirror);
    parts.hiddenInCockpit.push(...kit.hiddenInCockpit);
    // Body panels modelled for the outside only: from the seat the roof and pillars would vanish.
    // Their inner side gets a dark trim (a back-face copy sharing the geometry).
    const lining = new THREE.MeshStandardMaterial({ name: 'int_lining', color: 0x1b1c1f, roughness: 0.9, side: THREE.BackSide, envMapIntensity: 0.3 });
    const painted: THREE.Mesh[] = [];
    shell.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !Array.isArray(m.material) && (parts.paint.includes(m.material as THREE.MeshPhysicalMaterial) || /stripe/i.test(m.material.name))) painted.push(m);
    });
    for (const m of painted) {
      const inner = new THREE.Mesh(m.geometry, lining);
      inner.name = `${m.name}_lining`;
      m.add(inner);
    }
  }
  const screen = findNode(scene, /^dash[_-]?screen$/i) as THREE.Mesh | null;
  if (screen?.isMesh) {
    const canvas = document.createElement('canvas');
    canvas.width = DASH_WIDTH;
    canvas.height = DASH_HEIGHT;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    // glTF UVs have their origin at the top-left of the image (no vertical flip).
    texture.flipY = false;
    screen.material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    parts.dash = { canvas, texture };
  }
  return parts;
}
