import type { CarConfig } from './types';
import { loadJSON, saveJSON } from '../core/storage';

/**
 * Player customisation and setup (SPEC §4 "Personnalisation"), stored per car.
 * `applySetup` returns a modified copy of the car config, so the physics stays config-driven.
 */
export interface CarSetup {
  paintIndex: number;
  rimIndex: number;
  /** Share of braking force on the front axle (0.5–0.8). */
  brakeBias: number;
  /** Handling balance via roll-stiffness distribution: −1 stable/understeer … +1 agile/oversteer. */
  balance: number;
  /** Downforce multiplier (0.6–1.4); drag follows partially. */
  aero: number;
  /** Final drive multiplier (0.9 = longer gears / higher top speed, 1.1 = shorter / punchier). */
  finalDrive: number;
}

export function factoryBrakeBias(car: CarConfig): number {
  const b = car.physics.brakes;
  const f = b.maxTorqueFront / car.physics.tires.front.radius;
  const r = b.maxTorqueRear / car.physics.tires.rear.radius;
  return f / (f + r);
}

export function defaultSetup(car: CarConfig): CarSetup {
  const paintIndex = Math.max(0, car.visual.paints.findIndex((p) => p.color === car.visual.paint));
  const rimIndex = Math.max(0, car.visual.rimColors.findIndex((r) => r.color === car.visual.rim));
  return { paintIndex, rimIndex, brakeBias: factoryBrakeBias(car), balance: 0, aero: 1, finalDrive: 1 };
}

export function loadSetup(car: CarConfig): CarSetup {
  return loadJSON<CarSetup>(`setup.${car.id}`, defaultSetup(car));
}

export function saveSetup(car: CarConfig, setup: CarSetup): void {
  saveJSON(`setup.${car.id}`, setup);
}

export function applySetup(car: CarConfig, s: CarSetup): CarConfig {
  const c: CarConfig = structuredClone(car);
  const p = c.physics;
  // Brake bias: redistribute the same total braking force between the axles.
  const Rf = p.tires.front.radius;
  const Rr = p.tires.rear.radius;
  const total = p.brakes.maxTorqueFront / Rf + p.brakes.maxTorqueRear / Rr;
  p.brakes.maxTorqueFront = s.brakeBias * total * Rf;
  p.brakes.maxTorqueRear = (1 - s.brakeBias) * total * Rr;
  // Balance: more front roll stiffness = more understeer.
  p.suspension.rollStiffnessFront = Math.min(0.75, Math.max(0.3, p.suspension.rollStiffnessFront - s.balance * 0.1));
  // Aero.
  p.aero.clAFront *= s.aero;
  p.aero.clARear *= s.aero;
  p.aero.cdA *= 1 + (s.aero - 1) * 0.25;
  // Gearing.
  p.gearbox.finalDrive *= s.finalDrive;
  const paint = c.visual.paints[s.paintIndex] ?? c.visual.paints[0];
  c.visual.paint = paint.color;
  c.visual.rim = (c.visual.rimColors[s.rimIndex] ?? c.visual.rimColors[0]).color;
  return c;
}
