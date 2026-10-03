/** Graphics quality presets (SPEC §2: Low / Medium / High / Ultra). */
import { isTouchDevice } from './device';

export type QualityId = 'low' | 'medium' | 'high' | 'ultra';

export interface QualitySettings {
  id: QualityId;
  label: string;
  /** Cap on devicePixelRatio. */
  maxPixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  /** Post-processing chain (HDR target, bloom, tone mapping pass). Off = direct render. */
  postProcessing: boolean;
  bloom: boolean;
  /** MSAA samples on the HDR render target (0 = off). */
  msaa: number;
  /** Max anisotropic filtering for ground textures. */
  anisotropy: number;
  /** Number of decorative trees around the test area. */
  treeCount: number;
  /** Share of city blocks that get a building (0–1); applied when a circuit is built. */
  cityDensity: number;
  /** Real street/tunnel lights moved around the camera (each one costs shader time). */
  dynamicLights: number;
  /** Rain streaks drawn around the camera. */
  rainDrops: number;
}

export const QUALITY_PRESETS: Record<QualityId, QualitySettings> = {
  low: {
    id: 'low',
    label: 'Bas',
    maxPixelRatio: 1,
    shadows: true,
    shadowMapSize: 1024,
    postProcessing: false,
    bloom: false,
    msaa: 0,
    anisotropy: 2,
    treeCount: 150,
    cityDensity: 0.55,
    dynamicLights: 2,
    rainDrops: 2500,
  },
  medium: {
    id: 'medium',
    label: 'Moyen',
    maxPixelRatio: 1.25,
    shadows: true,
    shadowMapSize: 2048,
    postProcessing: true,
    bloom: true,
    msaa: 2,
    anisotropy: 4,
    treeCount: 400,
    cityDensity: 0.75,
    dynamicLights: 4,
    rainDrops: 5000,
  },
  high: {
    id: 'high',
    label: 'Élevé',
    maxPixelRatio: 1.5,
    shadows: true,
    shadowMapSize: 4096,
    postProcessing: true,
    bloom: true,
    msaa: 4,
    anisotropy: 8,
    treeCount: 900,
    cityDensity: 0.9,
    dynamicLights: 6,
    rainDrops: 9000,
  },
  ultra: {
    id: 'ultra',
    label: 'Ultra',
    maxPixelRatio: 2,
    shadows: true,
    shadowMapSize: 4096,
    postProcessing: true,
    bloom: true,
    msaa: 8,
    anisotropy: 16,
    treeCount: 1600,
    cityDensity: 1.0,
    dynamicLights: 10,
    rainDrops: 14000,
  },
};

const STORAGE_KEY = 'cargame.quality';

export function loadQuality(): QualityId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && v in QUALITY_PRESETS) return v as QualityId;
  } catch {
    /* storage unavailable: fall through to default */
  }
  // Phones: smaller screen, battery and heat — Medium keeps the frame rate up.
  return isTouchDevice() ? 'medium' : 'high';
}

export function saveQuality(id: QualityId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
