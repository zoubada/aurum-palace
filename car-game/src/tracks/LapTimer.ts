/**
 * Lap timing (SPEC §5 "chronos, tours, checkpoints, pénalités de raccourci"):
 * start/finish line, sectors, checkpoints every 250 m that must be passed in order, and lap
 * invalidation when the car leaves the track (all four wheels off) or cuts the circuit.
 */

export interface LapRecord {
  time: number;
  sectors: number[];
}

export interface TimerEvents {
  /** A lap just ended (only once timing has started). */
  lap?: LapRecord & { valid: boolean; best: boolean };
  /** A sector just ended: index, time, delta to the best sector (null if none yet). */
  sector?: { index: number; time: number; delta: number | null };
  /** The lap was just invalidated, with the reason. */
  invalidated?: string;
}

const CHECKPOINT_SPACING = 250;

export class LapTimer {
  started = false;
  /** Completed laps. */
  laps = 0;
  /** Time in the current lap (s). */
  current = 0;
  valid = true;
  invalidReason = '';
  sectorTimes: number[] = [];
  lastLap: LapRecord | null = null;
  bestLap: LapRecord | null = null;
  bestSectors: number[] = [];
  private prevS = -1;
  private nextCheckpoint = 0;
  private readonly checkpoints: number[] = [];
  private readonly sectorStarts: number[];
  private sectorIndex = 0;
  private sectorStartTime = 0;
  private offTime = 0;

  /** Distance timed (the lap, or the sprint from start to finish). */
  readonly length: number;
  /** Sprint (point to point on the circuit): start and finish distances along the lap. */
  readonly sprint: { from: number; to: number } | null;
  /** Sprint finished: the timer has stopped. */
  finished = false;
  private readonly lapLength: number;

  constructor(lapLength: number, sectorFractions: number[], best: LapRecord | null = null, sprint: { from: number; to: number } | null = null) {
    this.lapLength = lapLength;
    this.sprint = sprint && sprint.to - sprint.from < lapLength - 1 ? sprint : null;
    const length = this.sprint ? this.sprint.to - this.sprint.from : lapLength;
    this.length = length;
    this.sectorStarts = sectorFractions.map((f) => f * length);
    for (let s = CHECKPOINT_SPACING; s < length - 50; s += CHECKPOINT_SPACING) this.checkpoints.push(s);
    this.bestLap = best;
    if (best) this.bestSectors = [...best.sectors];
  }

  /** Distance along the timed course (sprints: measured from the start line). */
  local(s: number): number {
    if (!this.sprint) return s;
    return (((s - this.sprint.from) % this.lapLength) + this.lapLength) % this.lapLength;
  }

  get sectorCount(): number {
    return this.sectorStarts.length;
  }

  /** Delta of the running lap to the best lap at the same point (estimated from sectors done). */
  get currentSector(): number {
    return this.sectorIndex;
  }

  private invalidate(reason: string, ev: TimerEvents): void {
    if (!this.valid || !this.started) return;
    this.valid = false;
    this.invalidReason = reason;
    ev.invalidated = reason;
  }

  update(dt: number, sLap: number, offTrack: boolean): TimerEvents {
    const ev: TimerEvents = {};
    if (this.finished) return ev;
    const L = this.lapLength;
    const s = this.local(sLap);
    const prev = this.prevS;
    this.prevS = s;
    if (prev < 0) return ev;
    let ds = s - prev;
    if (ds < -L / 2) ds += L;
    if (ds > L / 2) ds -= L;
    let crossedLine = ds > 0 && prev > s; // wrapped forwards through s = 0
    const crossedBack = ds < 0 && s > prev; // wrapped backwards
    // Sprint: the finish line is at the end of the timed distance.
    const finishing = !!this.sprint && this.started && ds > 0 && prev < this.length && s >= this.length;
    if (finishing) crossedLine = true;

    if (this.started) {
      this.current += dt;
      if (Math.abs(ds) > 60) this.invalidate('Raccourci', ev);
      if (crossedBack) this.invalidate('Marche arrière sur la ligne', ev);
      this.offTime = offTrack ? this.offTime + dt : 0;
      if (this.offTime > 0.25) this.invalidate('Hors piste', ev);
      // Checkpoints in order.
      const cp = this.checkpoints[this.nextCheckpoint];
      if (cp !== undefined && ds > 0 && prev < cp && s >= cp) this.nextCheckpoint++;
      // Sectors (the last one ends on the line).
      const nextStart = this.sectorStarts[this.sectorIndex + 1];
      if (nextStart !== undefined && ds > 0 && prev < nextStart && s >= nextStart) this.endSector(ev);
    }

    if (crossedLine) {
      if (this.started) {
        this.endSector(ev);
        if (this.nextCheckpoint < this.checkpoints.length) this.invalidate('Raccourci', ev);
        const rec: LapRecord = { time: this.current, sectors: [...this.sectorTimes] };
        const best = this.valid && (!this.bestLap || rec.time < this.bestLap.time);
        if (best) this.bestLap = rec;
        if (this.valid) rec.sectors.forEach((t, i) => (this.bestSectors[i] = Math.min(this.bestSectors[i] ?? Infinity, t)));
        this.lastLap = rec;
        this.laps++;
        ev.lap = { ...rec, valid: this.valid, best };
        if (this.sprint) {
          this.finished = true;
          return ev;
        }
      }
      this.started = true;
      this.current = 0;
      this.valid = true;
      this.invalidReason = '';
      this.sectorTimes = [];
      this.sectorIndex = 0;
      this.sectorStartTime = 0;
      this.nextCheckpoint = 0;
      this.offTime = 0;
    }
    return ev;
  }

  private endSector(ev: TimerEvents): void {
    if (this.sectorIndex >= this.sectorStarts.length) return;
    const t = this.current - this.sectorStartTime;
    const best = this.bestSectors[this.sectorIndex];
    ev.sector = { index: this.sectorIndex, time: t, delta: best !== undefined && Number.isFinite(best) ? t - best : null };
    this.sectorTimes.push(t);
    this.sectorIndex++;
    this.sectorStartTime = this.current;
  }
}

/** "1:23.456" */
export function formatLapTime(t: number): string {
  if (!Number.isFinite(t)) return '–:––.–––';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}
