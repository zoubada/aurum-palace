import type { CarConfig } from './types';
import { placeholderCar } from './placeholder/config';

/**
 * All playable cars. Phase 2 adds the 7 real models (SPEC §4), each in its own
 * folder: audi-rs3-8y, audi-rs6-c8, porsche-911-gt3-rs-992, ford-mustang-gt-s650,
 * bmw-m3-competition-g80, nissan-gt-r-r35, mclaren-720s.
 */
export const CARS: CarConfig[] = [placeholderCar];

export function getCar(id: string): CarConfig {
  return CARS.find((c) => c.id === id) ?? CARS[0];
}
