import * as THREE from 'three';
import type { CarConfig } from './types';
import type { Vehicle } from '../physics/vehicle';
import { radialTexture } from '../render/textures';

/**
 * Visual representation of a car.
 *
 * Phase 1 builds a PROCEDURAL PLACEHOLDER (clearly not a real model). Phase 2
 * replaces `buildPlaceholderBody` with the glTF pipeline, keeping the same node
 * layout: root (yaw) → body (pitch/roll around the CG) + 4 wheel pivots
 * (steer) → spin, plus named interior parts (steering wheel, dashboard screen).
 *
 * Car space: x = left, y = up, z = forward, origin on the ground under the CG.
 */

interface WheelNode {
  pivot: THREE.Group;
  spin: THREE.Group;
}

export class CarVisual {
  readonly root = new THREE.Group();
  /** Pitch/roll pivot placed at CG height. */
  readonly body = new THREE.Group();
  /** Parts hidden in cockpit view because they would block the camera. */
  private readonly hiddenInCockpit: THREE.Object3D[] = [];
  private readonly wheels: WheelNode[] = [];
  private steeringWheel!: THREE.Group;
  private brakeLightMat!: THREE.MeshStandardMaterial;
  private reverseLightMat!: THREE.MeshStandardMaterial;
  private dashCanvas!: HTMLCanvasElement;
  private dashTexture!: THREE.CanvasTexture;
  private dashTimer = 0;
  private readonly materials: THREE.Material[] = [];

  constructor(readonly config: CarConfig, vehicle: Vehicle) {
    const cg = config.physics.cgHeight;
    this.body.position.y = cg;
    const shell = new THREE.Group();
    shell.position.y = -cg;
    this.body.add(shell);
    this.root.add(this.body);

    this.buildPlaceholderBody(shell, vehicle);
    this.buildWheels(vehicle);
    this.buildContactShadow();

    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  private mat<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }

  // ---------------------------------------------------------------------------
  // Placeholder geometry
  // ---------------------------------------------------------------------------

  private buildPlaceholderBody(shell: THREE.Group, vehicle: Vehicle): void {
    const v = this.config.visual;
    const p = this.config.physics;
    const zf = vehicle.a; // front axle
    const zr = -vehicle.b; // rear axle
    const R = p.tires.front.radius;
    const archR = R + 0.06;
    const bottom = 0.2;
    const front = v.frontOverhangFromCg;
    const rear = -v.rearOverhangFromCg;
    const halfW = v.width / 2 - 0.04;

    const paint = this.mat(
      new THREE.MeshPhysicalMaterial({
        color: v.paint,
        metalness: 0.65,
        roughness: 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
      }),
    );
    const black = this.mat(new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.45, metalness: 0.2 }));
    const trim = this.mat(new THREE.MeshStandardMaterial({ color: 0x111215, roughness: 0.8 }));
    const chrome = this.mat(new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.12 }));
    const glass = this.mat(
      new THREE.MeshPhysicalMaterial({
        color: 0x0c1218,
        metalness: 0.1,
        roughness: 0.04,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    const interior = this.mat(new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.9 }));
    const mirrorGlass = this.mat(new THREE.MeshStandardMaterial({ color: 0x2a3038, metalness: 1, roughness: 0.06 }));
    const leather = this.mat(new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.65 }));

    // --- Lower body: side profile extruded across the width, with wheel arches cut out.
    const profile: Array<[number, number]> = [];
    // Arch from its rear foot, over the wheel, to its front foot.
    const arch = (zc: number): void => {
      const s = Math.asin((bottom - R) / archR); // angle where the arch meets the sill
      const a0 = Math.PI - s;
      const a1 = s;
      const n = 18;
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        profile.push([zc + archR * Math.cos(a), R + archR * Math.sin(a)]);
      }
    };
    profile.push([rear + 0.03, 0.36], [rear + 0.25, bottom + 0.03]);
    arch(zr);
    arch(zf);
    profile.push(
      [front - 0.22, bottom + 0.03],
      [front - 0.03, 0.3],
      [front, 0.46],
      [front - 0.02, 0.6],
      [front - 0.12, 0.7],
      [zf + 0.25, 0.8],
      [zf - 0.45, 0.88],
      [0.62, 0.93],
      // Cabin opening: drop to the floor so the interior is visible from inside.
      [0.55, 0.93],
      [0.5, 0.42],
      [-1.08, 0.42],
      [-1.1, 0.95],
      [rear + 0.75, 0.98],
      [rear + 0.1, 0.94],
      [rear, 0.78],
      [rear - 0.01, 0.56],
    );
    const shape = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y)));
    const depth = halfW * 2 - 0.16;
    const bodyGeo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.05,
      bevelSegments: 4,
      curveSegments: 4,
    });
    bodyGeo.translate(0, 0, -depth / 2);
    bodyGeo.rotateY(-Math.PI / 2); // shape x → car z, extrusion → car x
    bodyGeo.computeVertexNormals();
    shell.add(new THREE.Mesh(bodyGeo, paint));

    // --- Doors (outer skin between the arches) and sills.
    const doorLen = zf - archR - (zr + archR) - 0.04;
    const doorZ = (zf - archR + zr + archR) / 2;
    for (const side of [1, -1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, doorLen), paint);
      door.position.set(side * (halfW - 0.02), 0.62, doorZ);
      shell.add(door);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, doorLen), black);
      sill.position.set(side * (halfW - 0.01), 0.26, doorZ);
      shell.add(sill);
      // Inner door trim, visible from the cockpit.
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, doorLen - 0.1), interior);
      card.position.set(side * (halfW - 0.07), 0.7, doorZ);
      shell.add(card);
      // Side mirror.
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.12), paint);
      mirror.position.set(side * (halfW + 0.08), 1.0, 0.45);
      // Mirror glass: dark reflective stand-in until real-time mirrors (Phase 2).
      const glassM = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), mirrorGlass);
      glassM.position.set(side * (halfW + 0.08), 1.0, 0.388);
      glassM.rotation.y = Math.PI;
      shell.add(mirror, glassM);
    }

    // --- Greenhouse: windscreen, side windows, rear window, roof, pillars.
    const baseW = halfW - 0.08;
    const topW = halfW - 0.26;
    const yb = 0.94;
    const yt = 1.33;
    const zWsBase = 0.62;
    const zWsTop = -0.12;
    const zRoofRear = -1.02;
    const zRearBase = -1.78;
    const quad = (pts: number[][]): THREE.BufferGeometry => {
      const g = new THREE.BufferGeometry();
      const pos: number[] = [];
      const tri = (a: number[], b: number[], c: number[]) => pos.push(...a, ...b, ...c);
      for (let i = 1; i < pts.length - 1; i++) tri(pts[0], pts[i], pts[i + 1]);
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      return g;
    };
    const windscreen = quad([
      [baseW, yb, zWsBase],
      [-baseW, yb, zWsBase],
      [-topW, yt, zWsTop],
      [topW, yt, zWsTop],
    ]);
    const rearGlass = quad([
      [topW, yt, zRoofRear],
      [-topW, yt, zRoofRear],
      [-baseW, yb, zRearBase],
      [baseW, yb, zRearBase],
    ]);
    shell.add(new THREE.Mesh(windscreen, glass), new THREE.Mesh(rearGlass, glass));
    for (const s of [1, -1]) {
      const sideGlass = quad([
        [s * baseW, yb, zWsBase],
        [s * topW, yt, zWsTop],
        [s * topW, yt, zRoofRear],
        [s * baseW, yb, zRearBase],
      ]);
      shell.add(new THREE.Mesh(sideGlass, glass));
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(topW * 2 + 0.06, 0.04, zWsTop - zRoofRear + 0.06), [
      paint,
      paint,
      paint,
      interior,
      paint,
      paint,
    ]);
    roof.position.set(0, yt + 0.015, (zWsTop + zRoofRear) / 2);
    shell.add(roof);
    const bar = (a: THREE.Vector3, b: THREE.Vector3, t: number, m: THREE.Material) => {
      const len = a.distanceTo(b);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(t, t, len), m);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.lookAt(b); // box depth axis (+z) along the bar
      return mesh;
    };
    for (const s of [1, -1]) {
      shell.add(
        bar(new THREE.Vector3(s * baseW, yb, zWsBase), new THREE.Vector3(s * topW, yt, zWsTop), 0.07, black),
        bar(new THREE.Vector3(s * (baseW - 0.04), yb, -0.62), new THREE.Vector3(s * (topW + 0.02), yt, -0.6), 0.08, black),
        bar(new THREE.Vector3(s * topW, yt, zRoofRear), new THREE.Vector3(s * baseW, yb, zRearBase), 0.16, paint),
        bar(new THREE.Vector3(s * topW, yt + 0.01, zWsTop), new THREE.Vector3(s * topW, yt + 0.01, zRoofRear), 0.06, paint),
      );
    }

    // --- Front: grille, headlights, splitter. Rear: tail lights, diffuser, exhausts.
    const grille = new THREE.Mesh(new THREE.BoxGeometry(halfW * 1.1, 0.2, 0.06), black);
    grille.position.set(0, 0.43, front + 0.02);
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(halfW * 1.9, 0.03, 0.15), black);
    splitter.position.set(0, bottom + 0.05, front - 0.05);
    shell.add(grille, splitter);

    const headMat = this.mat(
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8f1ff, emissiveIntensity: 5 }),
    );
    for (const s of [1, -1]) {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.12), black);
      housing.position.set(s * (halfW - 0.33), 0.64, front - 0.08);
      housing.rotation.y = s * 0.15;
      const drl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.025, 0.04), headMat);
      drl.position.set(s * (halfW - 0.33), 0.67, front - 0.03);
      drl.rotation.y = s * 0.15;
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16), headMat);
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(s * (halfW - 0.4), 0.62, front - 0.02);
      shell.add(housing, drl, lamp);
    }

    this.brakeLightMat = this.mat(
      new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1a10, emissiveIntensity: 0.9 }),
    );
    this.reverseLightMat = this.mat(
      new THREE.MeshStandardMaterial({ color: 0x777777, emissive: 0xffffff, emissiveIntensity: 0 }),
    );
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(halfW * 1.95, 0.035, 0.03), this.brakeLightMat);
    tailBar.position.set(0, 0.84, rear - 0.0);
    shell.add(tailBar);
    for (const s of [1, -1]) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.05), this.brakeLightMat);
      tail.position.set(s * (halfW - 0.26), 0.81, rear + 0.02);
      const rev = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.03), this.reverseLightMat);
      rev.position.set(s * 0.35, 0.4, rear + 0.0);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.16, 20, 1, true), chrome);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(s * 0.55, 0.3, rear + 0.04);
      const pipe2 = pipe.clone();
      pipe2.position.x = s * 0.42;
      shell.add(tail, rev, pipe, pipe2);
    }
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(halfW * 1.5, 0.12, 0.25), black);
    diffuser.position.set(0, bottom + 0.06, rear + 0.15);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(halfW * 1.6, 0.03, 0.14), black);
    lip.position.set(0, 0.99, rear + 0.12);
    lip.rotation.x = -0.15;
    shell.add(diffuser, lip);

    // --- Interior ------------------------------------------------------------
    const [ex, , ez] = v.driverEye;
    const dash = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 - 0.12, 0.3, 0.42), interior);
    dash.position.set(0, 0.8, 0.4);
    const cowl = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 - 0.12, 0.04, 0.3), trim);
    cowl.position.set(0, 0.95, 0.52);
    const binnacle = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.16), trim);
    binnacle.position.set(ex, 0.99, 0.34);
    shell.add(dash, cowl, binnacle);

    // Instrument screen: canvas texture updated a few times per second (placeholder layout,
    // the real virtual cockpits of each car come in Phase 2).
    this.dashCanvas = document.createElement('canvas');
    this.dashCanvas.width = 512;
    this.dashCanvas.height = 192;
    this.dashTexture = new THREE.CanvasTexture(this.dashCanvas);
    this.dashTexture.colorSpace = THREE.SRGBColorSpace;
    const screenMat = this.mat(
      new THREE.MeshBasicMaterial({ map: this.dashTexture, toneMapped: false }),
    );
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.125), screenMat);
    screen.position.set(ex, 0.985, 0.255);
    screen.rotation.set(0.35, Math.PI, 0); // faces the driver, tilted up
    shell.add(screen);

    const center = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.75), interior);
    center.position.set(0, 0.55, -0.15);
    shell.add(center);
    for (const s of [1, -1]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), leather);
      seat.position.set(s * Math.abs(ex), 0.5, -0.45);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.12), leather);
      back.position.set(s * Math.abs(ex), 0.86, -0.76);
      back.rotation.x = -0.18;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.1), leather);
      head.position.set(s * Math.abs(ex), 1.27, -0.86);
      shell.add(seat, back, head);
      this.hiddenInCockpit.push(head);
    }

    // Steering wheel: rim + spokes + top marker. Rotates about the column (car z).
    const column = new THREE.Group();
    column.position.set(ex, 0.92, ez + 0.38);
    column.rotation.x = 0.38; // column tilt
    this.steeringWheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.018, 12, 40), leather);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 20), trim);
    hub.rotation.x = Math.PI / 2;
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.03, 0.04),
      this.mat(new THREE.MeshStandardMaterial({ color: 0xd8b21c, roughness: 0.6 })),
    );
    marker.position.y = 0.175;
    this.steeringWheel.add(rim, hub, marker);
    for (const ang of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.15, 0.015), trim);
      spoke.position.set(Math.sin(ang + Math.PI) * 0.09, Math.cos(ang + Math.PI) * 0.09, 0);
      spoke.rotation.z = -(ang + Math.PI);
      this.steeringWheel.add(spoke);
    }
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 10), trim);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 0.17;
    column.add(this.steeringWheel, shaft);
    shell.add(column);

    // Interior rear-view mirror.
    const rvm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.03), trim);
    rvm.position.set(0, yt - 0.08, zWsTop + 0.05);
    shell.add(rvm);
  }

  private buildWheels(vehicle: Vehicle): void {
    const v = this.config.visual;
    const tireMat = this.mat(new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.88, metalness: 0 }));
    const rimMat = this.mat(new THREE.MeshStandardMaterial({ color: v.rim, metalness: 0.9, roughness: 0.28 }));
    const discMat = this.mat(new THREE.MeshStandardMaterial({ color: 0x55575a, metalness: 0.85, roughness: 0.45 }));
    const caliperMat = this.mat(new THREE.MeshStandardMaterial({ color: v.caliper, metalness: 0.3, roughness: 0.4 }));

    for (const w of vehicle.wheels) {
      const R = w.tire.radius;
      const width = 0.27;
      const rimR = R * 0.68;
      // Tire cross-section revolved around the axle.
      const pts = [
        [rimR, -width / 2],
        [R - 0.035, -width / 2],
        [R - 0.008, -width / 2 + 0.018],
        [R, -width / 2 + 0.05],
        [R, width / 2 - 0.05],
        [R - 0.008, width / 2 - 0.018],
        [R - 0.035, width / 2],
        [rimR, width / 2],
      ].map(([r, y]) => new THREE.Vector2(r, y));
      const tireGeo = new THREE.LatheGeometry(pts, 48);
      tireGeo.rotateZ(Math.PI / 2);

      const pivot = new THREE.Group();
      pivot.position.set(w.y, R, w.x);
      const mirror = new THREE.Group();
      if (!w.left) mirror.scale.x = -1; // outer face always points outward
      const spin = new THREE.Group();
      spin.add(new THREE.Mesh(tireGeo, tireMat));

      // Rim barrel + 10 spokes + centre cap on the outer face.
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, width - 0.03, 32, 1, true), rimMat);
      barrel.rotation.z = Math.PI / 2;
      spin.add(barrel);
      for (let i = 0; i < 10; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.025, rimR * 0.95, 0.032), rimMat);
        const a = (i / 10) * Math.PI * 2;
        spoke.position.set(width / 2 - 0.03, Math.cos(a) * rimR * 0.5, Math.sin(a) * rimR * 0.5);
        spoke.rotation.x = a;
        spin.add(spoke);
      }
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.04, 20), rimMat);
      cap.rotation.z = Math.PI / 2;
      cap.position.x = width / 2 - 0.03;
      spin.add(cap);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.85, rimR * 0.85, 0.03, 32), discMat);
      disc.rotation.z = Math.PI / 2;
      spin.add(disc);

      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.2), caliperMat);
      caliper.position.set(0.04, rimR * 0.62, w.front ? -rimR * 0.45 : rimR * 0.45);
      caliper.rotation.x = w.front ? -0.6 : 0.6;

      mirror.add(spin, caliper);
      pivot.add(mirror);
      this.root.add(pivot);
      this.wheels.push({ pivot, spin });
    }
  }

  private buildContactShadow(): void {
    const v = this.config.visual;
    const mat = this.mat(
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        alphaMap: radialTexture(128, 0.35),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(v.width * 1.25, v.length * 1.12), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, 0.012, (v.frontOverhangFromCg - v.rearOverhangFromCg) / 2);
    plane.renderOrder = 1;
    plane.castShadow = false;
    this.root.add(plane);
  }

  // ---------------------------------------------------------------------------
  // Per-frame update
  // ---------------------------------------------------------------------------

  setCockpitView(cockpit: boolean): void {
    for (const o of this.hiddenInCockpit) o.visible = !cockpit;
  }

  update(vehicle: Vehicle, dt: number): void {
    this.root.position.set(vehicle.x, 0, vehicle.z);
    this.root.rotation.y = vehicle.yaw;
    this.body.rotation.set(vehicle.pitch, 0, vehicle.roll, 'YXZ');
    // Body sinks slightly with aero load and average suspension travel.
    let travel = 0;
    for (const w of vehicle.wheels) travel += w.travel;
    this.body.position.y = this.config.physics.cgHeight - (travel / 4) * 0.6;

    vehicle.wheels.forEach((w, i) => {
      const node = this.wheels[i];
      node.pivot.rotation.y = w.steer;
      node.spin.rotation.x = w.spin;
    });

    const maxDeg = this.config.physics.steering.steeringWheelMaxDeg;
    this.steeringWheel.rotation.z = THREE.MathUtils.degToRad(maxDeg) * (-vehicle.steerAngle / this.config.physics.steering.maxAngle);

    this.brakeLightMat.emissiveIntensity = vehicle.appliedBrake > 0.05 ? 6 : 0.9;
    this.reverseLightMat.emissiveIntensity = vehicle.gear === -1 ? 4 : 0;

    this.dashTimer -= dt;
    if (this.dashTimer <= 0) {
      this.dashTimer = 1 / 15;
      this.drawDash(vehicle);
    }
  }

  private drawDash(vehicle: Vehicle): void {
    const ctx = this.dashCanvas.getContext('2d')!;
    const W = this.dashCanvas.width;
    const H = this.dashCanvas.height;
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, W, H);
    const red = this.config.physics.engine.redlineRpm;
    const frac = Math.min(1, vehicle.engineRpm / (red + 500));
    const segs = 40;
    for (let i = 0; i < segs; i++) {
      const on = i / segs < frac;
      const rpmAt = ((i + 1) / segs) * (red + 500);
      ctx.fillStyle = !on ? '#1a1f26' : rpmAt > red ? '#ff3030' : rpmAt > red * 0.85 ? '#ffb020' : '#e8eef7';
      ctx.fillRect(16 + i * 12, 18, 9, 26);
    }
    ctx.fillStyle = '#e8eef7';
    ctx.font = 'bold 92px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(vehicle.speedKmh)), W / 2, 150);
    ctx.font = '22px Arial, sans-serif';
    ctx.fillText('km/h', W / 2, 180);
    ctx.font = 'bold 64px Arial, sans-serif';
    ctx.fillStyle = '#ffb020';
    const g = vehicle.gear;
    ctx.fillText(g === -1 ? 'R' : g === 0 ? 'N' : String(g), W - 60, 140);
    this.dashTexture.needsUpdate = true;
  }

  dispose(): void {
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
    this.dashTexture.dispose();
  }
}
