import type { CarConfig } from './types';
import { audiRs3 } from './audi-rs3-8y/config';
import { audiRs6 } from './audi-rs6-c8/config';
import { porscheGt3Rs } from './porsche-911-gt3-rs-992/config';
import { fordMustangGt } from './ford-mustang-gt-2021/config';
import { bmwM3 } from './bmw-m3-competition-g80/config';
import { nissanGtr } from './nissan-gt-r-r35/config';
import { mclaren675lt } from './mclaren-675lt/config';

/** All playable cars (SPEC §4). One folder per car in src/cars/<id>/. */
export const CARS: CarConfig[] = [audiRs3, audiRs6, porscheGt3Rs, fordMustangGt, bmwM3, nissanGtr, mclaren675lt];

export function getCar(id: string): CarConfig {
  return CARS.find((c) => c.id === id) ?? CARS[0];
}
