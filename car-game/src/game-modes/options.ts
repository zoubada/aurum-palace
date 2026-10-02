/** What the player chose in the garage before driving (remembered between sessions). */

export type TrackId = 'test' | 'city';

export interface DriveOptions {
  track: TrackId;
  rain: boolean;
  /** AI opponents (0–5, circuits only). */
  opponents: number;
}

export const DEFAULT_DRIVE: DriveOptions = { track: 'city', rain: false, opponents: 3 };

export const TRACK_NAMES: Record<TrackId, string> = {
  test: "Piste d'essai",
  city: 'Métropole de nuit',
};

export const MAX_OPPONENTS = 5;
