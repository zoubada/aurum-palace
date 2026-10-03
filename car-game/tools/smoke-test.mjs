/**
 * Browser smoke test: garage → test track → menu → back to garage → night city with rain and
 * AI opponents (start lights, lap timing, tunnel) → Lake Annecy sprint (real data, streamed
 * terrain), plus the glTF pipeline round trip and an offline engine-sound render. Fails on any
 * console error.
 *
 *   npm run build && npm run preview   (in another terminal)
 *   npm run smoke [-- <url> <screenshot-dir> <quality>]
 *
 * Waits are in *simulated* time (DriveSession.simTime) so the test is meaningful even on
 * machines without a GPU, where software rendering runs at ~1 FPS.
 * Set CHROMIUM_PATH to use a specific Chromium binary.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const OUT = process.argv[3] ?? 'smoke-shots';
const QUALITY = process.argv[4] ?? 'medium';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
const failures = [];
const check = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures.push(msg);
};

await page.addInitScript((q) => {
  localStorage.clear();
  localStorage.setItem('cargame.quality', q);
}, QUALITY);
await page.goto(URL);
await page.waitForFunction(() => window.__app?.current, null, { timeout: 120000 });

// --- Garage.
const cars = await page.evaluate(() => [...document.querySelectorAll('[data-car]')].map((b) => b.dataset.car));
check(cars.length === 7, `garage lists the 7 cars (${cars.join(', ')})`);
await page.click('[data-car="mclaren-675lt"]');
await page.click('[data-tab="setup"]');
await page.waitForFunction(() => /km\/h/.test(document.querySelector('[data-sim]')?.textContent ?? ''), null, { timeout: 120000 });
const simText = await page.textContent('[data-sim]');
check(/2,[6-9]\d? s|2\.[6-9]\d? s/.test(simText ?? ''), `garage measures the 675LT in simulation: "${simText?.trim()}"`);
await page.screenshot({ path: `${OUT}/01-garage.png` });

// --- Drive on the test track.
await page.click('[data-race="track"][data-value="test"]');
check((await page.textContent('[data-action="drive"]'))?.includes("Piste d'essai"), 'garage: test track selected');
await page.click('[data-action="drive"]');
await page.waitForFunction(() => window.__app.current?.world && window.__app.current.simTime > 0, null, { timeout: 300000 });
const waitSim = async (s) => {
  const start = await page.evaluate(() => window.__app.current.simTime);
  await page.waitForFunction((t) => window.__app.current.simTime >= t, start + s, { timeout: 900000, polling: 50 });
};
const state = () =>
  page.evaluate(() => {
    const v = window.__app.current.vehicle;
    return { kmh: v.speedKmh, gear: v.gear, finite: [v.x, v.z, v.u, v.v, v.r].every(Number.isFinite) };
  });

await waitSim(0.5);
await page.keyboard.down('ArrowUp');
await waitSim(4);
const s1 = await state();
check(s1.kmh > 120, `675LT accelerates: ${s1.kmh.toFixed(1)} km/h after 4 s, gear ${s1.gear}`);
check(await page.evaluate(() => !!window.__app.current.carAudio), 'engine sound running');
await page.screenshot({ path: `${OUT}/02-drive.png` });
for (const [i, mode] of ['cockpit', 'hood', 'chase'].entries()) {
  await page.evaluate((m) => window.__app.current.rig.setMode(m), mode);
  await waitSim(0.25);
  await page.screenshot({ path: `${OUT}/03-camera-${i}-${mode}.png` });
}
await page.keyboard.up('ArrowUp');
await page.keyboard.down('ArrowDown');
await waitSim(0.4);
const b0 = await state();
const wing = await page.evaluate(() => window.__app.current.vehicle.wingDeploy);
const t0 = await page.evaluate(() => window.__app.current.simTime);
await waitSim(1.2);
const b1 = await state();
const t1 = await page.evaluate(() => window.__app.current.simTime);
await page.keyboard.up('ArrowDown');
const decelG = ((b0.kmh - b1.kmh) / 3.6 / (t1 - t0)) / 9.81;
check(decelG > 0.9, `brakes: ${b0.kmh.toFixed(0)} → ${b1.kmh.toFixed(0)} km/h, ${decelG.toFixed(2)} g average`);
check(wing > 0.5, `675LT airbrake deployed under hard braking above 100 km/h (${wing.toFixed(2)})`);

await page.keyboard.press('Escape');
await page.waitForSelector('.menu:not(.hidden)', { timeout: 120000 });
await page.screenshot({ path: `${OUT}/04-menu.png` });
await page.click('button[data-preset="simulation"]');
const assists = await page.evaluate(() => window.__app.current.vehicle.assists);
check(!assists.abs && !assists.tc && !assists.autoGear, 'menu applies the Simulation preset');
check((await state()).finite, 'vehicle state is finite');
await page.click('[data-action="garage"]');
await page.waitForSelector('.garage', { timeout: 120000 });
check(true, 'back to the garage');

// --- Night city, rain, two AI opponents.
await page.click('[data-race="track"][data-value="city"]');
await page.click('[data-race="rain"][data-value="1"]');
await page.click('[data-race="opponents"][data-value="2"]');
await page.click('[data-action="drive"]');
await page.waitForFunction(() => window.__app.current?.world, null, { timeout: 300000 });
const city = await page.evaluate(() => {
  const s = window.__app.current;
  return { track: s.track.name, grip: s.track.grip, racers: s.world.racers.length, lights: !!document.querySelector('.race-lights:not([hidden])') };
});
check(city.track === 'Métropole de nuit' && city.grip < 1 && city.racers === 3, `city loaded: ${JSON.stringify(city)}`);
check(city.lights, 'start lights shown');
await waitSim(1);
await page.screenshot({ path: `${OUT}/05-city-grid.png` });
const held = await page.evaluate(() => window.__app.current.world.racers.map((r) => r.vehicle.speedKmh));
check(held.every((k) => k < 1), `cars held during the countdown (${held.map((k) => k.toFixed(1)).join(', ')} km/h)`);
await waitSim(5);
await page.keyboard.down('ArrowUp');
await waitSim(6);
await page.keyboard.up('ArrowUp');
const race = await page.evaluate(() => {
  const s = window.__app.current;
  return {
    started: s.player.timer.started,
    ai: s.world.racers.filter((r) => r.ai).map((r) => r.vehicle.speedKmh),
    pos: document.querySelector('.race-pos')?.textContent,
    kmh: s.vehicle.speedKmh,
  };
});
check(race.started && race.kmh > 60, `player away and timing: ${race.kmh.toFixed(0)} km/h, lap started ${race.started}`);
check(race.ai.every((k) => k > 60), `AI cars racing (${race.ai.map((k) => k.toFixed(0)).join(', ')} km/h)`);
check(/P\d\/3/.test(race.pos ?? ''), `position shown (${race.pos})`);
await page.screenshot({ path: `${OUT}/06-city-race.png` });
// Teleport into the tunnel: exposure and enclosure adapt.
await page.evaluate(() => {
  const s = window.__app.current;
  s.track.surface.place(s.player, 2900, 0);
  s.rig.snap();
});
await waitSim(2.5);
const tunnel = await page.evaluate(() => ({ enc: window.__app.current.track.enclosure, exp: window.__app.current.track.exposure }));
check(tunnel.enc > 0.9 && tunnel.exp < 1.1, `inside the tunnel: enclosure ${tunnel.enc.toFixed(2)}, exposure ${tunnel.exp.toFixed(2)}`);
await page.screenshot({ path: `${OUT}/07-city-tunnel.png` });
check((await state()).finite, 'vehicle state is finite');
await page.keyboard.press('Escape');
await page.waitForSelector('.menu:not(.hidden)', { timeout: 120000 });
await page.click('label:has([data-line])');
check(await page.evaluate(() => JSON.parse(localStorage.getItem('cargame.racingLine')).on === true), 'racing line toggled from the menu');
await page.click('[data-action="garage"]');
await page.waitForSelector('.garage', { timeout: 120000 });

// --- Lac d'Annecy (real data, streamed terrain): west-shore sprint, one AI opponent, sunset.
await page.click('[data-race="track"][data-value="annecy"]');
await page.click('[data-race="variant"][data-value="west"]');
await page.click('[data-race="time"][data-value="sunset"]');
await page.click('[data-race="rain"][data-value="0"]');
await page.click('[data-race="opponents"][data-value="1"]');
await page.click('[data-action="drive"]');
await page.waitForFunction(() => window.__app.current?.track?.id === 'annecy', null, { timeout: 600000 });
const lake = await page.evaluate(() => {
  const s = window.__app.current;
  return { name: s.track.name, km: s.track.spline.length / 1000, sprint: s.track.sprint, tiles: s.track.stats, racers: s.world.racers.length };
});
check(lake.km > 35 && lake.km < 42 && lake.sprint && lake.racers === 2, `Annecy loaded: ${JSON.stringify(lake)}`);
await waitSim(6);
await page.keyboard.down('ArrowUp');
await waitSim(5);
await page.keyboard.up('ArrowUp');
const lakeRun = await page.evaluate(() => {
  const s = window.__app.current;
  return { kmh: s.vehicle.speedKmh, started: s.player.timer.started, label: document.querySelector('.race-lap')?.textContent, tiles: s.track.stats };
});
check(lakeRun.kmh > 60 && lakeRun.started && /Sprint/.test(lakeRun.label ?? ''), `Annecy sprint under way: ${lakeRun.kmh.toFixed(0)} km/h, ${lakeRun.label}, ${lakeRun.tiles}`);
await page.screenshot({ path: `${OUT}/08-annecy.png` });
check((await state()).finite, 'vehicle state is finite');
await page.click('.hud-menu-btn');
await page.waitForSelector('.menu:not(.hidden)', { timeout: 120000 });
await page.click('[data-action="garage"]');
await page.waitForSelector('.garage', { timeout: 120000 });

// --- Pipelines.
const rt = await page.evaluate(() => window.__debug.gltfRoundTrip('porsche-911-gt3-rs-992'));
const hubOk = rt.frontLeftHub.every((v, i) => Math.abs(v - rt.expectedFrontLeftHub[i]) < 0.005);
check(rt.wheels === 4 && hubOk && rt.steeringWheel && rt.wing && rt.mirrors.length === 3 && rt.dash, `glTF round trip maps the model (${JSON.stringify(rt)})`);
const wavLen = await page.evaluate(async () => (await window.__debug.engineSoundWav('ford-mustang-gt-s650')).length);
check(wavLen > 100000, `offline engine sound render (${Math.round((wavLen * 0.75) / 1024)} KB WAV)`);

check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log(`\nSmoke test passed — screenshots in ${OUT}/`);
