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

  constructor(
    readonly length: number,
    sectorFractions: number[],
    best: LapRecord | null = null,
  ) {
    this.sectorStarts = sectorFractions.map((f) => f * length);
    for (let s = CHECKPOINT_SPACING; s < length - 50; s += CHECKPOINT_SPACING) this.checkpoints.push(s);
    this.bestLap = best;
    if (best) this.bestSectors = [...best.sectors];
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

  update(dt: number, s: number, offTrack: boolean): TimerEvents {
    const ev: TimerEvents = {};
    const L = this.length;
    const prev = this.prevS;
    this.prevS = s;
    if (prev < 0) return ev;
    let ds = s - prev;
    if (ds < -L / 2) ds += L;
    if (ds > L / 2) ds -= L;
    const crossedLine = ds > 0 && prev > s; // wrapped forwards through s = 0
    const crossedBack = ds < 0 && s > prev; // wrapped backwards

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
