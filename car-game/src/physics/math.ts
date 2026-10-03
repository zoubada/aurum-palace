/** Shared physical constants and small numeric helpers (no Three.js dependency). */

export const G = 9.81;
export const AIR_DENSITY = 1.225;
export const RPM_TO_RADS = (2 * Math.PI) / 60;
export const RADS_TO_RPM = 60 / (2 * Math.PI);

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Move `current` towards `target` by at most `maxDelta`. */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

/** Frame-rate independent exponential smoothing factor for a time constant `tau` (s). */
export function smoothFactor(dt: number, tau: number): number {
  return tau <= 0 ? 1 : 1 - Math.exp(-dt / tau);
}

/** Piecewise-linear lookup in a table sorted by x. Clamps outside the range. */
export function interpTable(table: ReadonlyArray<readonly [number, number]>, x: number): number {
  const n = table.length;
  if (x <= table[0][0]) return table[0][1];
  if (x >= table[n - 1][0]) return table[n - 1][1];
  for (let i = 1; i < n; i++) {
    const [x1, y1] = table[i];
    if (x <= x1) {
      const [x0, y0] = table[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[n - 1][1];
}
