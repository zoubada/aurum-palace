import type { Action } from '../core/Input';
import { clamp } from '../physics/math';

/**
 * On-screen controls for phones (phone held sideways): a steering strip under the left thumb,
 * brake and accelerator pedals under the right thumb, handbrake, gear paddles (manual gearbox
 * only), camera and "put back on the road". Every control follows its own finger (multi-touch).
 *
 *  - Steering is absolute: where the thumb sits on the strip sets the lock, the knob returns to
 *    the centre when the thumb lifts.
 *  - Pedals are progressive: a press near the bottom gives about half travel, sliding the thumb
 *    up the pedal pushes it to the floor.
 */

export interface TouchState {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: number;
  /** A finger is on one of the driving controls. */
  active: boolean;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  parent.appendChild(e);
  return e;
}

/** Pedal value from the finger height: half travel at the bottom edge, full travel from 2/3 up. */
const pedalValue = (yRel: number) => clamp(1.2 - 0.75 * yRel, 0.45, 1);

export class TouchControls {
  readonly root: HTMLDivElement;
  readonly state: TouchState = { throttle: 0, brake: 0, steer: 0, handbrake: 0, active: false };
  private readonly fingers = new Map<number, string>();
  private readonly knob: HTMLDivElement;
  private readonly gears: HTMLDivElement;
  private readonly fills: Record<'throttle' | 'brake', HTMLDivElement>;

  constructor(
    parent: HTMLElement,
    private readonly onAction: (a: Action) => void,
  ) {
    this.root = el('div', 'touch-ctl', parent);

    // --- Steering strip.
    const steer = el('div', 'tc-steer', this.root);
    el('span', 'tc-arrow left', steer).textContent = '◀';
    el('span', 'tc-arrow right', steer).textContent = '▶';
    this.knob = el('div', 'tc-knob', steer);
    this.track(steer, 'steer', (e, r) => {
      // Full lock a little before the ends; small dead zone in the middle.
      const x = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      const s = clamp((Math.abs(x) - 0.06) / 0.8, 0, 1);
      this.state.steer = Math.sign(x) * s * (0.4 + 0.6 * s);
      this.knob.style.transform = `translateX(${(x * r.width) / 2}px)`;
    }, () => {
      this.state.steer = 0;
      this.knob.style.transform = '';
    });

    // --- Pedals, handbrake, gears.
    const right = el('div', 'tc-right', this.root);
    const row = el('div', 'tc-row', right);
    this.gears = el('div', 'tc-gears', row);
    this.button(el('button', 'tc-btn tc-gear', this.gears), '−', () => this.onAction('shiftDown'));
    this.button(el('button', 'tc-btn tc-gear', this.gears), '+', () => this.onAction('shiftUp'));
    const hand = el('button', 'tc-btn tc-hand', row);
    hand.innerHTML = '<b>⊜</b>Frein à main';
    this.track(hand, 'hand', () => (this.state.handbrake = 1), () => (this.state.handbrake = 0));
    const pedals = el('div', 'tc-pedals', right);
    const brake = el('div', 'tc-pedal tc-brake', pedals);
    const throttle = el('div', 'tc-pedal tc-throttle', pedals);
    this.fills = { brake: el('div', 'tc-fill', brake), throttle: el('div', 'tc-fill', throttle) };
    el('span', 'tc-label', brake).textContent = 'Frein';
    el('span', 'tc-label', throttle).textContent = 'Accél.';
    for (const [node, key] of [
      [brake, 'brake'],
      [throttle, 'throttle'],
    ] as const) {
      this.track(node, key, (e, r) => {
        this.state[key] = pedalValue((e.clientY - r.top) / r.height);
        this.fills[key].style.transform = `scaleY(${this.state[key]})`;
      }, () => {
        this.state[key] = 0;
        this.fills[key].style.transform = 'scaleY(0)';
      });
    }

    // --- Top-right: camera, back on the road.
    const top = el('div', 'tc-top', this.root);
    this.button(el('button', 'tc-btn', top), 'Caméra', () => this.onAction('camera'));
    this.button(el('button', 'tc-btn', top), 'Replacer', () => this.onAction('reset'));

    this.setManual(false);
  }

  /** Gear buttons only with the manual gearbox. */
  setManual(manual: boolean): void {
    this.gears.hidden = !manual;
  }

  /** Press / drag / release on one control, following the finger that started it. */
  private track(node: HTMLElement, id: string, move: (e: PointerEvent, r: DOMRect) => void, release: () => void): void {
    const end = (e: PointerEvent) => {
      if (this.fingers.get(e.pointerId) !== id) return;
      this.fingers.delete(e.pointerId);
      node.classList.remove('down');
      release();
      this.state.active = this.fingers.size > 0;
    };
    node.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        node.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic events have no capturable pointer */
      }
      this.fingers.set(e.pointerId, id);
      node.classList.add('down');
      this.state.active = true;
      move(e, node.getBoundingClientRect());
    });
    node.addEventListener('pointermove', (e) => {
      if (this.fingers.get(e.pointerId) === id) move(e, node.getBoundingClientRect());
    });
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
    node.addEventListener('lostpointercapture', end);
  }

  private button(b: HTMLButtonElement, label: string, onPress: () => void): void {
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onPress();
    });
  }

  dispose(): void {
    this.root.remove();
  }
}
