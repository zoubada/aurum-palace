import type { TrackSpline } from './TrackSpline';

/**
 * Starting grid behind the start line (matches the painted boxes of `buildRoad`): two columns,
 * 8 m between slots, staggered left/right. Returns the distance along the lap of the car's CG
 * (front bumper just behind its box line) and its lateral offset.
 */
export function gridSlot(track: TrackSpline, slot: number, frontOverhang: number): { s: number; d: number } {
  const i = track.count - 8 - slot * 8;
  const side = slot % 2 ? -1 : 1;
  return { s: i * track.ds - frontOverhang - 0.4, d: side * 2.7 };
}
