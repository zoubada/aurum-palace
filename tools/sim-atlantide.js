'use strict';
/* Fiche PAR d'Atlantide : simulation du moteur réel (js/atlantide-engine.js).
   Usage : node tools/sim-atlantide.js [tours=4e6] [sessions de bonus=200000]
   - Partie 1 : espérance de chaque bonus mesurée isolément (beaucoup de sessions,
     donc peu de bruit) : tours gratuits par mode et par nombre de conques,
     Trésor des Abysses (départ naturel et départ acheté), Expédition.
   - Partie 2 : jeu de base complet ; chaque déclenchement de bonus est
     valorisé par sa propre session simulée (moyenne des 3 modes pour les tours
     gratuits, puisque le joueur choisit et que les 3 sont réglés à espérance égale).
   Le RTP total et son intervalle de confiance sont donnés à la fin. */
const ATL = require('../js/atlantide-engine.js');
const R = Math.random;
const N = +process.argv[2] || 4e6;
const NF = +process.argv[3] || 200000;
const pct = x => (x * 100).toFixed(2) + ' %';
const t0 = Date.now();

/* ---------- 1. Espérance des bonus ---------- */
function fsSession(mode, scat) { const st = ATL.fsStart(mode, scat); while (st.left > 0) ATL.fsSpin(st, R, false); return st; }
const scatDist = {}; let scatN = 0;
{ // distribution naturelle du nombre de conques au déclenchement
  for (let i = 0; i < 3e6 && scatN < 20000; i++) { const r = ATL.spin({ mode: 'base' }, R, false); if (r.fsTrig) { scatDist[r.fsTrig] = (scatDist[r.fsTrig] || 0) + 1; scatN++; } }
}
const fsEV = {};
for (const mode of ['A', 'B', 'C']) {
  let tot = 0, sq = 0, n = 0, spins = 0, best = 0;
  for (const s in scatDist) {
    const k = Math.round(NF * scatDist[s] / scatN);
    for (let i = 0; i < k; i++) { const st = fsSession(mode, +s); tot += st.total; sq += st.total * st.total; n++; spins += st.played; best = Math.max(best, st.total); }
  }
  const m = tot / n; fsEV[mode] = { ev: m, sd: Math.sqrt(sq / n - m * m), spins: spins / n, best };
}
let fsBuy = 0; { let n = 0; for (let i = 0; i < NF; i++) { const md = ['A', 'B', 'C'][i % 3]; fsBuy += fsSession(md, ATL.buyFsScat(R)).total; n++; } fsBuy /= n; }

function hsSession(pearls) { const st = ATL.hsStart(pearls); while (!st.done) ATL.hsStep(st, R); return { st, t: ATL.hsTotal(st) }; }
let hsNat = 0, hsNatN = 0, hsBest = 0, hsFull = 0, hsCount = 0; const hsJp = {};
for (let i = 0; i < 6e6 && hsNatN < NF / 4; i++) {
  const r = ATL.spin({ mode: 'base' }, R, false);
  if (r.hsTrig) { const { st, t } = hsSession(r.pearls); hsNat += t.total; hsNatN++; hsBest = Math.max(hsBest, t.total); hsCount += t.count; if (st.full) hsFull++; for (const j of t.jps) hsJp[j] = (hsJp[j] || 0) + 1; }
}
hsNat /= hsNatN;
let hsBuy = 0; for (let i = 0; i < NF; i++) hsBuy += hsSession(ATL.buyHsPearls(R)).t.total; hsBuy /= NF;

let expEV = 0, expGate = 0, expBest = 0; const expJp = {};
for (let i = 0; i < NF; i++) {
  const st = ATL.expStart();
  while (!st.done) { if (st.pending) ATL.expPick(st, Math.floor(R() * 3)); else ATL.expRoll(st, R); }
  const t = ATL.expTotal(st); expEV += t; expBest = Math.max(expBest, t); if (st.gate) { expGate++; expJp[st.jp] = (expJp[st.jp] || 0) + 1; }
}
expEV /= NF;

/* ---------- 2. Jeu de base ---------- */
let bet = 0, line = 0, scatW = 0, fsW = 0, hsW = 0, expW = 0, hits = 0, kr = 0, fsT = 0, hsT = 0, expT = 0, frags = 0, sq = 0, maxSpin = 0;
const casc = new Array(12).fill(0);
const fsAvg = (fsEV.A.ev + fsEV.B.ev + fsEV.C.ev) / 3;
for (let i = 0; i < N; i++) {
  bet++;
  const r = ATL.spin({ mode: 'base' }, R, false);
  let ret = r.total;
  line += Math.min(r.total, r.lineWin); scatW += r.total - Math.min(r.total, r.lineWin);
  if (r.total > 0) hits++;
  if (r.kraken) kr++;
  casc[Math.min(11, r.cascades)]++;
  if (r.fsTrig) { fsT++; const md = ['A', 'B', 'C'][i % 3]; const v = fsSession(md, r.fsTrig).total; fsW += v; ret += v; }
  if (r.hsTrig) { hsT++; const v = hsSession(r.pearls).t.total; hsW += v; ret += v; }
  if (r.frags) { frags += r.frags; while (frags >= ATL.P.frag.need) { frags -= ATL.P.frag.need; expT++; const st = ATL.expStart(); while (!st.done) { if (st.pending) ATL.expPick(st, Math.floor(R() * 3)); else ATL.expRoll(st, R); } const v = ATL.expTotal(st); expW += v; ret += v; } }
  sq += ret * ret; maxSpin = Math.max(maxSpin, ret);
}
const won = line + scatW + fsW + hsW + expW, rtp = won / bet, sd = Math.sqrt(sq / bet - rtp * rtp);
/* RTP « analytique » : base simulée + fréquences × espérances isolées (bien moins bruité) */
const rtpA = (line + scatW) / bet + (fsT / bet) * fsAvg + (hsT / bet) * hsNat + (expT / bet) * expEV;

const f1 = x => x.toFixed(1), f2 = x => x.toFixed(2);
console.log(`\n=== ATLANTIDE — fiche PAR (${(N / 1e6).toFixed(1)} M tours, ${((Date.now() - t0) / 1000).toFixed(0)} s) ===`);
console.log(`RTP total simulé   : ${pct(rtp)}  (± ${pct(1.96 * sd / Math.sqrt(bet))} à 95 %)`);
console.log(`RTP recomposé      : ${pct(rtpA)}  (base simulée + fréquences × espérances des bonus)`);
console.log(`  gains en voies   : ${pct(line / bet)}   (fréquence de gain ${pct(hits / bet)})`);
console.log(`  conques          : ${pct(scatW / bet)}`);
console.log(`  tours gratuits   : ${pct((fsT / bet) * fsAvg)}  1 / ${Math.round(bet / fsT)} tours`);
console.log(`  Trésor (perles)  : ${pct((hsT / bet) * hsNat)}  1 / ${Math.round(bet / hsT)} tours`);
console.log(`  Expédition       : ${pct((expT / bet) * expEV)}  1 / ${Math.round(bet / expT)} tours`);
console.log(`Kraken : 1 / ${Math.round(bet / kr)} tours · écart-type ${f1(sd)} · gain max observé ${f1(maxSpin)}×`);
console.log(`Cascades par tour : ${casc.map((x, i) => i + ':' + (x / bet * 100).toFixed(i < 3 ? 1 : 3) + '%').join(' ')}`);
console.log(`\nConques au déclenchement : ${Object.entries(scatDist).map(([k, v]) => k + '→' + (v / scatN * 100).toFixed(1) + '%').join(' ')}`);
for (const m of ['A', 'B', 'C']) console.log(`Tours gratuits ${m} : espérance ${f1(fsEV[m].ev)}× · écart-type ${f1(fsEV[m].sd)} · ${f1(fsEV[m].spins)} tours joués · max ${f1(fsEV[m].best)}×`);
console.log(`Trésor des Abysses : espérance ${f1(hsNat)}× (départ naturel) · ${f1(hsBuy)}× (achat, 6 perles) · ${f1(hsCount / hsNatN)} perles en moyenne · grille pleine 1 / ${hsFull ? Math.round(hsNatN / hsFull) : '∞'} · max ${f1(hsBest)}×`);
console.log(`  jackpots par Trésor : ${Object.entries(hsJp).map(([k, v]) => k + ' ' + (v / hsNatN * 100).toFixed(2) + '%').join(' · ')}`);
console.log(`Expédition : espérance ${f1(expEV)}× la mise moyenne · Porte atteinte ${pct(expGate / NF)} · max ${f1(expBest)}× · jackpots ${Object.entries(expJp).map(([k, v]) => k + ' ' + (v / NF * 100).toFixed(2) + '%').join(' ')}`);
console.log(`\nAchat : tours gratuits espérance ${f2(fsBuy)}× → prix à 96 % = ${f1(fsBuy / .96)}× (prix actuel ${ATL.BUY.fs}× → RTP ${pct(fsBuy / ATL.BUY.fs)})`);
console.log(`        Trésor espérance ${f2(hsBuy)}× → prix à 96 % = ${f1(hsBuy / .96)}× (prix actuel ${ATL.BUY.hs}× → RTP ${pct(hsBuy / ATL.BUY.hs)})`);
