import type { DriveInput } from '../physics/vehicle';
import { approach, clamp } from '../physics/math';

/**
 * Keyboard + gamepad input (SPEC §3 "Contrôles").
 *
 * Keyboard pedals and steering are digital, so they are ramped to feel like a
 * progressive input. Gamepads use analog triggers/stick with a deadzone and a
 * response curve. Steering wheels exposed through the Gamepad API work as a
 * gamepad (axis 0 + pedals as triggers); a dedicated wheel/remapping screen
 * and force feedback are planned with the controls settings (Phase 7).
 */

export type Action =
  | 'shiftUp'
  | 'shiftDown'
  | 'camera'
  | 'reset'
  | 'menu'
  | 'hud'
  | 'debug'
  | 'presetArcade'
  | 'presetIntermediate'
  | 'presetSimulation';

const KEY_ACTIONS: Record<string, Action> = {
  KeyE: 'shiftUp',
  KeyQ: 'shiftDown',
  KeyC: 'camera',
  KeyR: 'reset',
  Escape: 'menu',
  KeyP: 'menu',
  KeyH: 'hud',
  F3: 'debug',
  Digit1: 'presetArcade',
  Digit2: 'presetIntermediate',
  Digit3: 'presetSimulation',
};

// Standard gamepad mapping (Xbox layout names).
const PAD_ACTIONS: Array<[number, Action]> = [
  [5, 'shiftUp'], // RB
  [4, 'shiftDown'], // LB
  [3, 'camera'], // Y
  [8, 'reset'], // View / Back
  [9, 'menu'], // Menu / Start
];
const PAD_HANDBRAKE = 1; // B
const PAD_LOOKBACK = 2; // X
const PAD_THROTTLE = 7; // RT
const PAD_BRAKE = 6; // LT

export class Input {
  private readonly keys = new Set<string>();
  private readonly queued: Action[] = [];
  private readonly padPrev = new Map<number, boolean>();
  private rumbleCooldown = 0;

  /** Smoothed outputs. */
  readonly drive: DriveInput = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
  lookBack = false;
  /** 'keyboard' or the gamepad id currently in use (shown in the menu). */
  device = 'keyboard';

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'F3') e.preventDefault();
      if (!e.repeat) {
        const action = KEY_ACTIONS[e.code];
        if (action) this.queued.push(action);
      }
      this.keys.add(e.code);
      this.device = 'keyboard';
    });
    target.addEventListener('keyup', (e) => this.keys.delete(e.code));
    target.addEventListener('blur', () => this.keys.clear());
  }

  /** Edge-triggered actions since the last call. */
  consumeActions(): Action[] {
    return this.queued.splice(0, this.queued.length);
  }

  private down(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  private activePad(): Gamepad | null {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  update(dt: number, forwardSpeed: number): void {
    const pad = this.activePad();
    let padUsed = false;
    let padThrottle = 0;
    let padBrake = 0;
    let padSteer = 0;
    let padHandbrake = 0;
    let padLookBack = false;
    if (pad) {
      const btn = (i: number) => pad.buttons[i]?.value ?? 0;
      const raw = pad.axes[0] ?? 0;
      const dead = 0.08;
      const s = Math.abs(raw) < dead ? 0 : (Math.sign(raw) * (Math.abs(raw) - dead)) / (1 - dead);
      // Response curve: precise around the centre, full lock still reachable.
      padSteer = s * (0.35 + 0.65 * Math.abs(s));
      padThrottle = btn(PAD_THROTTLE);
      padBrake = btn(PAD_BRAKE);
      padHandbrake = btn(PAD_HANDBRAKE);
      padLookBack = btn(PAD_LOOKBACK) > 0.5;
      padUsed = Math.abs(s) > 0 || padThrottle > 0.02 || padBrake > 0.02 || padHandbrake > 0.5;
      for (const [i, action] of PAD_ACTIONS) {
        const pressed = (pad.buttons[i]?.value ?? 0) > 0.5;
        if (pressed && !this.padPrev.get(i)) this.queued.push(action);
        this.padPrev.set(i, pressed);
      }
      if (padUsed) this.device = pad.id;
    }

    const d = this.drive;
    if (padUsed) {
      d.throttle = padThrottle;
      d.brake = padBrake;
      d.steer = padSteer;
      d.handbrake = padHandbrake;
      this.lookBack = padLookBack;
      return;
    }

    // Keyboard: ramped pedals and speed-dependent steering rate.
    // KeyboardEvent.code is the physical key, so WASD also covers ZQSD on AZERTY.
    const thr = this.down('KeyW', 'ArrowUp');
    const brk = this.down('KeyS', 'ArrowDown');
    const left = this.down('KeyA', 'ArrowLeft');
    const right = this.down('KeyD', 'ArrowRight');
    d.throttle = approach(d.throttle, thr ? 1 : 0, (thr ? 4 : 8) * dt);
    d.brake = approach(d.brake, brk ? 1 : 0, (brk ? 5 : 10) * dt);
    d.handbrake = this.down('Space') ? 1 : 0;
    const target = (right ? 1 : 0) - (left ? 1 : 0);
    const speed = Math.abs(forwardSpeed);
    const rate = target === 0 ? 4.5 : Math.sign(target) !== Math.sign(d.steer) && d.steer !== 0 ? 5 : clamp(3.2 - speed * 0.03, 1.4, 3.2);
    d.steer = approach(d.steer, target, rate * dt);
    this.lookBack = this.down('KeyV', 'KeyB') || padLookBack;
  }

  /** Gamepad vibration (dual-rumble) — tire slip, kerbs and impacts. */
  rumble(strong: number, weak: number, dt: number): void {
    this.rumbleCooldown -= dt;
    if (this.rumbleCooldown > 0) return;
    this.rumbleCooldown = 0.1;
    const pad = this.activePad();
    const act = (pad as (Gamepad & { vibrationActuator?: GamepadHapticActuator }) | null)?.vibrationActuator;
    if (!act || (strong < 0.02 && weak < 0.02)) return;
    act
      .playEffect('dual-rumble', {
        duration: 120,
        strongMagnitude: clamp(strong, 0, 1),
        weakMagnitude: clamp(weak, 0, 1),
      })
      .catch(() => undefined);
  }
}
