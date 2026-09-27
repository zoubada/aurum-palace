'use strict';
/* ============ Moteur de poker Texas Hold'em No Limit (sans DOM) ============
   Cartes : entiers 0..51, rang = c>>2 (0 = 2 … 12 = As), couleur = c&3.
   Toutes les fonctions travaillent sur un objet tournoi T sérialisable en JSON,
   ce qui permet de sauvegarder une partie en cours et de la reprendre. */
const PKE = (() => {
  const RCH = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const SCH = ['♠', '♥', '♦', '♣'];
  const RN = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Valet', 'Dame', 'Roi', 'As'];
  const RNP = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Valets', 'Dames', 'Rois', 'As'];
  const cardStr = c => RCH[c >> 2] + SCH[c & 3];

  /* ---------- Évaluation des mains (5 à 7 cartes) ---------- */
  function straightHigh(m) {
    for (let h = 12; h >= 4; h--) if (((m >> (h - 4)) & 31) === 31) return h;
    return (m & 0x100F) === 0x100F ? 3 : -1;
  }
  const pack = (cat, a) => { let v = cat; for (let i = 0; i < 5; i++) v = v * 16 + (a[i] === undefined ? 0 : a[i] + 1); return v; };
  function top(cnt, ex, n) { const o = []; for (let r = 12; r >= 0 && o.length < n; r--) if (cnt[r] && !ex.includes(r)) o.push(r); return o; }
  function evalHand(cs) {
    const cnt = new Array(13).fill(0), sm = [0, 0, 0, 0], sc = [0, 0, 0, 0]; let m = 0;
    for (const c of cs) { const r = c >> 2, s = c & 3; cnt[r]++; sm[s] |= 1 << r; sc[s]++; m |= 1 << r; }
    let fs = -1; for (let s = 0; s < 4; s++) if (sc[s] >= 5) fs = s;
    if (fs >= 0) { const h = straightHigh(sm[fs]); if (h >= 0) return pack(8, [h]); }
    const q = [], t = [], p = [];
    for (let r = 12; r >= 0; r--) { if (cnt[r] === 4) q.push(r); else if (cnt[r] === 3) t.push(r); else if (cnt[r] === 2) p.push(r); }
    if (q.length) return pack(7, [q[0], ...top(cnt, [q[0]], 1)]);
    if (t.length && (t.length > 1 || p.length)) return pack(6, [t[0], Math.max(t.length > 1 ? t[1] : -1, p.length ? p[0] : -1)]);
    if (fs >= 0) { const o = []; for (let r = 12; r >= 0 && o.length < 5; r--) if (sm[fs] >> r & 1) o.push(r); return pack(5, o); }
    const h = straightHigh(m); if (h >= 0) return pack(4, [h]);
    if (t.length) return pack(3, [t[0], ...top(cnt, [t[0]], 2)]);
    if (p.length >= 2) return pack(2, [p[0], p[1], ...top(cnt, [p[0], p[1]], 1)]);
    if (p.length) return pack(1, [p[0], ...top(cnt, [p[0]], 3)]);
    return pack(0, top(cnt, [], 5));
  }
  const catOf = v => Math.floor(v / 1048576);
  const digit = (v, i) => Math.floor(v / Math.pow(16, 4 - i)) % 16 - 1;
  const de = r => r === 12 ? 'd’As' : 'de ' + RNP[r];
  function handName(v) {
    const c = catOf(v), a = digit(v, 0), b = digit(v, 1);
    switch (c) {
      case 0: return 'Hauteur ' + RN[a];
      case 1: return 'Paire ' + de(a);
      case 2: return 'Double paire ' + RNP[a] + ' et ' + RNP[b];
      case 3: return 'Brelan ' + de(a);
      case 4: return 'Quinte hauteur ' + RN[a];
      case 5: return 'Couleur hauteur ' + RN[a];
      case 6: return 'Full aux ' + RNP[a] + ' par les ' + RNP[b];
      case 7: return 'Carré ' + de(a);
      default: return a === 12 ? 'Quinte flush royale' : 'Quinte flush hauteur ' + RN[a];
    }
  }

  /* ---------- Structure du tournoi ---------- */
  const BLINDS = [[10, 20], [15, 30], [20, 40], [30, 60], [40, 80], [50, 100], [60, 120], [80, 160], [100, 200], [125, 250], [150, 300], [200, 400], [250, 500], [300, 600], [400, 800], [500, 1000]];
  const blindsAt = l => { if (l < BLINDS.length) return BLINDS[l]; const k = Math.pow(2, l - BLINDS.length + 1), b = BLINDS[BLINDS.length - 1]; return [b[0] * k, b[1] * k]; };

  function newTournament({ players, stack = 500, levelMs = 120000, button = 0 }) {
    return { seats: players.map(p => Object.assign({}, p, { stack, out: false, place: 0 })), total: stack * players.length, level: 0, levelMs, levelLeft: levelMs, button: button - 1, firstButton: button, handNo: 0, hand: null, over: false };
  }
  const n = T => T.seats.length;
  const aliveSeats = T => T.seats.map((s, i) => s.out ? -1 : i).filter(i => i >= 0);
  function nextAlive(T, i) { for (let k = 1; k <= n(T); k++) { const j = (i + k) % n(T); if (!T.seats[j].out) return j; } return -1; }

  function startHand(T, deck) {
    if (T.over) throw new Error('tournoi terminé');
    const al = aliveSeats(T);
    T.handNo++;
    T.button = T.handNo === 1 ? T.firstButton : nextAlive(T, T.button);
    if (T.seats[T.button].out) T.button = nextAlive(T, T.button);
    const [sb, bb] = blindsAt(T.level);
    const heads = al.length === 2;
    const sbSeat = heads ? T.button : nextAlive(T, T.button), bbSeat = nextAlive(T, sbSeat);
    const H = { no: T.handNo, deck: deck.slice(), board: [], street: 0, sb, bb, level: T.level, sbSeat, bbSeat, btn: T.button, p: {}, curBet: 0, minRaise: bb, fullRaises: 0, toAct: -1, done: false, result: null, log: [], start: {} };
    for (const i of al) { H.p[i] = { cards: [], bet: 0, contrib: 0, folded: false, allIn: false, acted: false, seen: 0, vol: false, raised: false }; H.start[i] = T.seats[i].stack; }
    for (let r = 0; r < 2; r++) { let s = nextAlive(T, T.button); for (let k = 0; k < al.length; k++) { H.p[s].cards.push(H.deck.pop()); s = nextAlive(T, s); } }
    T.hand = H;
    H.log.push({ t: 'start', sb, bb, btn: T.button });
    post(T, sbSeat, sb, 'sb'); post(T, bbSeat, bb, 'bb');
    H.curBet = bb;
    H.toAct = nextToAct(T, bbSeat);
    if (H.toAct < 0) closeStreet(T);
    return H;
  }
  function post(T, seat, amt, kind) {
    const s = T.seats[seat], p = T.hand.p[seat], a = Math.min(amt, s.stack);
    s.stack -= a; p.bet += a; p.contrib += a; if (s.stack === 0) p.allIn = true;
    T.hand.log.push({ t: kind, seat, a });
  }

  const inHand = H => Object.keys(H.p).map(Number);
  const live = H => inHand(H).filter(i => !H.p[i].folded);
  const canAct = (H, i) => !H.p[i].folded && !H.p[i].allIn;
  function needs(T, i) {
    const H = T.hand, p = H.p[i];
    if (!canAct(H, i)) return false;
    const others = live(H).filter(j => j !== i);
    if (!others.some(j => canAct(H, j))) { const mx = Math.max(0, ...others.map(j => H.p[j].bet)); if (p.bet >= mx) return false; }
    return !p.acted || p.bet < H.curBet;
  }
  function nextToAct(T, from) { for (let k = 1; k <= n(T); k++) { const j = (from + k) % n(T); if (T.hand.p[j] && needs(T, j)) return j; } return -1; }

  function legal(T, seat) {
    const H = T.hand, p = H.p[seat], s = T.seats[seat];
    const toCall = Math.max(0, Math.min(H.curBet - p.bet, s.stack));
    const maxTo = p.bet + s.stack;
    const othersCanAct = live(H).some(j => j !== seat && canAct(H, j));
    const reopened = !p.acted || p.seen < H.fullRaises;
    const canRaise = s.stack > toCall && othersCanAct && reopened;
    let minTo = H.curBet + H.minRaise; if (minTo > maxTo) minTo = maxTo;
    return { fold: toCall > 0, check: toCall === 0, call: toCall > 0, toCall, raise: canRaise, minTo, maxTo, isBet: H.curBet === 0, pot: potTotal(H) };
  }
  const potTotal = H => inHand(H).reduce((a, i) => a + H.p[i].contrib, 0);

  function act(T, seat, a) {
    const H = T.hand;
    if (!H || H.done) throw new Error('aucune main en cours');
    if (seat !== H.toAct) throw new Error('ce n’est pas au tour de ce joueur');
    const L = legal(T, seat), p = H.p[seat], s = T.seats[seat], wasBet = H.curBet === 0;
    if (a.type === 'fold') { if (!L.fold) throw new Error('coucher impossible'); p.folded = true; }
    else if (a.type === 'check') { if (!L.check) throw new Error('parole impossible'); }
    else if (a.type === 'call') { if (!L.call) throw new Error('suivre impossible'); s.stack -= L.toCall; p.bet += L.toCall; p.contrib += L.toCall; if (s.stack === 0) p.allIn = true; if (H.street === 0) p.vol = true; }
    else if (a.type === 'raise') {
      if (!L.raise) throw new Error('relance impossible');
      const to = Math.round(a.to);
      if (!(to === L.maxTo || (to >= L.minTo && to <= L.maxTo))) throw new Error('montant de relance invalide');
      const amt = to - p.bet; s.stack -= amt; p.bet = to; p.contrib += amt; if (s.stack === 0) p.allIn = true;
      const size = to - H.curBet; if (size >= H.minRaise) { H.minRaise = size; H.fullRaises++; }
      if (to > H.curBet) H.curBet = to;
      if (H.street === 0) { p.vol = true; p.raised = true; }
    } else throw new Error('action inconnue');
    p.acted = true; p.seen = H.fullRaises;
    H.log.push({ t: a.type, seat, to: p.bet, allIn: p.allIn, street: H.street, bet: wasBet });
    if (live(H).length === 1) return winByFold(T);
    const nx = nextToAct(T, seat);
    if (nx >= 0) H.toAct = nx; else closeStreet(T);
  }

  function refundUncalled(T) {
    const H = T.hand; const ps = inHand(H).sort((a, b) => H.p[b].bet - H.p[a].bet);
    if (!ps.length) return;
    const top = ps[0], second = ps.length > 1 ? H.p[ps[1]].bet : 0, d = H.p[top].bet - second;
    if (d > 0) { const p = H.p[top]; p.bet -= d; p.contrib -= d; T.seats[top].stack += d; if (T.seats[top].stack > 0) p.allIn = false; H.log.push({ t: 'refund', seat: top, a: d }); }
  }
  function closeStreet(T) {
    const H = T.hand;
    refundUncalled(T);
    for (const i of inHand(H)) { const p = H.p[i]; p.bet = 0; p.acted = false; p.seen = 0; }
    H.curBet = 0; H.minRaise = H.bb; H.fullRaises = 0; H.toAct = -1;
    if (H.street === 3) return showdown(T);
    H.deck.pop();
    const k = H.street === 0 ? 3 : 1; for (let j = 0; j < k; j++) H.board.push(H.deck.pop());
    H.street++;
    H.log.push({ t: 'street', street: H.street, board: H.board.slice() });
    if (live(H).filter(i => canAct(H, i)).length >= 2) H.toAct = nextToAct(T, H.btn);
    else H.runout = true;
  }
  /* Tapis : on déroule le tableau sans enchères, une rue à la fois pour l'affichage */
  function runoutStep(T) { const H = T.hand; if (H && !H.done && H.toAct < 0) closeStreet(T); }

  function winByFold(T) {
    const H = T.hand; refundUncalled(T);
    const w = live(H)[0], amount = potTotal(H);
    T.seats[w].stack += amount;
    H.result = { type: 'fold', pots: [{ amount, winners: [w], shares: { [w]: amount } }], won: { [w]: amount } };
    H.log.push({ t: 'win', seat: w, a: amount });
    return finish(T);
  }
  function showdown(T) {
    const H = T.hand; H.street = 4;
    const L = live(H), val = {};
    for (const i of L) val[i] = evalHand(H.p[i].cards.concat(H.board));
    const all = inHand(H), levels = [...new Set(all.map(i => H.p[i].contrib).filter(x => x > 0))].sort((a, b) => a - b);
    const pots = []; let prev = 0;
    for (const lv of levels) {
      let amount = 0; for (const i of all) amount += Math.max(0, Math.min(H.p[i].contrib, lv) - prev);
      let elig = L.filter(i => H.p[i].contrib >= lv);
      if (!elig.length) elig = L.filter(i => H.p[i].contrib === Math.max(...L.map(j => H.p[j].contrib)));
      const last = pots[pots.length - 1];
      if (last && last.elig.join() === elig.join()) last.amount += amount; else pots.push({ amount, elig });
      prev = lv;
    }
    const won = {};
    const order = []; { let s = nextAlive(T, H.btn); for (let k = 0; k < n(T); k++) { if (H.p[s]) order.push(s); s = (s + 1) % n(T); } }
    for (const pt of pots) {
      const best = Math.max(...pt.elig.map(i => val[i]));
      const winners = order.filter(i => pt.elig.includes(i) && val[i] === best);
      const share = Math.floor(pt.amount / winners.length); let rem = pt.amount - share * winners.length;
      pt.winners = winners; pt.shares = {}; pt.hand = handName(best);
      for (const w of winners) { const a = share + (rem > 0 ? 1 : 0); if (rem > 0) rem--; pt.shares[w] = a; won[w] = (won[w] || 0) + a; T.seats[w].stack += a; }
    }
    H.result = { type: 'sd', pots, won, val };
    for (const [w, a] of Object.entries(won)) H.log.push({ t: 'win', seat: +w, a, hand: handName(val[w]) });
    return finish(T);
  }
  function finish(T) {
    const H = T.hand; H.done = true; H.toAct = -1;
    const busted = inHand(H).filter(i => T.seats[i].stack === 0);
    const remaining = aliveSeats(T).length - busted.length;
    busted.sort((a, b) => H.start[b] - H.start[a]).forEach((i, k) => { T.seats[i].out = true; T.seats[i].place = remaining + 1 + k; });
    H.busted = busted;
    const al = aliveSeats(T);
    if (al.length <= 1) { T.over = true; if (al.length) T.seats[al[0]].place = 1; }
    const sum = T.seats.reduce((a, s) => a + s.stack, 0);
    if (sum !== T.total) throw new Error('jetons non conservés : ' + sum + ' ≠ ' + T.total);
    return H;
  }

  /* ---------- Intelligence des adversaires ---------- */
  function chen(c1, c2) {
    const r1 = c1 >> 2, r2 = c2 >> 2, hi = Math.max(r1, r2), lo = Math.min(r1, r2);
    const pts = r => r === 12 ? 10 : r === 11 ? 8 : r === 10 ? 7 : r === 9 ? 6 : (r + 2) / 2;
    let s = pts(hi);
    if (r1 === r2) return Math.max(5, s * 2);
    if ((c1 & 3) === (c2 & 3)) s += 2;
    const gap = hi - lo - 1;
    s -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
    if (gap <= 1 && hi < 10) s += 1;
    return Math.ceil(s);
  }
  function mkRng(seed) { let x = (seed * 4294967296) >>> 0 || 88675123; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
  function equity(hole, board, nOpp, iters, rng) {
    const known = new Set(hole.concat(board)); const rest = []; for (let c = 0; c < 52; c++) if (!known.has(c)) rest.push(c);
    const need = 5 - board.length; let win = 0;
    for (let it = 0; it < iters; it++) {
      const k = nOpp * 2 + need;
      for (let j = 0; j < k; j++) { const r = j + Math.floor(rng() * (rest.length - j)); const t = rest[j]; rest[j] = rest[r]; rest[r] = t; }
      const b = board.concat(rest.slice(nOpp * 2, k));
      const me = evalHand(hole.concat(b)); let ties = 0, lose = false;
      for (let o = 0; o < nOpp; o++) { const v = evalHand([rest[o * 2], rest[o * 2 + 1]].concat(b)); if (v > me) { lose = true; break; } if (v === me) ties++; }
      if (!lose) win += ties ? 1 / (ties + 1) : 1;
    }
    return win / iters;
  }
  const STYLE = { tag: { loose: 0, aggr: .12, bluff: .12 }, lag: { loose: 1, aggr: .22, bluff: .22 }, rock: { loose: -1, aggr: .06, bluff: .05 } };
  function botDecide(T, seat, rnd) {
    const H = T.hand, L = legal(T, seat), me = H.p[seat], st = STYLE[T.seats[seat].style] || STYLE.tag;
    const rng = mkRng(rnd());
    const opp = live(H).filter(j => j !== seat);
    const stackBB = (T.seats[seat].stack + me.bet) / H.bb;
    const effBB = Math.min(stackBB, Math.max(...opp.map(j => (T.seats[j].stack + H.p[j].bet) / H.bb)));
    const pot = L.pot;
    const shove = () => L.raise ? { type: 'raise', to: L.maxTo } : L.call ? { type: 'call' } : { type: 'check' };
    const passive = () => L.check ? { type: 'check' } : { type: 'fold' };
    const raiseTo = x => { if (!L.raise) return L.call ? { type: 'call' } : { type: 'check' }; const u = H.bb >= 20 ? 5 : 1; let to = Math.round(x / u) * u; if (to >= L.maxTo * .8) to = L.maxTo; to = Math.max(L.minTo, Math.min(L.maxTo, to)); return { type: 'raise', to }; };
    if (H.street === 0) {
      const c = chen(me.cards[0], me.cards[1]) + st.loose + (rng() < .1 ? 1 : 0);
      const behind = opp.filter(j => !H.p[j].acted || H.p[j].bet < H.curBet).length;
      const facingRaise = H.curBet > H.bb;
      if (!facingRaise) {
        if (effBB <= 11) {
          const thr = (effBB <= 4 ? 3 : effBB <= 7 ? 5 : 6) + (behind >= 2 ? 1 : 0);
          if (c >= thr) return shove();
          return passive();
        }
        const thr = (behind >= 2 ? 7 : 5);
        if (c >= thr) return raiseTo(H.bb * (2 + rng() * .5) + (me.bet >= H.bb ? H.bb : 0));
        if (L.check) return { type: 'check' };
        if (seat === H.sbSeat && c >= 4 && behind === 1 && rng() < .35) return { type: 'call' };
        return { type: 'fold' };
      }
      const odds = L.toCall / (pot + L.toCall);
      const bigBet = L.toCall >= T.seats[seat].stack * .4 || H.curBet >= (T.seats[seat].stack + me.bet) * .5;
      const raiserShort = opp.some(j => H.p[j].allIn && H.p[j].contrib / H.bb <= 8);
      if (bigBet) { const thr = 4 + odds * 10 - (raiserShort ? 1 : 0); return c >= thr ? (c >= 10 ? shove() : { type: 'call' }) : { type: 'fold' }; }
      if (c >= 10) return effBB <= 20 ? shove() : raiseTo(H.curBet * 3);
      if (c >= 7 || (seat === H.bbSeat && c >= 5 && odds < .3)) return { type: 'call' };
      return { type: 'fold' };
    }
    const e0 = equity(me.cards, H.board, opp.length, 350, rng);
    const e = L.toCall > pot * .9 ? e0 * .9 : e0;
    const spr = T.seats[seat].stack / Math.max(1, pot);
    if (L.check) {
      if (e >= .62) return spr < 1.2 ? shove() : raiseTo(pot * (.5 + rng() * .3));
      if (e < .38 && opp.length === 1 && rng() < st.bluff) return raiseTo(pot * .55);
      if (e >= .5 && rng() < st.aggr) return raiseTo(pot * .5);
      return { type: 'check' };
    }
    const odds = L.toCall / (pot + L.toCall);
    if (e >= .78) return spr < 2 ? shove() : raiseTo(H.curBet * (2.5 + rng() * .5));
    if (e >= odds + .04) return { type: 'call' };
    if (L.toCall <= pot * .25 && rng() < .08) return { type: 'call' };
    return { type: 'fold' };
  }

  return { cardStr, RCH, SCH, evalHand, handName, catOf, blindsAt, BLINDS, newTournament, startHand, legal, act, runoutStep, aliveSeats, nextAlive, potTotal, botDecide, chen, equity, mkRng, live };
})();
if (typeof module !== 'undefined') module.exports = PKE;
