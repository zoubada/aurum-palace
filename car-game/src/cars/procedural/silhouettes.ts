import type { BodyStyle } from '../types';

/**
 * Side-profile key points per body style, used by the procedural placeholder.
 * Heights are fractions of the car's height; longitudinal positions are metres measured
 * from the axles, so every car keeps its real wheelbase, overhangs and proportions.
 */
export interface Silhouette {
  /** Ground clearance of the sills (m). */
  clearance: number;
  /** Front bumper top. */
  nose: number;
  /** Hood leading edge. */
  hoodFront: number;
  /** Windscreen base (belt line at the front of the cabin). */
  cowl: number;
  /** Windscreen base, metres behind the front axle. */
  cowlZ: number;
  /** Roof leading edge, metres behind the front axle. */
  roofFrontZ: number;
  /** Roof trailing edge, metres ahead of the rear axle (negative = behind it). */
  roofRearZ: number;
  /** Base of the rear window, metres ahead of the rear axle (negative = behind it). */
  rearGlassZ: number;
  /** Height at the base of the rear window (deck / boot lid / engine cover). */
  deck: number;
  /** Rear bumper top. */
  tail: number;
  /** Inward lean of the side windows at roof level (m). */
  tumble: number;
  /** Four doors (else two long doors). */
  fourDoors: boolean;
}

export const SILHOUETTES: Record<BodyStyle, Silhouette> = {
  hatch: {
    clearance: 0.16,
    nose: 0.5,
    hoodFront: 0.6,
    cowl: 0.68,
    cowlZ: 0.95,
    roofFrontZ: 1.72,
    roofRearZ: -0.18,
    rearGlassZ: -0.52,
    deck: 0.74,
    tail: 0.63,
    tumble: 0.2,
    fourDoors: true,
  },
  wagon: {
    clearance: 0.15,
    nose: 0.48,
    hoodFront: 0.58,
    cowl: 0.67,
    cowlZ: 1.02,
    roofFrontZ: 1.88,
    roofRearZ: -0.82,
    rearGlassZ: -0.98,
    deck: 0.72,
    tail: 0.62,
    tumble: 0.2,
    fourDoors: true,
  },
  sedan: {
    clearance: 0.15,
    nose: 0.5,
    hoodFront: 0.6,
    cowl: 0.67,
    cowlZ: 1.05,
    roofFrontZ: 1.86,
    roofRearZ: 0.32,
    rearGlassZ: -0.42,
    deck: 0.7,
    tail: 0.68,
    tumble: 0.2,
    fourDoors: true,
  },
  fastback: {
    clearance: 0.15,
    nose: 0.52,
    hoodFront: 0.62,
    cowl: 0.69,
    cowlZ: 1.28,
    roofFrontZ: 2.02,
    roofRearZ: 0.58,
    rearGlassZ: -0.5,
    deck: 0.68,
    tail: 0.66,
    tumble: 0.21,
    fourDoors: false,
  },
  coupe: {
    clearance: 0.14,
    nose: 0.5,
    hoodFront: 0.6,
    cowl: 0.68,
    cowlZ: 1.12,
    roofFrontZ: 1.86,
    roofRearZ: 0.38,
    rearGlassZ: -0.42,
    deck: 0.72,
    tail: 0.7,
    tumble: 0.22,
    fourDoors: false,
  },
  rearengine: {
    clearance: 0.12,
    nose: 0.44,
    hoodFront: 0.52,
    cowl: 0.64,
    cowlZ: 0.88,
    roofFrontZ: 1.48,
    roofRearZ: 0.42,
    rearGlassZ: -0.52,
    deck: 0.66,
    tail: 0.66,
    tumble: 0.2,
    fourDoors: false,
  },
  midengine: {
    clearance: 0.11,
    nose: 0.36,
    hoodFront: 0.42,
    cowl: 0.6,
    cowlZ: 0.55,
    roofFrontZ: 1.45,
    roofRearZ: 0.88,
    rearGlassZ: 0.52,
    deck: 0.82,
    tail: 0.78,
    tumble: 0.25,
    fourDoors: false,
  },
};
