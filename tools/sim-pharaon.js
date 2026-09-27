'use strict';
/* Simulation du RTP de Pharaon d'Or (jeu de base + tours gratuits + bonus Pyramide
   + les 3 palmiers sacrés). Usage : node tools/sim-pharaon.js [nombre de tours]
   — le jackpot progressif est exclu (il est à somme non nulle, financé par son
   propre compteur, indépendant de la mise). Les constantes scatterPay/TREES ci-dessous
   dupliquent volontairement celles de js/games/slots.js (reg 'pharaon') : les tenir
   synchronisées si l'une des deux change. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Object, Array, Set, Map, JSON, Promise };
ctx.reg = () => {}; ctx.ic = () => ''; ctx.esc = s => s; ctx.fmt = x => String(x);
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/games/slots.js'), 'utf8') + ';this.SYMS=SYMS_PHARAON;this.LINES=LINES20;this.evalLine=evalLine;', ctx);
const PYR = require('../js/pyramid-bonus.js');
const SPHINX = require('../js/sphinx-bonus.js');

const SYMS = ctx.SYMS, LINES = ctx.LINES, evalLine = ctx.evalLine;
const payMap = Object.fromEntries(SYMS.filter(s => s.p).map(s => [s.k, s.p]));
const scatterPay = { 3: 2, 4: 10, 5: 49 };
const TREES = {
  jp: { sym: 'CG', cap: 40, base: .035, inc: .006 },
  bonus: { sym: 'CB', cap: 30, base: .045, inc: .008 },
  mini: { sym: 'CR', cap: 10, base: .1, inc: .02 },
};
const tot = SYMS.reduce((a, s) => a + s.w, 0);
const R = Math.random;
const pick = () => { let r = R() * tot; for (const s of SYMS) { r -= s.w; if (r < 0) return s; } return SYMS[SYMS.length - 1]; };

const trees = { jp: 0, bonus: 0, mini: 0 };
function spin(betUnit, stats) {
  const grid = []; for (let c = 0; c < 5; c++) { const col = []; for (let r = 0; r < 3; r++) col.push(pick()); grid.push(col); }
  let win = 0;
  for (const ln of LINES) { const res = evalLine(ln.map((row, c) => grid[c][row].k), payMap, 'W', 'S'); if (res.amt > 0) win += res.amt * betUnit / LINES.length; }
  const flat = grid.flat();
  const sc = flat.filter(s => s.k === 'S').length, pb = flat.filter(s => s.k === 'P').length;
  if (sc >= 3) win += (scatterPay[sc] || scatterPay[5]) * betUnit;
  let bonus = 0, treeJp = 0, treeBonus = 0, treeMini = 0;
  if (pb >= 3) { stats.bonus++; bonus = PYR.simulate(betUnit, R, pb, stats); }
  for (const t in TREES) {
    const tc = TREES[t], n = flat.filter(s => s.k === tc.sym).length;
    if (n <= 0) continue;
    trees[t] = Math.min(tc.cap, trees[t] + n);
    const chance = trees[t] >= tc.cap ? 1 : Math.min(1, tc.base + (trees[t] - 1) * tc.inc);
    if (R() < chance) {
      trees[t] = 0;
      if (t === 'jp') { stats.treeJp++; treeJp = 1; /* valeur variable, exclue du RTP */ }
      else if (t === 'bonus') { stats.treeBonus++; treeBonus = PYR.simulate(betUnit, R, 5, stats); }
      else { stats.treeMini++; treeMini = SPHINX.simulate(betUnit, R); }
    }
  }
  return { win, bonus: bonus + treeBonus, mini: treeMini, sc, treeJp };
}

const N = +process.argv[2] || 2e6;
const stats = { bonus: 0, levels: 0, summit: 0, picks: 0, bonusWin: 0, maxBonus: 0, treeJp: 0, treeBonus: 0, treeMini: 0 };
let bet = 0, won = 0, base = 0, fsWon = 0, bonusWon = 0, miniWon = 0, fsTrig = 0, jpTrig = 0;
for (let i = 0; i < N; i++) {
  bet += 1;
  const r = spin(1, stats);
  base += r.win; bonusWon += r.bonus; miniWon += r.mini; won += r.win + r.bonus + r.mini; jpTrig += r.treeJp;
  if (r.sc >= 3) {
    fsTrig++;
    let left = 10;
    while (left > 0) {
      left--; const f = spin(1, stats);
      fsWon += f.win + f.bonus + f.mini; bonusWon += f.bonus; miniWon += f.mini; won += f.win + f.bonus + f.mini; jpTrig += f.treeJp;
      if (f.sc >= 3) left += 5;
    }
  }
}
const pct = x => (x / bet * 100).toFixed(2) + ' %';
console.log(`${N} tours · RTP total ${pct(won)} · base ${pct(base)} · tours gratuits ${pct(fsWon)} (dont bonus/palmiers) · bonus Pyramide (P + palmier) ${pct(bonusWon)} · petit bonus Sphinx ${pct(miniWon)}`);
console.log(`Tours gratuits : 1 / ${Math.round(N / Math.max(1, fsTrig))} · Bonus Pyramide : 1 / ${Math.round(N / Math.max(1, stats.bonus))} tours (dont palmier de lapis 1 / ${Math.round(N / Math.max(1, stats.treeBonus))})`);
console.log(`Petit bonus Sphinx (palmier de rubis) : 1 / ${Math.round(N / Math.max(1, stats.treeMini))} tours · Palmier d'or (Jackpot Aurum, hors RTP) : 1 / ${Math.round(N / Math.max(1, jpTrig))} tours`);
const bonusRuns = stats.bonus + stats.treeBonus;
if (bonusRuns) console.log(`Bonus moyen (P + palmier confondus) ${(stats.bonusWin / bonusRuns).toFixed(1)}× la mise · choix moyens ${(stats.picks / bonusRuns).toFixed(1)} · étage moyen ${(stats.levels / bonusRuns).toFixed(1)} · sommet atteint ${(stats.summit / bonusRuns * 100).toFixed(1)} % · max ${stats.maxBonus.toFixed(0)}×`);
if (stats.treeMini) console.log(`Petit bonus Sphinx moyen ${(miniWon / stats.treeMini).toFixed(2)}× la mise`);
