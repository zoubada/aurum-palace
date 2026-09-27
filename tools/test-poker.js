'use strict';
/* Tests du moteur de poker : node tools/test-poker.js */
const P = require('../js/poker-engine.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('ÉCHEC :', m); } };
const R = Math.random;
const deck = () => { const d = [...Array(52).keys()]; for (let i = 51; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; };

/* ---- 1. Évaluateur comparé à une implémentation naïve indépendante ---- */
function naive5(cs) {
  const v = cs.map(c => (c >> 2) + 2).sort((a, b) => b - a), s = cs.map(c => c & 3);
  const flush = s.every(x => x === s[0]); const u = [...new Set(v)];
  let sh = 0; if (u.length === 5 && u[0] - u[4] === 4) sh = u[0]; if (u.join() === '14,5,4,3,2') sh = 5;
  const g = {}; v.forEach(x => g[x] = (g[x] || 0) + 1);
  const gr = Object.entries(g).map(([x, c]) => [c, +x]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const k = gr.map(x => x[1]);
  if (flush && sh) return [8, sh]; if (gr[0][0] === 4) return [7, ...k]; if (gr[0][0] === 3 && gr[1][0] === 2) return [6, ...k];
  if (flush) return [5, ...v]; if (sh) return [4, sh]; if (gr[0][0] === 3) return [3, ...k]; if (gr[0][0] === 2 && gr[1][0] === 2) return [2, ...k];
  if (gr[0][0] === 2) return [1, ...k]; return [0, ...v];
}
const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };
function naive7(cs) { let best = null; for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) { const f = cs.filter((_, i) => i !== a && i !== b); const s = naive5(f); if (!best || cmp(s, best) > 0) best = s; } return best; }
for (let t = 0; t < 60000; t++) {
  const d = deck(), h1 = d.slice(0, 7), h2 = d.slice(7, 14);
  const a = Math.sign(P.evalHand(h1) - P.evalHand(h2)), b = Math.sign(cmp(naive7(h1), naive7(h2)));
  if (a !== b) { ok(false, 'évaluation ' + h1.map(P.cardStr) + ' vs ' + h2.map(P.cardStr)); break; }
  const c1 = P.catOf(P.evalHand(h1)); if (c1 !== naive7(h1)[0]) { ok(false, 'catégorie ' + h1.map(P.cardStr)); break; }
}
const C = (r, s) => ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'].indexOf(r) * 4 + s;
ok(P.handName(P.evalHand([C('A', 0), C('K', 0), C('Q', 0), C('J', 0), C('T', 0), C('2', 1), C('3', 2)])) === 'Quinte flush royale', 'nom quinte flush royale');
ok(P.handName(P.evalHand([C('A', 0), C('2', 1), C('3', 2), C('4', 3), C('5', 0), C('9', 1), C('K', 2)])) === 'Quinte hauteur 5', 'quinte blanche');
ok(P.handName(P.evalHand([C('K', 0), C('K', 1), C('K', 2), C('9', 3), C('9', 0), C('9', 1), C('2', 2)])) === 'Full aux Rois par les 9', 'full double brelan');
ok(P.handName(P.evalHand([C('K', 0), C('J', 1), C('2', 2), C('4', 3), C('7', 0)])) === 'Hauteur Roi', 'hauteur roi');
console.log('1. évaluateur : OK');

/* ---- 2. Positions et blindes ---- */
const players = [{ name: 'Moi', human: true }, { name: 'B1', style: 'tag' }, { name: 'B2', style: 'lag' }];
{
  const T = P.newTournament({ players, button: 0 }); P.startHand(T, deck());
  const H = T.hand;
  ok(H.btn === 0 && H.sbSeat === 1 && H.bbSeat === 2, '3-max : bouton 0, SB 1, BB 2');
  ok(H.toAct === 0, '3-max : le bouton parle en premier préflop');
  ok(T.seats[1].stack === 490 && T.seats[2].stack === 480, 'blindes postées');
  P.act(T, 0, { type: 'call' }); P.act(T, 1, { type: 'call' });
  ok(H.toAct === 2 && P.legal(T, 2).check, 'option de la grosse blinde');
  P.act(T, 2, { type: 'check' });
  ok(H.street === 1 && H.board.length === 3 && H.toAct === 1, 'flop : la SB parle en premier');
}
{
  const T = P.newTournament({ players, button: 1 }); T.seats[2].out = true; T.seats[2].place = 3; T.seats[0].stack = 750; T.seats[1].stack = 750; T.seats[2].stack = 0;
  P.startHand(T, deck()); const H = T.hand;
  ok(H.sbSeat === 1 && H.bbSeat === 0 && H.toAct === 1, 'tête-à-tête : le bouton est petite blinde et parle en premier préflop');
  P.act(T, 1, { type: 'call' }); P.act(T, 0, { type: 'check' });
  ok(H.street === 1 && H.toAct === 0, 'tête-à-tête : la grosse blinde parle en premier après le flop');
}
console.log('2. positions : OK');

/* ---- 3. Relances, relance incomplète, pots secondaires ---- */
{
  const T = P.newTournament({ players, button: 0 }); T.seats[0].stack = 1000; T.seats[1].stack = 150; T.seats[2].stack = 350; T.total = 1500;
  P.startHand(T, deck()); const H = T.hand;
  P.act(T, 0, { type: 'raise', to: 100 });
  let L = P.legal(T, 1); ok(L.minTo === 150 && L.maxTo === 150, 'SB courte : seul le tapis');
  P.act(T, 1, { type: 'raise', to: 150 });
  ok(H.minRaise === 80 && H.curBet === 150, 'relance incomplète : la relance minimale ne change pas');
  L = P.legal(T, 2); ok(L.raise && L.minTo === 230, 'BB (pas encore parlé) peut relancer, min 230');
  P.act(T, 2, { type: 'call' });
  L = P.legal(T, 0); ok(!L.raise && L.call && L.toCall === 50, 'relance incomplète : le relanceur initial ne peut que suivre');
  P.act(T, 0, { type: 'call' });
  ok(H.street === 1, 'flop après la relance incomplète');
}
{ /* pots secondaires : A tapis 100, B tapis 300, C 1000 suit tout */
  let checked = 0;
  for (let k = 0; k < 400; k++) {
    const T = P.newTournament({ players, button: 0 }); T.seats[0].stack = 100; T.seats[1].stack = 300; T.seats[2].stack = 1100; T.total = 1500;
    P.startHand(T, deck()); const H = T.hand;
    P.act(T, 0, { type: 'raise', to: 100 }); P.act(T, 1, { type: 'raise', to: 300 }); P.act(T, 2, { type: 'call' });
    while (!H.done) P.runoutStep(T);
    ok(H.board.length === 5, 'tapis : tableau complet');
    const v = H.result.val; const main = H.result.pots[0], side = H.result.pots[1];
    ok(main.amount === 300 && side.amount === 400, 'montants des pots ' + main.amount + '/' + side.amount);
    ok(T.seats[2].stack >= 800, 'excédent non suivi rendu à C');
    const bestMain = Math.max(v[0], v[1], v[2]), bestSide = Math.max(v[1], v[2]);
    ok(main.winners.every(w => v[w] === bestMain), 'gagnant du pot principal');
    ok(side.winners.every(w => v[w] === bestSide) && !side.winners.includes(0), 'le joueur à tapis ne touche pas le pot secondaire');
    checked++;
  }
  console.log('3. relances et pots secondaires : OK (' + checked + ' tapis)');
}

/* ---- 4. Tournois complets simulés ---- */
function randomAgent(T, seat) {
  const L = P.legal(T, seat), o = [];
  if (L.fold) o.push({ type: 'fold' }); if (L.check) o.push({ type: 'check' }); if (L.call) o.push({ type: 'call' }, { type: 'call' });
  if (L.raise) { o.push({ type: 'raise', to: L.maxTo }); o.push({ type: 'raise', to: L.minTo + Math.floor(R() * (L.maxTo - L.minTo + 1)) }); }
  return o[Math.floor(R() * o.length)];
}
const t0 = Date.now(); let hands = 0, maxHands = 0; const wins = [0, 0, 0]; let byBots = 0;
const N = +process.argv[2] || 3000;
for (let t = 0; t < N; t++) {
  const botsOnly = t % 2 === 0;
  const T = P.newTournament({ players, button: Math.floor(R() * 3), levelMs: 1 });
  let guard = 0;
  while (!T.over) {
    if (++guard > 3000) { ok(false, 'tournoi sans fin'); break; }
    T.level = Math.floor(T.handNo / 8);
    P.startHand(T, deck()); const H = T.hand; hands++;
    let steps = 0;
    while (!H.done) {
      if (++steps > 200) { ok(false, 'main sans fin'); break; }
      if (H.toAct < 0) { P.runoutStep(T); continue; }
      const s = H.toAct;
      const a = (s === 0 && !botsOnly) ? randomAgent(T, s) : P.botDecide(T, s, R);
      try { P.act(T, s, a); } catch (e) { ok(false, 'action illégale du ' + (s === 0 && !botsOnly ? 'hasard' : 'robot') + ' : ' + e.message + ' ' + JSON.stringify(a) + ' ' + JSON.stringify(P.legal(T, s))); H.done = true; T.over = true; }
    }
  }
  const places = T.seats.map(s => s.place).sort();
  ok(places.join() === '1,2,3', 'places attribuées ' + places);
  maxHands = Math.max(maxHands, T.handNo);
  T.seats.forEach((s, i) => { if (s.place === 1) { wins[i]++; if (botsOnly) byBots++; } });
}
console.log(`4. ${N} tournois, ${hands} mains, ${maxHands} mains max, victoires par siège ${wins}, ${(Date.now() - t0)}ms`);
console.log(fails ? `${fails} ÉCHEC(S)` : 'TOUS LES TESTS PASSENT');
process.exit(fails ? 1 : 0);
