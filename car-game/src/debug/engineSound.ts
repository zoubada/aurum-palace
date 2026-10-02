import { getCar } from '../cars/registry';
import { AudioEngine } from '../audio/AudioEngine';
import { CarAudio } from '../audio/CarAudio';
import { EngineEvents } from '../cars/EngineEvents';
import { ASSIST_PRESETS, Vehicle } from '../physics/vehicle';

/**
 * Offline sound preview: drives the car in the simulation (full-throttle launch, then a lift-off
 * at high revs) and renders the synthesised engine to a WAV, faster than real time.
 * Used to check and share each car's sound without playing the game.
 */
export async function engineSoundWav(carId: string, seconds = 7): Promise<string> {
  const car = getCar(carId);
  const rate = 44100;
  const ctx = new OfflineAudioContext(1, rate * seconds, rate);
  const audio = AudioEngine.offline(ctx);
  const sound = new CarAudio(audio, car);
  const v = new Vehicle(car.physics);
  v.assists = { ...ASSIST_PRESETS.intermediate };
  const events = new EngineEvents(car.sound, car.physics.engine.redlineRpm);
  const step = 1 / 50;
  // Script: 0.5 s idle, blip, 4 s flat out, then lift off and coast.
  const throttleAt = (t: number) => (t < 0.5 ? 0 : t < 0.8 ? 0.6 : t < 1.2 ? 0 : t < 5.2 ? 1 : 0);
  // Neutral for the idle and the blip, then first gear and the automatic box for the launch.
  v.assists.autoGear = false;
  v.gear = 0;
  for (let t = step; t < seconds; t += step) {
    void ctx.suspend(t).then(() => {
      const thr = throttleAt(t);
      if (t >= 1.2 && v.gear === 0) {
        v.gear = 1;
        v.assists.autoGear = true;
      }
      for (let i = 0; i < 240 * step; i++) v.step(1 / 240, { throttle: thr, brake: 0, steer: 0, handbrake: 0 });
      sound.update(v, events.update(step, v));
      void ctx.resume();
    });
  }
  const buffer = await ctx.startRendering();
  return toWavBase64(buffer.getChannelData(0), rate);
}

function toWavBase64(data: Float32Array, rate: number): string {
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  const gain = peak > 0 ? 0.9 / peak : 1;
  const bytes = new ArrayBuffer(44 + data.length * 2);
  const dv = new DataView(bytes);
  const str = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  dv.setUint32(4, 36 + data.length * 2, true);
  str(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  str(36, 'data');
  dv.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i] * gain)) * 32767, true);
  let bin = '';
  const u8 = new Uint8Array(bytes);
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
}
