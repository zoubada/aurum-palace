/**
 * Browser smoke test: loads the built game, drives it, switches every camera,
 * opens the menu, and fails on any console error or physics anomaly.
 *
 *   npm run build && npm run preview   (in another terminal)
 *   npm run smoke [-- <url> <screenshot-dir> <quality>]
 *
 * Waits are in *simulated* time (Game.simTime) so the test is meaningful even on
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
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });

const waitSim = async (s) => {
  const start = await page.evaluate(() => window.__game.simTime);
  await page.waitForFunction((t) => window.__game.simTime >= t, start + s, { timeout: 900000, polling: 50 });
};
const state = () =>
  page.evaluate(() => {
    const v = window.__game.vehicle;
    return { kmh: v.speedKmh, gear: v.gear, x: v.x, z: v.z, finite: [v.x, v.z, v.u, v.v, v.r].every(Number.isFinite) };
  });

await waitSim(0.5);
const s0 = await state();
check(s0.kmh < 8, `car starts (almost) still: ${s0.kmh.toFixed(1)} km/h`);
await page.screenshot({ path: `${OUT}/01-start.png` });

await page.keyboard.down('ArrowUp');
await waitSim(4);
const s1 = await state();
check(s1.kmh > 85, `accelerates: ${s1.kmh.toFixed(1)} km/h after 4 s, gear ${s1.gear}`);
await page.screenshot({ path: `${OUT}/02-accelerating.png` });

for (const [i, mode] of ['far', 'cockpit', 'hood', 'bumper', 'chase'].entries()) {
  await page.evaluate((m) => window.__game.rig.setMode(m), mode);
  await waitSim(0.25);
  await page.screenshot({ path: `${OUT}/03-camera-${i}-${mode}.png` });
}
await page.keyboard.up('ArrowUp');

await page.keyboard.down('ArrowDown');
await waitSim(0.4); // pedal ramp + throttle release
const b0 = await state();
const t0 = await page.evaluate(() => window.__game.simTime);
await waitSim(1.5);
const b1 = await state();
const t1 = await page.evaluate(() => window.__game.simTime);
await page.keyboard.up('ArrowDown');
const decelG = ((b0.kmh - b1.kmh) / 3.6 / (t1 - t0)) / 9.81;
check(decelG > 0.9, `brakes: ${b0.kmh.toFixed(0)} → ${b1.kmh.toFixed(0)} km/h, ${decelG.toFixed(2)} g average`);

await page.keyboard.press('Escape');
await page.waitForSelector('.menu:not(.hidden)', { timeout: 120000 });
await page.screenshot({ path: `${OUT}/04-menu.png` });
await page.click('button[data-preset="simulation"]');
const assists = await page.evaluate(() => window.__game.vehicle.assists);
check(!assists.abs && !assists.tc && !assists.autoGear, 'menu applies the Simulation preset');
await page.click('button[data-action="resume"]');

const s3 = await state();
check(s3.finite, 'vehicle state is finite');
check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log(`\nSmoke test passed — screenshots in ${OUT}/`);
