/** What the player chose in the garage before driving (remembered between sessions). */

export type TrackId = 'test' | 'city' | 'annecy';
export type TimeOfDay = 'morning' | 'noon' | 'evening' | 'sunset';

export interface DriveOptions {
  track: TrackId;
  rain: boolean;
  /** AI opponents (0–5, circuits only). */
  opponents: number;
  /** Annecy: course (full lap or one shore) and time of day. */
  variant?: string;
  time?: TimeOfDay;
}

export const DEFAULT_DRIVE: DriveOptions = { track: 'city', rain: false, opponents: 3, variant: 'full', time: 'evening' };

export const TRACK_NAMES: Record<TrackId, string> = {
  test: "Piste d'essai",
  city: 'Métropole de nuit',
  annecy: 'Lac d’Annecy',
};

/** Local times (summer, Annecy) for the time-of-day choice. */
export const TIMES: Record<TimeOfDay, { label: string; hour: number }> = {
  morning: { label: 'Matin', hour: 9 },
  noon: { label: 'Midi', hour: 13.5 },
  evening: { label: 'Fin d’après-midi', hour: 18 },
  sunset: { label: 'Coucher du soleil', hour: 21.1 },
};

export const ANNECY_VARIANTS: Array<{ id: string; label: string }> = [
  { id: 'full', label: 'Tour complet' },
  { id: 'west', label: 'Rive ouest' },
  { id: 'east', label: 'Rive est' },
];

export const MAX_OPPONENTS = 5;
