/** Tiny typed wrapper over localStorage for settings (SPEC §1 "Sauvegarde"). Never throws. */

const PREFIX = 'cargame.';

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw) return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    /* private mode, corrupted value… use the default */
  }
  return fallback;
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
