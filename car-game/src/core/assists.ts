import { ASSIST_PRESETS, type AssistPresetId, type Assists } from '../physics/vehicle';

export const ASSIST_LABELS: Record<AssistPresetId, string> = {
  arcade: 'Arcade',
  intermediate: 'Intermédiaire',
  simulation: 'Simulation',
};

/** The preset matching these aids exactly, if any. */
export function presetOf(a: Assists): AssistPresetId | null {
  for (const id of Object.keys(ASSIST_PRESETS) as AssistPresetId[]) {
    const p = ASSIST_PRESETS[id];
    if ((Object.keys(p) as Array<keyof Assists>).every((k) => p[k] === a[k])) return id;
  }
  return null;
}
