import * as THREE from 'three';
import type { CarConfig } from '../types';
import type { CarParts, WheelNode } from '../parts';
import { SILHOUETTES } from './silhouettes';
import { DASH_HEIGHT, DASH_WIDTH } from '../dashboards';

/**
 * PROCEDURAL PLACEHOLDER of a car, built from its real dimensions (length, width, height,
 * wheelbase, overhangs, wheel sizes) and its silhouette type, with the brand's signature
 * details (grille, light graphics, wing, exhausts). It is a recognisable stand-in, not a
 * faithful model: the real glTF models replace it through src/cars/gltf.ts.
 */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Rounding of the body edges (m). */
const BEVEL_SIZE = 0.055;
type V3 = [number, number, number];

interface Ctx {
  car: CarConfig;
  parts: CarParts;
  shell: THREE.Group;
  mats: Mats;
  // key dimensions (shell space)
  H: number;
  halfW: number;
  zF: number;
  zR: number;
  zf: number;
  zr: number;
  Rf: number;
  Rr: number;
  bottom: number;
  yNose: number;
  yHood: number;
  yCowl: number;
  yDeck: number;
  yTail: number;
  zCowl: number;
  zRoofF: number;
  zRoofR: number;
  zRG: number;
  roofY: number;
  topW: number;
  baseW: number;
}

interface Mats {
  paint: THREE.MeshPhysicalMaterial;
  black: THREE.MeshStandardMaterial;
  gloss: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  interior: THREE.MeshStandardMaterial;
  leather: THREE.MeshStandardMaterial;
  carbon: THREE.MeshStandardMaterial;
  head: THREE.MeshStandardMaterial;
  drl: THREE.MeshStandardMaterial;
  brake: THREE.MeshStandardMaterial;
  reverse: THREE.MeshStandardMaterial;
  lens: THREE.MeshPhysicalMaterial;
  mirror: THREE.MeshStandardMaterial;
}

function makeMats(car: CarConfig): Mats {
  const v = car.visual;
  const paintOpt = v.paints.find((p) => p.color === v.paint) ?? v.paints[0];
  const named = <T extends THREE.Material>(name: string, m: T): T => {
    m.name = name;
    return m;
  };
  return {
    paint: named('paint', new THREE.MeshPhysicalMaterial({
      color: v.paint,
      metalness: 0.15 + paintOpt.metallic * 0.6,
      roughness: 0.38 - paintOpt.metallic * 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
    })),
    black: new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.55, metalness: 0.1 }),
    gloss: new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.15, metalness: 0.3 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.85 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd9dcdf, metalness: 1, roughness: 0.15 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x070b10,
      metalness: 0.1,
      roughness: 0.04,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    interior: new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.92 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x1f1d1c, roughness: 0.7 }),
    carbon: new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.35, metalness: 0.4 }),
    head: named('light_head', new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeaf2ff, emissiveIntensity: 1.2 })),
    drl: named('light_drl', new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf2f7ff, emissiveIntensity: 5 })),
    brake: named('light_brake', new THREE.MeshStandardMaterial({ color: 0x3a0000, emissive: 0xff1408, emissiveIntensity: 0.9 })),
    reverse: named('light_reverse', new THREE.MeshStandardMaterial({ color: 0x777777, emissive: 0xffffff, emissiveIntensity: 0 })),
    lens: new THREE.MeshPhysicalMaterial({ color: 0x111418, metalness: 0.2, roughness: 0.05, clearcoat: 1 }),
    mirror: named('mirror_glass', new THREE.MeshStandardMaterial({ color: 0x2a3038, metalness: 1, roughness: 0.06 })),
  };
}

// -----------------------------------------------------------------------------
// Geometry helpers
// -----------------------------------------------------------------------------

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, pos?: V3, parent?: THREE.Object3D): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  parent?.add(m);
  return m;
}

function box(w: number, h: number, d: number, mat: THREE.Material, pos: V3, parent: THREE.Object3D, rot?: V3): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat, pos, parent);
  if (rot) m.rotation.set(...rot);
  return m;
}

/** Thin bar between two points. */
function bar(a: THREE.Vector3, b: THREE.Vector3, t: number, mat: THREE.Material, parent: THREE.Object3D, depth = t): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(t, depth, a.distanceTo(b)), mat, undefined, parent);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.lookAt(b.clone().applyMatrix4(parent.matrixWorld));
  return m;
}

/** Convex polygon (fan) from 3D points. */
function poly(pts: V3[], mat: THREE.Material, parent: THREE.Object3D): THREE.Mesh {
  const pos: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) pos.push(...pts[0], ...pts[i], ...pts[i + 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return mesh(g, mat, undefined, parent);
}

/** Side panel: a 2D outline in (z, y) extruded `t` metres across x, centred at `x`. */
function sidePanel(outline: Array<[number, number]>, x: number, t: number, mat: THREE.Material, parent: THREE.Object3D): THREE.Mesh {
  const shape = new THREE.Shape(outline.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 2 });
  g.translate(0, 0, -t / 2);
  g.rotateY(-Math.PI / 2);
  const m = mesh(g, mat, undefined, parent);
  m.position.x = x;
  return m;
}

// -----------------------------------------------------------------------------

export function buildPlaceholder(car: CarConfig, a: number, b: number): CarParts {
  const v = car.visual;
  const sil = SILHOUETTES[v.bodyStyle];
  const shell = new THREE.Group();
  shell.name = 'placeholder-body';
  const mats = makeMats(car);
  const H = v.height;
  const zf = a;
  const zr = -b;
  const ctx: Ctx = {
    car,
    shell,
    mats,
    parts: {
      body: shell,
      wheels: [],
      steeringWheel: null,
      paint: [mats.paint],
      rims: [],
      calipers: [],
      brakeLights: [mats.brake],
      reverseLights: [mats.reverse],
      headLights: [mats.head, mats.drl],
      wing: null,
      doors: [],
      exhaustTips: [],
      mirrors: [],
      dash: null,
      eye: [0.36, 1, 0],
      hiddenInCockpit: [],
    },
    H,
    halfW: v.width / 2 - 0.035,
    zF: v.frontOverhangFromCg,
    zR: -v.rearOverhangFromCg,
    zf,
    zr,
    Rf: car.physics.tires.front.radius,
    Rr: car.physics.tires.rear.radius,
    bottom: sil.clearance,
    yNose: sil.nose * H,
    yHood: sil.hoodFront * H,
    yCowl: sil.cowl * H,
    yDeck: sil.deck * H,
    yTail: sil.tail * H,
    zCowl: zf - sil.cowlZ,
    zRoofF: zf - sil.roofFrontZ,
    zRoofR: zr + sil.roofRearZ,
    zRG: zr + sil.rearGlassZ,
    roofY: H - 0.025,
    baseW: v.width / 2 - 0.12,
    topW: v.width / 2 - 0.035 - sil.tumble,
  };
  shell.updateMatrixWorld();

  buildBodyShell(ctx);
  buildSides(ctx, sil.fourDoors);
  buildGreenhouse(ctx, sil.fourDoors);
  buildFront(ctx);
  buildRear(ctx);
  buildWing(ctx);
  buildInterior(ctx);
  buildWheels(ctx);

  shell.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return ctx.parts;
}

// -----------------------------------------------------------------------------

/** Height of the top of a wheel arch at z (or -Infinity outside it). */
function archTop(c: Ctx, z: number): number {
  let y = -Infinity;
  for (const [zc, R] of [
    [c.zf, c.Rf],
    [c.zr, c.Rr],
  ] as const) {
    const r = R + 0.065;
    const dz = z - zc;
    if (Math.abs(dz) < r) y = Math.max(y, R + Math.sqrt(r * r - dz * dz));
  }
  return y;
}

/** Belt line (top of the doors / base of the side windows) at z. */
function beltAt(c: Ctx, z: number): number {
  const t = THREE.MathUtils.clamp((c.zCowl - z) / (c.zCowl - c.zRG), 0, 1);
  return lerp(c.yCowl, c.yDeck, t);
}

function buildBodyShell(c: Ctx): void {
  // The extrusion bevel grows the outline by `bs` in every direction: draw the profile inset by
  // that amount so the finished surface lands on the real dimensions (and the lights sit on it).
  const bs = BEVEL_SIZE;
  const { zf, zr, Rf, Rr } = c;
  const zF = c.zF - bs;
  const zR = c.zR + bs;
  const bottom = c.bottom + bs;
  const yNose = c.yNose - bs;
  const yHood = c.yHood - bs;
  const yCowl = c.yCowl - bs;
  const yDeck = c.yDeck - bs;
  const yTail = c.yTail - bs;
  const profile: Array<[number, number]> = [];
  const arch = (zc: number, R: number) => {
    const r = R + 0.065 + bs;
    const s = Math.asin((bottom - R) / r);
    const a0 = Math.PI - s;
    const a1 = s;
    for (let i = 0; i <= 20; i++) {
      const ang = a0 + ((a1 - a0) * i) / 20;
      profile.push([zc + r * Math.cos(ang), R + r * Math.sin(ang)]);
    }
  };
  // Underside, rear to front, with both wheel arches.
  profile.push([zR + 0.05, bottom + 0.16], [zR + 0.3, bottom]);
  arch(zr, Rr);
  arch(zf, Rf);
  profile.push([zF - 0.3, bottom], [zF - 0.04, bottom + 0.12], [zF, yNose * 0.55], [zF - 0.015, yNose]);
  // Hood: slightly domed between its leading edge and the windscreen base.
  const zHood = zF - 0.16;
  profile.push([zHood, yHood]);
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    profile.push([lerp(zHood, c.zCowl, t), lerp(yHood, yCowl, Math.pow(t, 0.7)) + Math.sin(t * Math.PI) * 0.02]);
  }
  profile.push([c.zCowl + 0.03, yCowl]);
  // Cabin opening: the floor follows the wheel arches so the interior is visible from inside.
  const floorY = Math.max(bottom + 0.2, 0.3);
  const z0 = c.zCowl - 0.06;
  const z1 = c.zRG + 0.06;
  profile.push([c.zCowl - 0.01, yCowl]);
  for (let i = 0; i <= 24; i++) {
    const z = lerp(z0, z1, i / 24);
    profile.push([z, Math.max(floorY, archTop(c, z) + 0.04)]);
  }
  profile.push([c.zRG + 0.01, yDeck]);
  // Deck / boot lid / engine cover to the tail.
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    profile.push([lerp(c.zRG, zR + 0.1, t), lerp(yDeck, yTail, t) + Math.sin(t * Math.PI) * 0.015]);
  }
  profile.push([zR + 0.1, yTail], [zR, yTail - 0.1], [zR - 0.01, (yTail + bottom) / 2]);

  const shape = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y)));
  // A deep bevel rounds the body sides (shoulders and sills) instead of a slab.
  const bevelT = 0.15;
  const depth = c.halfW * 2 - bevelT * 2;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevelT,
    bevelSize: bs,
    bevelSegments: 7,
    curveSegments: 4,
  });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  mesh(g, c.mats.paint, undefined, c.shell);
  // Black sill / diffuser band hides the hard underside edge.
  box(c.halfW * 2 - 0.1, 0.06, c.zF - c.zR - 0.6, c.mats.black, [0, c.bottom + 0.02, (c.zF + c.zR) / 2], c.shell);
}

function buildSides(c: Ctx, fourDoors: boolean): void {
  // Door skins between the windscreen base and the rear window base, above the arches.
  const zA = c.zCowl - 0.02;
  const zEnd = c.zRG + 0.04;
  const zB = fourDoors ? lerp(c.zRoofF, c.zRoofR, 0.48) : Math.max(c.zRoofR - 0.05, c.zr + c.Rr + 0.12);
  const outlineFor = (za: number, zb: number) => {
    const pts: Array<[number, number]> = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const z = lerp(za, zb, i / n);
      pts.push([z, Math.max(c.bottom + 0.1, archTop(c, z) + 0.03)]);
    }
    for (let i = n; i >= 0; i--) {
      const z = lerp(za, zb, i / n);
      pts.push([z, beltAt(c, z)]);
    }
    return pts;
  };
  for (const side of [1, -1]) {
    const x = side * (c.halfW - 0.03);
    // Front door on a hinge at its leading edge (opens in the garage).
    const hinge = new THREE.Group();
    hinge.name = side > 0 ? 'door_L' : 'door_R';
    hinge.position.set(x, 0, zA);
    c.shell.add(hinge);
    const door = sidePanel(outlineFor(zA, zB), 0, 0.045, c.mats.paint, hinge);
    door.position.z = -zA;
    // Inner door card, seen from the cockpit.
    const card = sidePanel(outlineFor(zA + 0.04, zB - 0.04), -side * 0.04, 0.02, c.mats.interior, hinge);
    card.position.z = -zA;
    const dihedral = c.car.visual.doors === 'dihedral';
    c.parts.doors.push({
      pivot: hinge,
      axis: dihedral ? new THREE.Vector3(side * 0.35, 0.25, 1).normalize() : new THREE.Vector3(0, 1, 0),
      angle: dihedral ? side * 1.15 : -side * 1.05,
    });
    // Rear door / quarter panel.
    if (zEnd < zB - 0.05) sidePanel(outlineFor(zB, zEnd), x, 0.045, c.mats.paint, c.shell);
    // Door handle.
    box(0.02, 0.025, 0.16, c.mats.black, [side * (c.halfW + 0.005), beltAt(c, zA - 0.3) - 0.08, zB + 0.18], c.shell);
    // Exterior mirror at the base of the A-pillar, glass facing backwards.
    const my = c.yCowl + 0.08;
    const mz = c.zCowl - 0.16;
    const mx = side * (c.halfW + 0.1);
    box(0.17, 0.1, 0.12, c.mats.paint, [mx, my, mz], c.shell);
    box(0.08, 0.03, 0.06, c.mats.black, [side * (c.halfW + 0.02), my - 0.03, mz], c.shell);
    const glass = mesh(new THREE.PlaneGeometry(0.15, 0.08), c.mats.mirror, [mx, my, mz - 0.061], c.shell);
    glass.rotation.y = Math.PI;
    glass.name = side > 0 ? 'mirror_L' : 'mirror_R';
    c.parts.mirrors.push({ mesh: glass, kind: side > 0 ? 'left' : 'right' });
  }
  // Brand side details.
  if (c.car.visual.grille === 'porsche-intakes') {
    // GT3 RS: louvres on top of the front wheel arches.
    for (const side of [1, -1]) {
      for (let i = 0; i < 6; i++) {
        box(0.2, 0.012, 0.03, c.mats.black, [side * (c.halfW - 0.18), c.Rf + c.Rf + 0.1 + 0.005, c.zf - 0.15 + i * 0.06], c.shell);
      }
    }
  }
  if (c.car.visual.bodyStyle === 'midengine') {
    // McLaren: dark intakes behind the doors.
    for (const side of [1, -1]) {
      box(0.06, 0.22, 0.4, c.mats.gloss, [side * (c.halfW - 0.01), c.yCowl - 0.08, c.zr + c.Rr + 0.35], c.shell);
    }
  }
}

function buildGreenhouse(c: Ctx, fourDoors: boolean): void {
  const { baseW, topW, roofY, zCowl, zRoofF, zRoofR, zRG, yCowl, yDeck } = c;
  const m = c.mats;
  // Windscreen, rear window, side windows.
  poly(
    [
      [baseW, yCowl, zCowl],
      [-baseW, yCowl, zCowl],
      [-topW, roofY, zRoofF],
      [topW, roofY, zRoofF],
    ],
    m.glass,
    c.shell,
  );
  poly(
    [
      [topW, roofY, zRoofR],
      [-topW, roofY, zRoofR],
      [-baseW, yDeck, zRG],
      [baseW, yDeck, zRG],
    ],
    m.glass,
    c.shell,
  );
  const zB = fourDoors ? lerp(zRoofF, zRoofR, 0.48) : lerp(zRoofF, zRoofR, 0.85);
  const topAt = (z: number) => (z > zRoofF ? lerp(yCowl, roofY, (zCowl - z) / (zCowl - zRoofF)) : z < zRoofR ? lerp(roofY, yDeck, (zRoofR - z) / (zRoofR - zRG)) : roofY);
  const xAt = (y: number) => lerp(baseW, topW, (y - yCowl) / (roofY - yCowl));
  for (const s of [1, -1]) {
    // Front side window travels with the door.
    const door = c.parts.doors[s > 0 ? 0 : 1].pivot;
    const doorWin = poly(
      [
        [s * baseW, yCowl, zCowl],
        [s * topW, roofY, zRoofF],
        [s * xAt(topAt(zB)), topAt(zB), zB],
        [s * baseW, beltAt(c, zB), zB],
      ],
      m.glass,
      door,
    );
    doorWin.position.set(-door.position.x, 0, -door.position.z);
    poly(
      [
        [s * baseW, beltAt(c, zB), zB],
        [s * xAt(topAt(zB)), topAt(zB), zB],
        [s * topW, roofY, zRoofR],
        [s * baseW, yDeck, zRG],
      ],
      m.glass,
      c.shell,
    );
  }
  // Roof (paint outside, headliner inside).
  const roofLen = zRoofF - zRoofR;
  const roof = mesh(new THREE.BoxGeometry(topW * 2 + 0.07, 0.035, roofLen + 0.05), [m.paint, m.paint, m.paint, m.interior, m.paint, m.paint] as unknown as THREE.Material, [0, roofY + 0.015, (zRoofF + zRoofR) / 2], c.shell);
  roof.name = 'roof';
  if (c.car.visual.bodyStyle === 'midengine' || c.car.visual.wing === 'gt3rs-swan') {
    // Carbon roof on the McLaren and the GT3 RS (Weissach-style).
    (roof.material as unknown as THREE.Material[])[2] = m.carbon;
  }
  // Pillars: A (black), B, C (body colour, wide on coupés).
  const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  for (const s of [1, -1]) {
    bar(P(s * baseW, yCowl, zCowl), P(s * topW, roofY, zRoofF), 0.06, m.black, c.shell);
    bar(P(s * (baseW - 0.01), beltAt(c, zB), zB), P(s * (xAt(topAt(zB)) + 0.005), topAt(zB), zB), 0.07, m.black, c.shell);
    bar(P(s * topW, roofY, zRoofR), P(s * baseW, yDeck, zRG), fourDoors ? 0.12 : 0.18, m.paint, c.shell, 0.05);
    bar(P(s * topW, roofY + 0.005, zRoofF), P(s * topW, roofY + 0.005, zRoofR), 0.05, m.paint, c.shell);
  }
}

function buildFront(c: Ctx): void {
  const v = c.car.visual;
  const m = c.mats;
  const zF = c.zF;
  const yMid = (c.yNose + c.bottom) / 2;
  const hx = c.halfW;
  // Splitter.
  box(hx * 1.85, 0.03, 0.18, m.black, [0, c.bottom + 0.04, zF - 0.06], c.shell);
  // Headlight graphics.
  const lampY = lerp(c.yNose, c.yHood, 0.35);
  for (const s of [1, -1]) {
    const lx = s * (hx - 0.32);
    switch (v.headlights) {
      case 'audi-matrix': {
        box(0.5, 0.11, 0.1, m.lens, [lx, lampY, zF - 0.1], c.shell, [0, s * 0.18, s * 0.06]);
        box(0.42, 0.018, 0.04, m.drl, [lx, lampY - 0.035, zF - 0.06], c.shell, [0, s * 0.18, s * 0.06]);
        for (let i = 0; i < 4; i++) box(0.05, 0.03, 0.02, m.head, [lx - s * (0.12 - i * 0.07), lampY + 0.02, zF - 0.06], c.shell);
        break;
      }
      case 'porsche-quad': {
        // 911 headlights sit on top of the front wings.
        const ox = s * (hx - 0.25);
        const unit = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 28), m.lens, [ox, c.yHood + 0.02, c.zf + 0.32], c.shell);
        unit.rotation.x = Math.PI / 2 - 0.35;
        unit.scale.set(1, 1, 0.8);
        for (const [dx, dy] of [
          [-0.035, 0.035],
          [0.035, 0.035],
          [-0.035, -0.035],
          [0.035, -0.035],
        ]) {
          box(0.035, 0.035, 0.01, m.drl, [ox + dx, c.yHood + 0.02 + dy * 0.9, c.zf + 0.37 + dy * 0.3], c.shell, [-0.35, 0, 0]);
        }
        break;
      }
      case 'ford-tribar': {
        box(0.42, 0.09, 0.1, m.lens, [lx, lampY + 0.02, zF - 0.12], c.shell, [0, s * 0.2, 0]);
        for (let i = 0; i < 3; i++) box(0.018, 0.08, 0.02, m.drl, [lx - s * (0.06 - i * 0.06), lampY + 0.02, zF - 0.07], c.shell);
        break;
      }
      case 'bmw-l': {
        box(0.44, 0.1, 0.1, m.lens, [lx, lampY, zF - 0.11], c.shell, [0, s * 0.2, 0]);
        box(0.2, 0.016, 0.03, m.drl, [lx, lampY + 0.035, zF - 0.06], c.shell);
        box(0.016, 0.06, 0.03, m.drl, [lx + s * 0.1, lampY + 0.01, zF - 0.06], c.shell);
        break;
      }
      case 'nissan-boomerang': {
        box(0.46, 0.13, 0.1, m.lens, [lx, lampY + 0.01, zF - 0.12], c.shell, [0, s * 0.25, s * 0.12]);
        box(0.3, 0.016, 0.03, m.drl, [lx - s * 0.03, lampY - 0.04, zF - 0.06], c.shell, [0, 0, s * 0.35]);
        box(0.016, 0.07, 0.03, m.drl, [lx + s * 0.13, lampY - 0.01, zF - 0.07], c.shell);
        break;
      }
      case 'mclaren-socket': {
        // Dark "eye socket" running down into the intake, with the lamp on top.
        box(0.32, 0.16, 0.12, m.gloss, [lx, lampY - 0.02, zF - 0.13], c.shell, [0, s * 0.3, 0]);
        box(0.22, 0.02, 0.03, m.drl, [lx, lampY + 0.045, zF - 0.08], c.shell, [0, s * 0.3, 0]);
        box(0.08, 0.045, 0.03, m.head, [lx + s * 0.05, lampY + 0.01, zF - 0.08], c.shell);
        break;
      }
      default:
        box(0.4, 0.1, 0.1, m.lens, [lx, lampY, zF - 0.1], c.shell);
        box(0.36, 0.02, 0.03, m.drl, [lx, lampY - 0.03, zF - 0.06], c.shell);
    }
  }
  // Grille / intakes.
  switch (v.grille) {
    case 'audi-singleframe': {
      const s = new THREE.Shape();
      const w = 0.42;
      s.moveTo(-w, 0.12);
      s.lineTo(w, 0.12);
      s.lineTo(w * 1.12, -0.02);
      s.lineTo(w * 0.95, -0.18);
      s.lineTo(-w * 0.95, -0.18);
      s.lineTo(-w * 1.12, -0.02);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
      mesh(g, m.gloss, [0, yMid + 0.02, zF - 0.06], c.shell);
      for (let i = 0; i < 6; i++) box(0.8, 0.012, 0.02, m.black, [0, yMid - 0.12 + i * 0.045, zF - 0.005], c.shell);
      for (const s2 of [1, -1]) box(0.24, 0.12, 0.04, m.gloss, [s2 * (hx - 0.3), c.bottom + 0.14, zF - 0.06], c.shell);
      break;
    }
    case 'bmw-kidney': {
      for (const s of [1, -1]) {
        box(0.2, 0.36, 0.06, m.gloss, [s * 0.12, yMid + 0.02, zF - 0.05], c.shell);
        box(0.21, 0.37, 0.05, m.chrome, [s * 0.12, yMid + 0.02, zF - 0.07], c.shell);
        for (let i = 0; i < 6; i++) box(0.18, 0.012, 0.02, m.black, [s * 0.12, yMid - 0.13 + i * 0.055, zF - 0.015], c.shell);
        box(0.3, 0.14, 0.05, m.gloss, [s * (hx - 0.32), c.bottom + 0.15, zF - 0.06], c.shell);
      }
      break;
    }
    case 'ford-pony': {
      box(0.95, 0.24, 0.06, m.gloss, [0, yMid + 0.02, zF - 0.05], c.shell);
      box(0.12, 0.06, 0.02, m.chrome, [0, yMid + 0.02, zF - 0.015], c.shell);
      box(0.75, 0.08, 0.05, m.gloss, [0, c.bottom + 0.12, zF - 0.06], c.shell);
      break;
    }
    case 'nissan-v': {
      box(0.62, 0.22, 0.06, m.gloss, [0, yMid, zF - 0.05], c.shell);
      bar(new THREE.Vector3(-0.31, yMid + 0.11, zF - 0.015), new THREE.Vector3(0, yMid - 0.1, zF - 0.015), 0.03, m.chrome, c.shell);
      bar(new THREE.Vector3(0.31, yMid + 0.11, zF - 0.015), new THREE.Vector3(0, yMid - 0.1, zF - 0.015), 0.03, m.chrome, c.shell);
      for (const s of [1, -1]) box(0.22, 0.16, 0.05, m.gloss, [s * (hx - 0.3), c.bottom + 0.15, zF - 0.06], c.shell);
      break;
    }
    case 'porsche-intakes': {
      box(0.62, 0.12, 0.06, m.gloss, [0, c.bottom + 0.16, zF - 0.05], c.shell);
      for (const s of [1, -1]) box(0.32, 0.14, 0.06, m.gloss, [s * (hx - 0.3), c.bottom + 0.17, zF - 0.06], c.shell);
      // Hood vents of the GT3 RS (radiator exit).
      for (const s of [1, -1]) box(0.38, 0.015, 0.34, m.gloss, [s * 0.26, c.yHood + 0.03, zF - 0.55], c.shell, [-0.08, 0, 0]);
      break;
    }
    case 'mclaren-intakes': {
      box(0.75, 0.06, 0.06, m.gloss, [0, c.bottom + 0.1, zF - 0.05], c.shell);
      break;
    }
    default:
      box(0.8, 0.2, 0.06, m.gloss, [0, yMid, zF - 0.05], c.shell);
  }
}

function buildRear(c: Ctx): void {
  const v = c.car.visual;
  const m = c.mats;
  const zR = c.zR;
  const hx = c.halfW;
  const ly = c.yTail - 0.08;
  // Diffuser.
  box(hx * 1.4, 0.12, 0.3, m.black, [0, c.bottom + 0.06, zR + 0.18], c.shell);
  for (let i = -2; i <= 2; i++) box(0.012, 0.12, 0.28, m.black, [i * 0.18, c.bottom + 0.1, zR + 0.17], c.shell);
  // Tail-light graphics (brake material: brightens when braking).
  switch (v.taillights) {
    case 'audi-strip':
      box(hx * 1.4, 0.02, 0.03, m.brake, [0, ly + 0.02, zR - 0.005], c.shell);
      for (const s of [1, -1]) box(0.36, 0.07, 0.05, m.brake, [s * (hx - 0.25), ly, zR + 0.01], c.shell, [0, 0, s * 0.08]);
      break;
    case 'porsche-bar':
      box(hx * 1.85, 0.028, 0.03, m.brake, [0, ly + 0.02, zR - 0.005], c.shell);
      break;
    case 'ford-tribar':
      for (const s of [1, -1]) {
        box(0.42, 0.14, 0.05, m.gloss, [s * (hx - 0.3), ly - 0.02, zR + 0.01], c.shell);
        for (let i = 0; i < 3; i++) box(0.04, 0.12, 0.03, m.brake, [s * (hx - 0.42 + i * 0.12), ly - 0.02, zR - 0.01], c.shell);
      }
      break;
    case 'bmw-l':
      for (const s of [1, -1]) {
        box(0.42, 0.11, 0.05, m.lens, [s * (hx - 0.27), ly, zR + 0.01], c.shell);
        box(0.3, 0.02, 0.03, m.brake, [s * (hx - 0.3), ly + 0.03, zR - 0.01], c.shell);
        box(0.02, 0.08, 0.03, m.brake, [s * (hx - 0.15), ly, zR - 0.01], c.shell);
      }
      break;
    case 'nissan-quad-round':
      for (const s of [1, -1]) {
        for (const off of [0.2, 0.42]) {
          const ring = mesh(new THREE.TorusGeometry(0.075, 0.018, 10, 28), m.brake, [s * (hx - off), ly, zR - 0.005], c.shell);
          ring.rotation.y = 0;
          mesh(new THREE.CircleGeometry(0.06, 24), m.lens, [s * (hx - off), ly, zR - 0.002], c.shell).rotation.y = Math.PI;
        }
      }
      break;
    case 'mclaren-c':
      for (const s of [1, -1]) {
        box(0.025, 0.18, 0.03, m.brake, [s * (hx - 0.12), ly, zR + 0.02], c.shell);
        box(0.18, 0.02, 0.03, m.brake, [s * (hx - 0.2), ly + 0.09, zR + 0.02], c.shell);
        box(0.18, 0.02, 0.03, m.brake, [s * (hx - 0.2), ly - 0.09, zR + 0.02], c.shell);
      }
      // Open rear mesh of the McLaren.
      box(hx * 1.3, 0.22, 0.05, m.gloss, [0, ly - 0.05, zR + 0.03], c.shell);
      break;
    default:
      for (const s of [1, -1]) box(0.4, 0.08, 0.05, m.brake, [s * (hx - 0.26), ly, zR + 0.01], c.shell);
  }
  for (const s of [1, -1]) box(0.09, 0.04, 0.03, m.reverse, [s * 0.32, c.bottom + 0.24, zR + 0.02], c.shell);

  // Exhausts.
  const ex = v.exhaust;
  const tips: Array<[number, number, number]> = [];
  const yEx = c.bottom + 0.12;
  if (ex.layout === 'center') {
    const high = v.bodyStyle === 'midengine';
    const y = high ? c.yTail - 0.24 : yEx + 0.06;
    tips.push([0.1, y, 0.06], [-0.1, y, 0.06]);
  } else if (ex.layout === 'wide') {
    tips.push([hx - 0.32, yEx, 0.075], [-(hx - 0.32), yEx, 0.075]);
  } else {
    for (const s of [1, -1]) {
      tips.push([s * (hx - 0.3), yEx, 0.05]);
      if (ex.count === 4) tips.push([s * (hx - 0.43), yEx, 0.05]);
    }
  }
  for (const [x, y, r] of tips) {
    const pipe = mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.16, 24, 1, true), m.chrome, [x, y, zR + 0.04], c.shell);
    pipe.rotation.x = Math.PI / 2;
    if (ex.layout === 'wide') pipe.scale.set(1.4, 1, 0.8);
    const inner = mesh(new THREE.CircleGeometry(r * 0.9, 20), m.black, [x, y, zR + 0.05], c.shell);
    inner.rotation.y = Math.PI;
    c.parts.exhaustTips.push(new THREE.Vector3(x, y, zR - 0.05));
    const marker = new THREE.Object3D();
    marker.name = `exhaust_tip_${c.parts.exhaustTips.length - 1}`;
    marker.position.set(x, y, zR - 0.05);
    c.shell.add(marker);
  }
}

function buildWing(c: Ctx): void {
  const v = c.car.visual;
  const m = c.mats;
  const hx = c.halfW;
  switch (v.wing) {
    case 'roof-spoiler':
      box(c.topW * 2, 0.025, 0.2, m.paint, [0, c.roofY + 0.01, c.zRoofR - 0.08], c.shell, [0.08, 0, 0]);
      break;
    case 'lip':
      box(hx * 1.5, 0.03, 0.08, m.carbon, [0, c.yTail + 0.03, c.zR + 0.12], c.shell, [-0.2, 0, 0]);
      break;
    case 'gtr-wing': {
      const y = c.yTail + 0.2;
      for (const s of [1, -1]) box(0.04, 0.2, 0.12, m.black, [s * 0.55, c.yTail + 0.1, c.zR + 0.22], c.shell);
      box(hx * 1.65, 0.03, 0.26, m.paint, [0, y, c.zR + 0.2], c.shell, [0.1, 0, 0]);
      break;
    }
    case 'gt3rs-swan': {
      // Swan-neck pylons holding the main plane from above, DRS flap behind it.
      const y = c.H * 1.0;
      const z = c.zR + 0.28;
      for (const s of [1, -1]) {
        bar(new THREE.Vector3(s * 0.45, c.yDeck + 0.02, z + 0.35), new THREE.Vector3(s * 0.45, y + 0.12, z + 0.05), 0.035, m.black, c.shell, 0.14);
      }
      box(hx * 1.8, 0.035, 0.34, m.carbon, [0, y, z + 0.05], c.shell, [0.12, 0, 0]);
      for (const s of [1, -1]) box(0.02, 0.22, 0.5, m.carbon, [s * hx * 0.92, y + 0.02, z], c.shell);
      const pivot = new THREE.Group();
      pivot.name = 'wing_active';
      pivot.position.set(0, y + 0.03, z - 0.13);
      c.shell.add(pivot);
      box(hx * 1.76, 0.025, 0.2, m.carbon, [0, 0, -0.1], pivot);
      c.parts.wing = { pivot, rest: 0.42, deployed: 0.05 };
      break;
    }
    case 'active-blade': {
      // McLaren: flush blade over the rear deck that rises as an airbrake.
      const pivot = new THREE.Group();
      pivot.name = 'wing_active';
      pivot.position.set(0, c.yTail + 0.02, c.zR + 0.42);
      c.shell.add(pivot);
      box(hx * 1.5, 0.025, 0.36, m.carbon, [0, 0, -0.18], pivot);
      c.parts.wing = { pivot, rest: 0.03, deployed: 0.95 };
      break;
    }
    default:
      break;
  }
}

function buildInterior(c: Ctx): void {
  const m = c.mats;
  const v = c.car.visual;
  // Driver eye: under the roof, a little behind its leading edge, left-hand drive.
  const eye: V3 = [c.halfW * 0.4, c.roofY - 0.25, c.zRoofF - 0.22];
  c.parts.eye = eye;
  const eyeMarker = new THREE.Object3D();
  eyeMarker.name = 'driver_eye';
  eyeMarker.position.set(...eye);
  c.shell.add(eyeMarker);
  const [ex, ey, ez] = eye;
  const dashTop = c.yCowl - 0.03;
  const dashDepth = Math.min(0.55, c.zCowl - (ez + 0.3));
  box(c.halfW * 2 - 0.16, 0.3, dashDepth, m.interior, [0, dashTop - 0.15, c.zCowl - dashDepth / 2], c.shell);
  box(c.halfW * 2 - 0.16, 0.03, 0.25, m.trim, [0, dashTop + 0.005, c.zCowl - 0.12], c.shell);
  // Cluster hood and screen (brand display drawn on a canvas).
  // Cluster seen above the steering-wheel rim, like in the real cars.
  const clusterZ = ez + 0.66;
  const clusterY = dashTop + 0.06;
  // Visor above the screen (shades it, does not cover it).
  box(0.4, 0.025, 0.16, m.trim, [ex, clusterY + 0.08, clusterZ + 0.07], c.shell, [0.15, 0, 0]);
  const canvas = document.createElement('canvas');
  canvas.width = DASH_WIDTH;
  canvas.height = DASH_HEIGHT;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const screen = mesh(
    new THREE.PlaneGeometry(0.33, 0.124),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
    [ex, clusterY, clusterZ - 0.02],
    c.shell,
  );
  screen.rotation.set(0.32, Math.PI, 0);
  screen.name = 'dash_screen';
  c.parts.dash = { canvas, texture };
  // Centre screen (infotainment), off.
  if (v.dash !== 'porsche-gt' && v.dash !== 'mclaren-folding') {
    const cs = mesh(new THREE.PlaneGeometry(0.26, 0.15), m.gloss, [0, dashTop - 0.02, clusterZ - 0.02], c.shell);
    cs.rotation.set(0.2, Math.PI, 0);
  }
  // Seats and console.
  const seatZ = ez - 0.1;
  for (const s of [1, -1]) {
    const sx = s * Math.abs(ex);
    box(0.48, 0.12, 0.5, m.leather, [sx, Math.max(ey - 0.65, 0.4), seatZ + 0.1], c.shell);
    box(0.48, 0.66, 0.12, m.leather, [sx, ey - 0.3, seatZ - 0.22], c.shell, [-0.2, 0, 0]);
    const head = box(0.26, 0.2, 0.1, m.leather, [sx, ey + 0.09, seatZ - 0.3], c.shell, [-0.15, 0, 0]);
    if (s > 0) c.parts.hiddenInCockpit.push(head);
  }
  box(0.26, 0.2, 0.8, m.interior, [0, ey - 0.62, seatZ + 0.25], c.shell);
  box(0.05, 0.08, 0.05, m.chrome, [0, ey - 0.5, seatZ + 0.42], c.shell);

  // Steering wheel (flat-bottomed for the sporty brands), rotates about the column.
  const column = new THREE.Group();
  column.position.set(ex, ey - 0.37, ez + 0.47);
  column.rotation.x = 0.3;
  c.shell.add(column);
  const wheel = new THREE.Group();
  wheel.name = 'steering_wheel';
  const rim = mesh(new THREE.TorusGeometry(0.175, 0.019, 12, 40), m.leather, undefined, wheel);
  rim.scale.set(1, 0.95, 1);
  mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.05, 20), m.trim, undefined, wheel).rotation.x = Math.PI / 2;
  box(0.026, 0.032, 0.04, new THREE.MeshStandardMaterial({ color: 0xd8b21c, roughness: 0.6 }), [0, 0.175, 0], wheel);
  for (const ang of [Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const sp = box(0.03, 0.15, 0.016, m.trim, [Math.cos(ang) * 0.09, Math.sin(ang) * 0.09, 0], wheel);
    sp.rotation.z = ang + Math.PI / 2;
  }
  // Shift paddles.
  for (const s of [1, -1]) box(0.07, 0.11, 0.008, m.carbon, [s * 0.15, 0.03, 0.04], wheel);
  mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 10), m.trim, [0, 0, 0.18], column).rotation.x = Math.PI / 2;
  column.add(wheel);
  c.parts.steeringWheel = wheel;

  // Interior rear-view mirror (real-time render).
  const rvm = new THREE.Group();
  rvm.position.set(0, c.roofY - 0.09, c.zRoofF - 0.08);
  c.shell.add(rvm);
  box(0.26, 0.07, 0.03, m.trim, [0, 0, 0.012], rvm);
  const rvmGlass = mesh(new THREE.PlaneGeometry(0.24, 0.06), m.mirror, [0, 0, -0.005], rvm);
  rvmGlass.rotation.y = Math.PI;
  rvmGlass.name = 'mirror_interior';
  c.parts.mirrors.push({ mesh: rvmGlass, kind: 'interior' });
}

function buildWheels(c: Ctx): void {
  const v = c.car.visual;
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: v.rim, metalness: 0.85, roughness: 0.3, name: 'rim' });
  const caliperMat = new THREE.MeshStandardMaterial({ color: v.caliper, metalness: 0.3, roughness: 0.38, name: 'caliper' });
  const ids = ['FL', 'FR', 'RL', 'RR'];
  c.parts.rims.push(rimMat);
  c.parts.calipers.push(caliperMat);
  const track = [c.car.physics.trackFront, c.car.physics.trackFront, c.car.physics.trackRear, c.car.physics.trackRear];
  const pos = [
    [1, c.zf],
    [-1, c.zf],
    [1, c.zr],
    [-1, c.zr],
  ];
  pos.forEach(([side, z], i) => {
    const front = i < 2;
    const R = front ? c.Rf : c.Rr;
    const width = front ? 0.25 : 0.3;
    const rimR = R * 0.7;
    const pts = [
      [rimR, -width / 2],
      [R - 0.03, -width / 2],
      [R - 0.007, -width / 2 + 0.018],
      [R, -width / 2 + 0.05],
      [R, width / 2 - 0.05],
      [R - 0.007, width / 2 - 0.018],
      [R - 0.03, width / 2],
      [rimR, width / 2],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const tireGeo = new THREE.LatheGeometry(pts, 48);
    tireGeo.rotateZ(Math.PI / 2);

    const pivot = new THREE.Group();
    pivot.position.set((side * track[i]) / 2, R, z);
    const mirror = new THREE.Group();
    if (side < 0) mirror.scale.x = -1;
    const spin = new THREE.Group();
    spin.name = `wheel_${ids[i]}`;
    mesh(tireGeo, tireMat, undefined, spin);
    const barrel = mesh(new THREE.CylinderGeometry(rimR, rimR, width - 0.03, 32, 1, true), rimMat, undefined, spin);
    barrel.rotation.z = Math.PI / 2;
    const n = v.rimDesign.spokes;
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * Math.PI * 2;
      const sp = box(0.022, rimR * 0.94, 0.03, rimMat, [width / 2 - 0.035, Math.cos(ang) * rimR * 0.5, Math.sin(ang) * rimR * 0.5], spin);
      sp.rotation.x = ang;
    }
    const cap = mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.045, 20), v.rimDesign.centerLock ? c.mats.chrome : rimMat, undefined, spin);
    cap.rotation.z = Math.PI / 2;
    cap.position.x = width / 2 - 0.03;
    if (v.rimDesign.centerLock) {
      const nut = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 6), new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.4 }), undefined, spin);
      nut.rotation.z = Math.PI / 2;
      nut.position.x = width / 2 - 0.01;
    }
    const discMat = new THREE.MeshStandardMaterial({ name: 'brake_disc', color: 0x5a5c5f, metalness: 0.85, roughness: 0.42, emissive: 0xff2a00, emissiveIntensity: 0 });
    const disc = mesh(new THREE.CylinderGeometry(rimR * 0.86, rimR * 0.86, 0.032, 36), discMat, undefined, spin);
    disc.rotation.z = Math.PI / 2;
    const caliper = box(0.08, 0.13, 0.22, caliperMat, [0.035, rimR * 0.6, front ? -rimR * 0.42 : rimR * 0.42], mirror);
    caliper.rotation.x = front ? -0.6 : 0.6;
    caliper.name = `caliper_${ids[i]}`;
    mirror.add(spin);
    pivot.add(mirror);
    const node: WheelNode = { pivot, spin, disc: discMat };
    c.parts.wheels.push(node);
  });
}
