/**
 * Phones and tablets: touch is the main input (on-screen pedals and steering, phone layouts of
 * the garage and the HUD). Detected from a coarse primary pointer; `?touch=1` / `?touch=0` (or the
 * stored `cargame.touch` setting) forces it either way.
 */
let cached: boolean | null = null;

export function isTouchDevice(): boolean {
  if (cached !== null) return cached;
  let forced: string | null = null;
  try {
    forced = new URLSearchParams(location.search).get('touch') ?? localStorage.getItem('cargame.touch');
  } catch {
    /* storage unavailable */
  }
  if (forced === '1' || forced === '0') cached = forced === '1';
  else cached = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
  return cached;
}
