import { describe, expect, it } from 'vitest';
import trackJson from '../assets/tracks/annecy/track.json?raw';
import { TrackSpline } from '../src/tracks/TrackSpline';
import { RacingLine } from '../src/ai/RacingLine';
import { annecyControlPoints, type AnnecyTrackData } from '../src/tracks/annecy/data';

const data = JSON.parse(trackJson) as AnnecyTrackData;

describe('Annecy circuit data (real OSM / IGN)', () => {
  const t0 = performance.now();
  const track = new TrackSpline(annecyControlPoints(data), 1);
  const tSpline = performance.now() - t0;
  it('is a ~37 km loop around the lake with realistic altitudes and widths', () => {
    console.log(`Annecy : ${(track.length / 1000).toFixed(2)} km, spline en ${tSpline.toFixed(0)} ms`);
    expect(track.length).toBeGreaterThan(35000);
    expect(track.length).toBeLessThan(42000);
    let maxGrade = 0;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < track.count; i++) {
      const s = track.samples[i];
      minY = Math.min(minY, s.p.y);
      maxY = Math.max(maxY, s.p.y);
      maxGrade = Math.max(maxGrade, Math.abs(s.t.y));
      expect(s.hw).toBeGreaterThan(2.5);
      expect(s.hw).toBeLessThan(8);
    }
    console.log(`Altitude de la route : ${(minY + 446.97).toFixed(0)}–${(maxY + 446.97).toFixed(0)} m, pente max ${(maxGrade * 100).toFixed(1)} %`);
    // The lakeside roads stay between ~0 and ~120 m above the lake; grades of a main road.
    expect(minY).toBeGreaterThan(0);
    expect(maxY).toBeLessThan(150);
    expect(maxGrade).toBeLessThan(0.14);
  });

  it('gets a racing line computed in reasonable time', () => {
    const t1 = performance.now();
    const line = new RacingLine(track);
    console.log(`Trajectoire : ${line.count} points en ${(performance.now() - t1).toFixed(0)} ms`);
    for (const p of line.points) {
      const smp = track.sample(track.indexAt(p.s));
      expect(Math.abs(p.offset)).toBeLessThanOrEqual(smp.hw - 1.3 + 1e-6);
    }
  });
});

import { sunPosition } from '../src/render/sun';

describe('sun position', () => {
  it('matches the summer solstice at Annecy', () => {
    // 21 June, solar noon at Annecy ≈ 11:34 UTC: elevation ≈ 90 − 45.86 + 23.44 ≈ 67.6°, due south.
    const noon = sunPosition(new Date(Date.UTC(2026, 5, 21, 11, 34)), 45.86, 6.17);
    expect(noon.elevation).toBeGreaterThan(67);
    expect(noon.elevation).toBeLessThan(68.2);
    expect(Math.abs(noon.azimuth - 180)).toBeLessThan(3);
    // Sunset around 21:30 local (19:30 UTC), in the north-west.
    const eve = sunPosition(new Date(Date.UTC(2026, 5, 21, 19, 15)), 45.86, 6.17);
    expect(eve.elevation).toBeGreaterThan(0);
    expect(eve.elevation).toBeLessThan(5);
    expect(eve.azimuth).toBeGreaterThan(295);
    expect(eve.azimuth).toBeLessThan(310);
  });
});

import { RaceWorld, SplineSurface } from '../src/game-modes/RaceWorld';
import { getCar } from '../src/cars/registry';
import { formatLapTime } from '../src/tracks/LapTimer';

describe('AI around the lake', () => {
  it('drives a full clean lap of the 37.5 km tour', () => {
    const track = new TrackSpline(annecyControlPoints(data), 1);
    const line = new RacingLine(track);
    const car = getCar('porsche-911-gt3-rs-992');
    const world = new RaceWorld(new SplineSurface(track), data.sectors);
    const r = world.add(car, { line, profile: line.speedProfile(car.physics), skill: 0.95, seed: 2 });
    world.surface.place(r, track.length - 40, 0);
    const DT = 1 / 240;
    let maxImpact = 0;
    let resets = 0;
    const hits: string[] = [];
    for (let t = 0; t < 1800 && !r.timer!.lastLap; t += DT) {
      r.impact = 0;
      world.step(DT);
      if (r.ai!.needsReset) resets++;
      if (r.impact > 1) hits.push(`${r.s.toFixed(0)} m (${r.impact.toFixed(1)} m/s, ${r.vehicle.speedKmh.toFixed(0)} km/h, hw ${track.sample(r.trackIndex).hw.toFixed(1)}, κ ${track.sample(r.trackIndex).kappa.toFixed(3)})`);
      maxImpact = Math.max(maxImpact, r.impact);
    }
    if (hits.length) console.log('Contacts : ' + hits.slice(0, 12).join(' · '));
    const lap = r.timer!.lastLap!;
    const avg = track.length / lap.time * 3.6;
    console.log(`911 GT3 RS (IA) autour du lac : ${formatLapTime(lap.time)} (${avg.toFixed(0)} km/h de moyenne), secteurs ${lap.sectors.map((s) => s.toFixed(0)).join(' / ')} s, choc max ${maxImpact.toFixed(1)} m/s, replacements ${resets}`);
    expect(lap).toBeTruthy();
    expect(resets).toBe(0);
    expect(maxImpact).toBeLessThan(3);
    // Narrow country roads, villages and ~20 roundabouts: 100–170 km/h average for this car.
    expect(avg).toBeGreaterThan(90);
    expect(avg).toBeLessThan(175);
  }, 300000);
});
