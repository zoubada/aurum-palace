'use strict';
/* Simulation du RTP de Pharaon d'Or (jeu de base + tours gratuits + bonus Pyramide).
   Usage : node tools/sim-pharaon.js [nombre de tours]   — le jackpot progressif est exclu. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Object, Array, Set, Map, JSON, Promise };
ctx.reg = () => {}; ctx.ic = () => ''; ctx.esc = s => s; ctx.fmt = x => String(x);
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/games/slots.js'), 'utf8') + ';this.SYMS=SYMS_PHARAON;this.LINES=LINES20;this.evalLine=evalLine;', ctx);
const PYR = require('../js/pyramid-bonus.js');

const SYMS = ctx.SYMS, LINES = ctx.LINES, evalLine = ctx.evalLine;
const payMap = Object.fromEntries(SYMS.filter(s => s.p).map(s => [s.k, s.p]));
const scatterPay = { 3: 2, 4: 10, 5: 49 };
const tot = SYMS.reduce((a, s) => a + s.w, 0);
const R = Math.random;
const pick = () => { let r = R() * tot; for (const s of SYMS) { r -= s.w; if (r < 0) return s; } return SYMS[SYMS.length - 1]; };

function spin(betUnit, stats) {
  const grid = []; for (let c = 0; c < 5; c++) { const col = []; for (let r = 0; r < 3; r++) col.push(pick()); grid.push(col); }
  let win = 0;
  for (const ln of LINES) { const res = evalLine(ln.map((row, c) => grid[c][row].k), payMap, 'W', 'S'); if (res.amt > 0) win += res.amt * betUnit / LINES.length; }
  const flat = grid.flat();
  const sc = flat.filter(s => s.k === 'S').length, pb = flat.filter(s => s.k === 'P').length;
  if (sc >= 3) win += (scatterPay[sc] || scatterPay[5]) * betUnit;
  let bonus = 0;
  if (pb >= 3) { stats.bonus++; bonus = PYR.simulate(betUnit, R, pb, stats); }
  return { win, bonus, sc };
}

const N = +process.argv[2] || 2e6;
const stats = { bonus: 0, levels: 0, summit: 0, picks: 0, bonusWin: 0, maxBonus: 0 };
let bet = 0, won = 0, base = 0, fsWon = 0, bonusWon = 0, fsTrig = 0;
for (let i = 0; i < N; i++) {
  bet += 1;
  const r = spin(1, stats);
  base += r.win; bonusWon += r.bonus; won += r.win + r.bonus;
  if (r.sc >= 3) {
    fsTrig++;
    let left = 10;
    while (left > 0) { left--; const f = spin(1, stats); fsWon += f.win + f.bonus; bonusWon += f.bonus; won += f.win + f.bonus; if (f.sc >= 3) left += 5; }
  }
}
const pct = x => (x / bet * 100).toFixed(2) + ' %';
console.log(`${N} tours · RTP total ${pct(won)} · base ${pct(base)} · tours gratuits ${pct(fsWon)} (dont bonus) · bonus Pyramide ${pct(bonusWon)}`);
console.log(`Tours gratuits : 1 / ${Math.round(N / Math.max(1, fsTrig))} · Bonus : 1 / ${Math.round(N / Math.max(1, stats.bonus))} tours`);
if (stats.bonus) console.log(`Bonus moyen ${(stats.bonusWin / stats.bonus).toFixed(1)}× la mise · choix moyens ${(stats.picks / stats.bonus).toFixed(1)} · étage moyen ${(stats.levels / stats.bonus).toFixed(1)} · sommet atteint ${(stats.summit / stats.bonus * 100).toFixed(1)} % · max ${stats.maxBonus.toFixed(0)}×`);
