import { describe, expect, it } from 'vitest';
import { TrackSpline } from '../src/tracks/TrackSpline';
import { CITY_LAYOUT } from '../src/tracks/city/layout';

const track = new TrackSpline(CITY_LAYOUT, 1);

describe('city circuit geometry', () => {
  it('is a closed lap of about 5 km', () => {
    console.log(`Longueur du circuit : ${(track.length / 1000).toFixed(2)} km, ${track.count} échantillons`);
    expect(track.length).toBeGreaterThan(4300);
    expect(track.length).toBeLessThan(5600);
    const a = track.samples[0].p;
    const b = track.samples[track.count - 1].p;
    expect(a.distanceTo(b)).toBeLessThan(2);
  });

  it('never runs into itself (distant parts of the lap stay apart)', () => {
    const n = track.count;
    let min = Infinity;
    for (let i = 0; i < n; i += 5) {
      for (let j = i + 120; j < n - 120 + i && j < n; j += 5) {
        const p = track.samples[i].p;
        const q = track.samples[j].p;
        const d = Math.hypot(p.x - q.x, p.z - q.z);
        min = Math.min(min, d);
      }
    }
    console.log(`Distance minimale entre deux portions éloignées : ${min.toFixed(1)} m`);
    expect(min).toBeGreaterThan(40);
  });

  it('has realistic gradients and corner radii', () => {
    let maxGrade = 0;
    let minRadius = Infinity;
    for (const s of track.samples) {
      maxGrade = Math.max(maxGrade, Math.abs(s.t.y));
      if (Math.abs(s.kappa) > 1e-4) minRadius = Math.min(minRadius, 1 / Math.abs(s.kappa));
    }
    console.log(`Pente max ${(maxGrade * 100).toFixed(1)} %, rayon de virage min ${minRadius.toFixed(1)} m`);
    expect(maxGrade).toBeLessThan(0.1);
    expect(minRadius).toBeGreaterThan(8);
  });

  it('projects points onto the track (distance along the lap, lateral offset, height)', () => {
    for (const s of [10, 900, 2100, 3700]) {
      const p = track.pointAt(s, 3);
      const q = track.project(p.x, p.z, track.indexAt(s) + 7);
      expect(Math.abs(q.s - s)).toBeLessThan(1.5);
      expect(Math.abs(q.lateral - 3)).toBeLessThan(0.1);
      expect(Math.abs(q.height - p.y)).toBeLessThan(0.05);
    }
  });

  it('contains the bridge, tunnel and viaduct', () => {
    const zones = new Set(track.samples.map((s) => s.zone));
    expect(zones.has('bridge') && zones.has('tunnel') && zones.has('viaduct')).toBe(true);
    const tunnelDepth = Math.min(...track.samples.filter((s) => s.zone === 'tunnel').map((s) => s.p.y));
    const bridgeHeight = Math.max(...track.samples.filter((s) => s.zone === 'bridge').map((s) => s.p.y));
    expect(tunnelDepth).toBeLessThan(-9);
    expect(bridgeHeight).toBeGreaterThan(12);
  });
});
