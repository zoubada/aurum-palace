import type * as THREE from 'three';
import type { QualitySettings } from '../core/quality';
import type { Racer, WorldSurface } from '../game-modes/RaceWorld';
import type { RacingLine } from '../ai/RacingLine';
import type { TrackSpline } from './TrackSpline';

/**
 * A place to drive, as the drive session sees it: its scenery and lighting (added to the
 * session's scene), the physical surface, timing sectors, starting grid and AI racing line.
 * Adding a circuit = one folder with its layout + a class implementing this interface.
 */

export interface TrackView {
  camera: THREE.PerspectiveCamera;
  player: Racer;
  racers: readonly Racer[];
  /** Simulated time (s). */
  time: number;
}

export interface TrackScene {
  readonly id: string;
  readonly name: string;
  readonly surface: WorldSurface;
  readonly spline: TrackSpline | null;
  /** Sector start lines as fractions of the lap (first = 0, the start line). */
  readonly sectors: number[];
  /** Shared AI racing line (null: no AI on this track). */
  readonly racingLine: RacingLine | null;
  /** Tire grip multiplier of the surface (rain). */
  readonly grip: number;
  readonly night: boolean;
  /** Exposure the camera should adapt to (tunnel ↔ open air). */
  readonly exposure: number;
  /** 0 = open air, 1 = deep in the tunnel (reverb, lighting). */
  readonly enclosure: number;
  /** Put a car on starting-grid slot k (0 = pole). */
  placeOnGrid(r: Racer, slot: number): void;
  /** Put a car back on the track after "R" (on the road, facing the right way). */
  recover(r: Racer): void;
  update(dt: number, view: TrackView): void;
  applyQuality(q: QualitySettings): void;
  /** Show the ideal racing line on the road, coloured from this car's speed profile (null: hide). */
  setRacingLine(profile: Float64Array | null): void;
  /** Track outline for the minimap (XZ, metres), null when there is none. */
  minimap(): Array<[number, number]> | null;
  dispose(): void;
}
