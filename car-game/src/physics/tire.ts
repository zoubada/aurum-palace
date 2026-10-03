import { clamp } from './math';

/**
 * Tire model: Pacejka "magic formula" shape on a normalised combined slip.
 *
 * Slip ratio κ and slip angle α are each normalised by their peak value, so the
 * combined slip ρ = |(κ/κp, α/αp)| peaks at 1 in every direction. This gives a
 * friction ellipse (combined grip) for free: braking hard in a corner costs
 * lateral grip, exactly like a real tire.
 *
 * Not modelled yet (planned, see SPEC §3): tire temperature and wear.
 */
export interface TireParams {
  /** Rolling radius (m). */
  radius: number;
  /** Rotational inertia of wheel + tire + share of driveline (kg·m²). */
  inertia: number;
  /** Peak friction coefficient at nominal load on dry asphalt. */
  mu: number;
  /** Grip loss per unit of (Fz / nominalLoad − 1). Real tires: 0.1–0.2. */
  loadSensitivity: number;
  /** Load at which `mu` is measured (N). */
  nominalLoad: number;
  /** Slip ratio at peak longitudinal force (≈0.08–0.15). */
  peakSlipRatio: number;
  /** Slip angle at peak lateral force (rad, ≈0.10–0.16). */
  peakSlipAngle: number;
  /**
   * Pacejka shape factor C (>1). Controls the drop after the peak:
   * sliding grip = sin(C·π/2) × peak. 1.4 → ~81% (road tire), 1.3 → ~89% (semi-slick).
   */
  shapeC: number;
  /** Relaxation length (m): how far the tire rolls before lateral force builds up. */
  relaxationLength: number;
  /** Rolling resistance coefficient. */
  rollingResistance: number;
  /**
   * Longitudinal / lateral peak grip ratio (friction ellipse). Performance tires grip a little
   * more under braking and traction than in cornering: typically 1.05–1.15.
   */
  muLongScale: number;
}

export interface TireForce {
  /** Longitudinal force in the wheel frame (N, + = forward). */
  fx: number;
  /** Lateral force in the wheel frame (N, + = left). */
  fy: number;
  /** Combined normalised slip (1 = peak grip, >1 = sliding). */
  rho: number;
}

/** B factor so that sin(C·atan(B·s)) peaks exactly at s = 1. */
export function shapeB(C: number): number {
  return Math.tan(Math.PI / (2 * C));
}

/** Normalised magic formula: 0 at s=0, 1 at s=1, sin(C·π/2) as s→∞. */
export function magic(s: number, B: number, C: number): number {
  return Math.sin(C * Math.atan(B * s));
}

/** Effective friction coefficient accounting for load sensitivity and surface grip. */
export function effectiveMu(p: TireParams, fz: number, surfaceGrip: number): number {
  return p.mu * surfaceGrip * clamp(1 - p.loadSensitivity * (fz / p.nominalLoad - 1), 0.6, 1.25);
}

/**
 * Compute tire forces for a given slip state. Writes into `out` (no allocation:
 * this runs 4× per physics step at 240 Hz).
 */
export function tireForce(
  p: TireParams,
  B: number,
  kappa: number,
  alpha: number,
  fz: number,
  surfaceGrip: number,
  out: TireForce,
): TireForce {
  if (fz <= 0) {
    out.fx = 0;
    out.fy = 0;
    out.rho = 0;
    return out;
  }
  const kn = kappa / p.peakSlipRatio;
  const an = alpha / p.peakSlipAngle;
  const rho = Math.hypot(kn, an);
  out.rho = rho;
  if (rho < 1e-9) {
    out.fx = 0;
    out.fy = 0;
    return out;
  }
  const mag = effectiveMu(p, fz, surfaceGrip) * fz * magic(rho, B, p.shapeC);
  out.fx = (mag * p.muLongScale * kn) / rho;
  // Lateral force opposes the lateral sliding velocity (positive alpha = sliding left).
  out.fy = (-mag * an) / rho;
  return out;
}
