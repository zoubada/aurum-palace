'use strict';
/* ============ Petit bonus « Les Faveurs du Sphinx » ============
   Un tirage instantané et sans risque : 3 urnes canopes cachent chacune un
   trésor (× la mise). Tu en choisis une, elle est payée aussitôt ; les deux
   autres se retournent pour montrer ce que tu as manqué. Pas d'étage, pas de
   piège : c'est le bonus rapide et facile de Pharaon d'Or. */
const SPHINX = (() => {
  const TABLE = [[1, 26], [1.5, 22], [2, 18], [3, 14], [5, 9], [8, 5], [15, 3], [30, 1.4], [50, .6]];
  const r2 = n => Math.round(n * 100) / 100;
  function pickVal(rnd) {
    let t = 0; for (const v of TABLE) t += v[1];
    let x = rnd() * t; for (const v of TABLE) { x -= v[1]; if (x < 0) return v[0]; }
    return TABLE[TABLE.length - 1][0];
  }
  function start(bet, rnd) { return { v: 1, bet, vals: [0, 1, 2].map(() => pickVal(rnd)) }; }
  function choose(st, idx) {
    if (st.picked != null) throw new Error('déjà choisi');
    st.picked = idx;
    return { idx, vals: st.vals, win: r2(st.vals[idx] * st.bet) };
  }
  function simulate(bet, rnd) { const st = start(bet, rnd); return choose(st, Math.floor(rnd() * 3)).win; }
  return { TABLE, start, choose, simulate };
})();
if (typeof module !== 'undefined') module.exports = SPHINX;
