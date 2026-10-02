import { describe, expect, it } from 'vitest';
import { TrackSpline } from '../src/tracks/TrackSpline';
import { CITY_LAYOUT, CITY_SECTORS } from '../src/tracks/city/layout';
import { RacingLine } from '../src/ai/RacingLine';
import { RaceWorld, SplineSurface } from '../src/game-modes/RaceWorld';
import { CARS, getCar } from '../src/cars/registry';
import { formatLapTime } from '../src/tracks/LapTimer';

const track = new TrackSpline(CITY_LAYOUT, 1);
const line = new RacingLine(track);
const DT = 1 / 240;

describe('racing line', () => {
  it('stays inside the track limits', () => {
    for (const p of line.points) {
      const smp = track.sample(track.indexAt(p.s));
      expect(Math.abs(p.offset)).toBeLessThanOrEqual(smp.hw - 1.3 + 1e-6);
    }
  });

  it('gives a plausible ideal lap time', () => {
    const prof = line.speedProfile(getCar('mclaren-720s').physics);
    let t = 0;
    for (let i = 0; i < line.count; i++) t += line.spacing / Math.max(1, prof[i]);
    console.log(`Tour théorique (720S, profil de vitesse) : ${formatLapTime(t)}`);
    // 5 km street circuit: ~1:45–2:30 for these cars (average 120–170 km/h).
    expect(t).toBeGreaterThan(95);
    expect(t).toBeLessThan(170);
  });
});

describe.each(CARS.map((c) => c.id))('AI driver in %s', (id) => {
  it('completes a clean flying lap of the city circuit', () => {
    const car = getCar(id);
    const world = new RaceWorld(new SplineSurface(track), CITY_SECTORS);
    const r = world.add(car, { line, profile: line.speedProfile(car.physics), skill: 0.95, seed: 3 });
    world.surface.place(r, track.length - 40, 0);
    let maxImpact = 0;
    let resets = 0;
    let t = 0;
    while (t < 600 && (r.timer!.laps < 2 || !r.timer!.lastLap)) {
      r.impact = 0;
      world.step(DT);
      if (r.ai!.needsReset) resets++;
      maxImpact = Math.max(maxImpact, r.impact);
      t += DT;
      expect(Number.isFinite(r.vehicle.x)).toBe(true);
    }
    const lap = r.timer!.lastLap!;
    console.log(`${car.name} (IA) : tour ${formatLapTime(lap.time)} — secteurs ${lap.sectors.map((s) => s.toFixed(1)).join(' / ')} — choc max ${maxImpact.toFixed(1)} m/s`);
    expect(r.timer!.laps).toBeGreaterThanOrEqual(2);
    expect(lap.sectors.length).toBe(3);
    expect(lap.time).toBeGreaterThan(100);
    expect(lap.time).toBeLessThan(180);
    expect(maxImpact).toBeLessThan(1);
    expect(resets).toBe(0);
  });
});

describe('six AI cars together', () => {
  it('race two laps in traffic without getting stuck', () => {
    const world = new RaceWorld(new SplineSurface(track), CITY_SECTORS);
    const racers = CARS.slice(0, 6).map((car, i) => {
      const r = world.add(car, { line, profile: line.speedProfile(car.physics), skill: 0.9 + (i % 3) * 0.03, seed: i + 1 });
      // Two-by-two grid behind the start line.
      world.surface.place(r, track.length - 20 - Math.floor(i / 2) * 10, i % 2 ? -2.5 : 2.5);
      return r;
    });
    let maxImpact = 0;
    let resets = 0;
    for (let t = 0; t < 330; t += DT) {
      for (const r of racers) r.impact = 0;
      world.step(DT);
      for (const r of racers) {
        maxImpact = Math.max(maxImpact, r.impact);
        if (r.ai!.needsReset) resets++;
      }
      if (racers.every((r) => r.timer!.laps >= 2)) break;
    }
    const order = [...racers].sort((a, b) => b.progress - a.progress);
    console.log('Classement après 2 tours : ' + order.map((r, i) => `${i + 1}. ${r.car.name} (${r.timer!.laps} t)`).join(', '));
    console.log(`Choc max entre voitures/murs : ${maxImpact.toFixed(1)} m/s, voitures replacées : ${resets}`);
    expect(racers.every((r) => r.timer!.laps >= 2)).toBe(true);
    expect(resets).toBe(0);
  });
});
