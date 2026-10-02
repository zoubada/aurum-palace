import type { ControlPoint } from '../TrackSpline';

/**
 * "Métropole de nuit" (SPEC §5, circuit 1), ~4.9 km, run anticlockwise from the start line:
 *  1. start/finish on the downtown boulevard, heading east;
 *  2. 90° left, chicane, then a rising sweep onto the river bridge;
 *  3. fast straight across the bridge, 14 m above the river;
 *  4. downhill hairpin at the end of the bridge;
 *  5. tunnel under the river (−12 m), lit, with light transitions;
 *  6. downtown sequence between the towers: 90° left, esses, 90° right;
 *  7. elevated viaduct sweeping back to the boulevard.
 * x = east, z = south (metres). Zones mark where bridges, tunnel and viaduct are built.
 */
export const CITY_LAYOUT: ControlPoint[] = [
  // Boulevard — start/finish (s = 0 at the first point).
  { x: 0, z: 0, w: 7.5, runoff: 2 },
  { x: 200, z: 0, w: 7.5, runoff: 2 },
  { x: 330, z: 0, w: 7, runoff: 3 },
  // Turn 1: 90° left.
  { x: 382, z: -16, w: 7, runoff: 4 },
  { x: 400, z: -64, w: 6.5, runoff: 2 },
  { x: 400, z: -200, w: 6.5, runoff: 2 },
  // Chicane.
  { x: 413, z: -240, w: 6.5, runoff: 2.5 },
  { x: 432, z: -272, w: 6.5, runoff: 2.5 },
  { x: 420, z: -306, w: 6.5, runoff: 2.5 },
  { x: 401, z: -342, w: 6.5, runoff: 2 },
  { x: 402, z: -400, w: 6.5, runoff: 2 },
  // Rising right-hander onto the bridge approach.
  { x: 432, z: -482, y: 3, w: 7, runoff: 2, bank: 2 },
  { x: 522, z: -560, y: 8, w: 7.5, runoff: 1.5, bank: 2, zone: 'viaduct' },
  { x: 640, z: -600, y: 12, w: 7.5, runoff: 1.5, zone: 'bridge' },
  // River bridge.
  { x: 850, z: -600, y: 14, w: 7.5, runoff: 1.5, zone: 'bridge' },
  { x: 1100, z: -600, y: 14, w: 7.5, runoff: 1.5, zone: 'bridge' },
  { x: 1300, z: -600, y: 13, w: 7.5, runoff: 1.5, zone: 'viaduct' },
  { x: 1450, z: -600, y: 8, w: 7.5, runoff: 2, zone: 'viaduct' },
  { x: 1560, z: -590, y: 4, w: 7.5, runoff: 4 },
  // Downhill hairpin (right).
  { x: 1630, z: -566, y: 2, w: 7.5, runoff: 7, bank: 1 },
  { x: 1662, z: -525, y: 1, w: 7.5, runoff: 7, bank: 1 },
  { x: 1647, z: -480, y: 0, w: 7.5, runoff: 7 },
  { x: 1600, z: -460, y: 0, w: 7, runoff: 3 },
  // Tunnel under the river.
  { x: 1450, z: -440, y: 0, w: 7, runoff: 2 },
  { x: 1320, z: -400, y: -4, w: 6.5, runoff: 1, zone: 'tunnel' },
  { x: 1150, z: -380, y: -11, w: 6.5, runoff: 1, zone: 'tunnel' },
  { x: 1000, z: -370, y: -12, w: 6.5, runoff: 1, zone: 'tunnel' },
  { x: 850, z: -360, y: -10, w: 6.5, runoff: 1, zone: 'tunnel' },
  { x: 720, z: -350, y: -3, w: 6.5, runoff: 2 },
  { x: 640, z: -340, y: 0, w: 6.5, runoff: 3 },
  // Downtown: 90° left, esses, 90° right.
  { x: 601, z: -318, w: 6.5, runoff: 3 },
  { x: 586, z: -278, w: 6.5, runoff: 2 },
  { x: 586, z: -150, w: 6.5, runoff: 2 },
  { x: 600, z: -100, w: 6.5, runoff: 2.5 },
  { x: 630, z: -58, w: 6.5, runoff: 2.5 },
  { x: 630, z: 0, w: 6.5, runoff: 2.5 },
  { x: 606, z: 50, w: 6.5, runoff: 2.5 },
  { x: 591, z: 110, w: 6.5, runoff: 3 },
  { x: 570, z: 150, w: 6.5, runoff: 4 },
  { x: 530, z: 170, w: 7, runoff: 2 },
  { x: 450, z: 172, w: 7, runoff: 2 },
  // Viaduct back towards the boulevard.
  { x: 330, z: 180, y: 2, w: 7, runoff: 1.5 },
  { x: 220, z: 210, y: 6, w: 7, runoff: 1.5, zone: 'viaduct' },
  { x: 120, z: 248, y: 9, w: 7, runoff: 1.5, bank: -2, zone: 'viaduct' },
  { x: 0, z: 260, y: 10, w: 7, runoff: 1.5, bank: -2, zone: 'viaduct' },
  { x: -120, z: 232, y: 9, w: 7, runoff: 1.5, bank: 3, zone: 'viaduct' },
  { x: -210, z: 162, y: 6, w: 7, runoff: 1.5, bank: 3, zone: 'viaduct' },
  { x: -250, z: 82, y: 3, w: 7, runoff: 2 },
  // Final left onto the boulevard.
  { x: -238, z: 22, y: 0, w: 7.5, runoff: 4 },
  { x: -190, z: 2, w: 7.5, runoff: 2 },
  { x: -100, z: 0, w: 7.5, runoff: 2 },
];

/** Start/finish and sector lines (distance along the lap, in fractions of the length). */
export const CITY_SECTORS = [0, 0.37, 0.68];
