/** Graphics quality presets (SPEC §2: Low / Medium / High / Ultra). */

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
  return 'high';
}

export function saveQuality(id: QualityId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
