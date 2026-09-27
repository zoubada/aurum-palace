'use strict';
/* ============ Bonus « La Marche du Pharaon » (moteur sans DOM) ============
   Déclenché par 3, 4 ou 5 symboles Pyramide : autant de torches au départ.
   12 étages de 3 portes. À chaque étage, une porte cache un piège (deux sur
   les trois derniers étages) : une torche perdue, on reste sur place. Les autres
   cachent un trésor (× la mise) ou, parfois, une torche en plus ; les deux font
   monter d'un étage.
   Au sommet, la Chambre du Trésor : 3 sarcophages cachent ×2, ×3 et ×5,
   appliqués au trésor accumulé. Plus de torche : la montée s'arrête et le
   trésor accumulé est gagné, avec un minimum garanti de ×5 la mise.
   Le contenu des portes d'un étage est tiré au hasard dès l'arrivée sur
   l'étage, avant le choix du joueur, puis conservé dans l'état (reprise
   après rechargement possible). */
const PYR = (() => {
  const LEVELS = 12, MAX_T = 5, TORCH_P = 0.1;
  const TRAPS = [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2];
  const BASE = [0.45, 0.55, 0.7, 0.9, 1.1, 1.4, 1.65, 2.3, 2.75, 3.4, 4.6, 5.5];
  const VAR = [[0.5, 3], [1, 4], [1.5, 2], [2, 1], [4, 0.3]];
  const SUMMIT = [2, 3, 5], MIN_WIN = 5;
  const r2 = n => Math.round(n * 100) / 100;

  function pickVar(rnd) {
    let t = 0; for (const v of VAR) t += v[1];
    let x = rnd() * t; for (const v of VAR) { x -= v[1]; if (x < 0) return v[0]; }
    return VAR[VAR.length - 1][0];
  }
  function rollDoors(level, torches, rnd) {
    const safe = TRAPS[level] === 2 ? Math.floor(rnd() * 3) : -1, trap = safe < 0 ? Math.floor(rnd() * 3) : -1;
    return [0, 1, 2].map(i => {
      if (i === trap || (safe >= 0 && i !== safe)) return { t: 'trap' };
      if (torches < MAX_T && rnd() < TORCH_P) return { t: 'torch' };
      return { t: 'prize', v: r2(BASE[level] * pickVar(rnd)) };
    });
  }
  function rollSummit(rnd) {
    const a = SUMMIT.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.map(v => ({ t: 'mult', v }));
  }
  function start(bet, count, rnd) {
    const torches = Math.min(MAX_T, Math.max(3, count));
    return { v: 1, bet, count, phase: 'climb', level: 0, torches, total: 0, mult: 1, picks: 0, doors: rollDoors(0, torches, rnd) };
  }
  /* Ouvre la porte idx ; renvoie ce qu'il y avait derrière les 3 portes et l'état mis à jour. */
  function choose(st, idx, rnd) {
    if (st.phase !== 'climb' && st.phase !== 'summit') throw new Error('bonus terminé');
    if (!(idx >= 0 && idx < 3)) throw new Error('porte invalide');
    const doors = st.doors, d = doors[idx];
    st.picks++;
    if (st.phase === 'summit') {
      st.mult = d.v; st.phase = 'done'; st.doors = null;
      return { idx, doors, item: d, level: LEVELS };
    }
    const level = st.level;
    if (d.t === 'trap') st.torches--;
    else { if (d.t === 'torch') st.torches = Math.min(MAX_T, st.torches + 1); else st.total = r2(st.total + d.v); st.level++; }
    if (st.torches <= 0) { st.phase = 'done'; st.doors = null; }
    else if (st.level >= LEVELS) { st.phase = 'summit'; st.doors = rollSummit(rnd); }
    else st.doors = rollDoors(st.level, st.torches, rnd);
    return { idx, doors, item: d, level };
  }
  /* Gain final : trésor × multiplicateur du sommet, avec un minimum garanti de ×5 la mise. */
  const winOf = st => r2(Math.max(st.total * st.mult, MIN_WIN) * st.bet);
  const prizeRange = level => [r2(BASE[level] * VAR[0][0]), r2(BASE[level] * VAR[VAR.length - 1][0])];

  function simulate(bet, rnd, count, stats) {
    const st = start(bet, count, rnd);
    while (st.phase !== 'done') choose(st, Math.floor(rnd() * 3), rnd);
    const w = winOf(st);
    if (stats) {
      stats.picks += st.picks; stats.levels += st.level; stats.bonusWin += w / bet;
      if (st.mult > 1) stats.summit++;
      stats.maxBonus = Math.max(stats.maxBonus, w / bet);
    }
    return w;
  }
  return { LEVELS, MAX_T, SUMMIT, MIN_WIN, BASE, TRAPS, start, choose, winOf, prizeRange, simulate };
})();
if (typeof module !== 'undefined') module.exports = PYR;
