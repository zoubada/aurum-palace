'use strict';
/* ============ Atlantide — moteur mathématique (sans DOM) ============
   Tout le résultat d'un tour est calculé ici AVANT la moindre animation :
   grilles successives (avec identifiants de symboles pour que l'interface
   puisse suivre chaque pièce qui tombe), gains, cascades, multiplicateurs,
   déclencheurs. L'interface ne fait que rejouer ce script.
   Le même fichier tourne dans tools/sim-atlantide.js pour calculer le RTP
   sur des dizaines de millions de tours : ce que le simulateur mesure est
   exactement ce que le joueur joue.
   Unité : tous les montants sont des multiples de la MISE TOTALE du tour. */
const ATL = (() => {
  const COLS = 6, ROWS = 5, NC = COLS * ROWS;
  const MAXWIN = 10000;                       // plafond par tour / par bonus (× la mise)

  /* ---------- Symboles ---------- */
  const PAY_SYMS = ['PO', 'SI', 'HI', 'TU', 'NA', 'RU', 'SA', 'EM', 'AM', 'TP', 'AQ'];
  const NAMES = {
    PO: 'Poséidon', SI: 'Sirène', HI: 'Hippocampe', TU: 'Tortue ancestrale', NA: 'Nautile',
    RU: 'Rubis', SA: 'Saphir', EM: 'Émeraude', AM: 'Améthyste', TP: 'Topaze', AQ: 'Aigue-marine',
    W: 'Trident', S: 'Conque', PE: 'Perle', FR: 'Fragment de carte'
  };
  /* Gains par VOIE, en × la mise totale (3 à 6 rouleaux consécutifs depuis la gauche). */
  const PAY = {
    PO: { 3: 0.0679, 4: 0.2037, 5: 0.5433, 6: 1.3583 },
    SI: { 3: 0.0544, 4: 0.163, 5: 0.4075, 6: 1.0187 },
    HI: { 3: 0.0408, 4: 0.1223, 5: 0.2988, 6: 0.6791 },
    TU: { 3: 0.034, 4: 0.095, 5: 0.2445, 6: 0.5433 },
    NA: { 3: 0.0271, 4: 0.0815, 5: 0.2037, 6: 0.4346 },
    RU: { 3: 0.0136, 4: 0.034, 5: 0.0679, 6: 0.163 },
    SA: { 3: 0.0136, 4: 0.034, 5: 0.0679, 6: 0.163 },
    EM: { 3: 0.0107, 4: 0.0271, 5: 0.0544, 6: 0.1358 },
    AM: { 3: 0.0107, 4: 0.0271, 5: 0.0544, 6: 0.1358 },
    TP: { 3: 0.0077, 4: 0.0204, 5: 0.0408, 6: 0.1087 },
    AQ: { 3: 0.0077, 4: 0.0204, 5: 0.0408, 6: 0.1087 },
  };
  const LADDER = [1, 2, 3, 5, 8, 12];           // marée : multiplicateur par cascade successive
  const SCAT_PAY = { 3: 2, 4: 5, 5: 20, 6: 100 };
  const JP = { MINI: 20, MINEUR: 50, MAJEUR: 250, GRAND: 2000 };
  const JP_ORDER = ['GRAND', 'MAJEUR', 'MINEUR', 'MINI'];

  /* ---------- Paramètres réglés au simulateur ---------- */
  const P = {
    w: {
      base: { PO: 3, SI: 3.5, HI: 4, TU: 4.5, NA: 5, RU: 6.5, SA: 6.5, EM: 7, AM: 7, TP: 7.5, AQ: 7.5, W: 1.0, S: .65, PE: 3.08, FR: .14 },
      A: { PO: 3, SI: 3.5, HI: 4, TU: 4.5, NA: 5, RU: 6.5, SA: 6.5, EM: 7, AM: 7, TP: 7.5, AQ: 7.5, W: 2.4, S: .6, PE: 0, FR: 0 },
      B: { PO: 3, SI: 3.5, HI: 4, TU: 4.5, NA: 5, RU: 6.5, SA: 6.5, EM: 7, AM: 7, TP: 7.5, AQ: 7.5, W: 1.25, S: .6, PE: 0, FR: 0 },
      C: { PO: 3, SI: 3.5, HI: 4, TU: 4.5, NA: 5, RU: 6.5, SA: 6.5, EM: 7, AM: 7, TP: 7.5, AQ: 7.5, W: .8, S: .6, PE: 0, FR: 0 },
    },
    /* Le 1er rouleau porte moins de petites gemmes : moins de combinaisons minuscules,
       des gains plus nets quand ils tombent. */
    first: { RU: 4.5, SA: 4.5, EM: 5, AM: 5, TP: 5.5, AQ: 5.5 },
    wildM: {
      base: [[1, 88], [2, 9], [3, 3]],
      A: [[1, 80], [2, 15], [3, 5]],
      B: [[1, 50], [2, 30], [3, 15], [5, 5]],
      C: [[1, 75], [2, 18], [3, 7]],
    },
    kraken: { p: 1 / 55, n: [[3, 40], [4, 30], [5, 20], [6, 10]], m: [[1, 55], [2, 30], [3, 15]] },
    krakenC: { n: [[2, 35], [3, 40], [4, 25]], m: [[1, 36], [2, 36], [3, 21], [5, 7]] },
    fs: {
      A: { spins: 11, retrig: 5, tide0: 2, inc: 1, tideCap: 50 },
      B: { spins: 8, retrig: 4 },
      C: { spins: 5, retrig: 2 },
    },
    fsExtra: { 3: 0, 4: .25, 5: .5, 6: 1 },
    pearl: [[1, 36], [2, 26], [3, 14], [4, 8], [5, 6], [8, 3.5], [10, 2.5], [15, 1.3], [20, .8], [25, .5], [50, .15], ['MINI', .9], ['MINEUR', .22], ['MAJEUR', .035]],
    hs: { need: 6, q: .007, respins: 3, col: .04, dbl: .025, dblMax: 8, grand: .0012 },
    frag: { need: 18 },
    exp: {
      rolls: 5,
      wreck: [[2, 30], [4, 25], [6, 20], [10, 13], [15, 8], [30, 4]],
      chest: [['MINI', 56], ['MINEUR', 30], ['MAJEUR', 12], ['GRAND', 2]],
      gatePrize: 10,
    },
  };

  /* Le plateau de l'Expédition : 30 cases, du Récif (0) à la Porte d'Atlantide (29).
     c = trésor (× mise moyenne) · r = coquillage en plus · x = multiplicateur +1
     w = tourbillon (recule) · k = Kraken (recule) · e = épave (3 coffres) · g = porte */
  const BOARD = [
    { t: 's' }, { t: 'c', v: 1 }, { t: 'c', v: 2 }, { t: 'r' }, { t: 'c', v: 2 }, { t: 'x' },
    { t: 'c', v: 3 }, { t: 'w', v: -3 }, { t: 'c', v: 3 }, { t: 'e' }, { t: 'c', v: 3 },
    { t: 'r' }, { t: 'c', v: 4 }, { t: 'k', v: -2 }, { t: 'x' }, { t: 'c', v: 5 },
    { t: 'e' }, { t: 'c', v: 4 }, { t: 'r' }, { t: 'c', v: 7 }, { t: 'w', v: -3 },
    { t: 'c', v: 8 }, { t: 'x' }, { t: 'e' }, { t: 'c', v: 10 }, { t: 'k', v: -2 },
    { t: 'c', v: 14 }, { t: 'r' }, { t: 'c', v: 18 }, { t: 'g' },
  ];

  /* ---------- Tirages pondérés ---------- */
  function table(pairs) { const v = [], c = []; let t = 0; for (const [x, w] of pairs) { if (!(w > 0)) continue; t += w; v.push(x); c.push(t); } return { v, c, t }; }
  function pick(tb, rnd) { const x = rnd() * tb.t, c = tb.c; for (let i = 0; i < c.length; i++) if (x < c[i]) return tb.v[i]; return tb.v[tb.v.length - 1]; }
  let T = null;
  function build() {
    T = { reel: {}, wildM: {}, pearl: table(P.pearl), kraken: { n: table(P.kraken.n), m: table(P.kraken.m) },
      krakenC: { n: table(P.krakenC.n), m: table(P.krakenC.m) }, wreck: table(P.exp.wreck), chest: table(P.exp.chest) };
    for (const mode in P.w) {
      T.reel[mode] = [];
      for (let c = 0; c < COLS; c++) {
        const w = Object.assign({}, P.w[mode], c === 0 && P.first ? P.first : {});
        T.reel[mode].push(table(Object.entries(w).filter(([k]) => !(k === 'W' && c === 0))));
      }
      T.wildM[mode] = table(P.wildM[mode]);
    }
  }
  build();

  let UID = 1;
  function pearlCell(rnd) {
    const v = pick(T.pearl, rnd);
    return typeof v === 'number' ? { id: UID++, k: 'PE', v } : { id: UID++, k: 'PE', jp: v };
  }
  function mkCell(k, mode, rnd) {
    if (k === 'W') return { id: UID++, k, m: pick(T.wildM[mode], rnd) };
    if (k === 'PE') return pearlCell(rnd);
    return { id: UID++, k };
  }
  const draw = (c, mode, rnd) => mkCell(pick(T.reel[mode][c], rnd), mode, rnd);
  const clone = g => g.map(col => col.map(x => Object.assign({}, x)));

  /* ---------- Évaluation « voies » ----------
     Pour chaque symbole payant : on avance rouleau par rouleau depuis la gauche
     tant qu'il est présent (ou remplacé par un Trident). Le nombre de voies est
     le produit des occurrences rouleau par rouleau. Les multiplicateurs des
     Tridents présents dans une combinaison s'ADDITIONNENT (×2 et ×3 → ×5) puis
     s'appliquent au gain de cette combinaison. */
  function evaluate(grid) {
    const wins = [];
    for (let s = 0; s < PAY_SYMS.length; s++) {
      const k = PAY_SYMS[s];
      let paths = 1, len = 0, wm = 0; const rows = [];
      for (let c = 0; c < COLS; c++) {
        const col = grid[c]; let cnt = 0; const rr = [];
        for (let r = 0; r < ROWS; r++) { const x = col[r]; if (x.k === k) { cnt++; rr.push(r); } else if (x.k === 'W') { cnt++; rr.push(r); if (x.m > 1) wm += x.m; } }
        if (!cnt) break;
        paths *= cnt; len++; rows.push(rr);
      }
      if (len >= 3) { const wmult = wm || 1; wins.push({ k, len, ways: paths, wmult, pay: PAY[k][len] * paths * wmult, rows }); }
    }
    return wins;
  }
  const anyWin = grid => evaluate(grid).length > 0;

  /* ---------- Gravité ----------
     Les cases retirées disparaissent, les survivants tombent, les nouveaux
     symboles arrivent par le haut. Les cellules « fixes » (Tridents ancrés du
     mode B) ne bougent jamais : les autres passent à travers. */
  function collapse(grid, rm, mode, rnd) {
    const out = new Array(COLS);
    for (let c = 0; c < COLS; c++) {
      const col = grid[c], nc = new Array(ROWS).fill(null), movers = [];
      for (let r = ROWS - 1; r >= 0; r--) {
        if (rm.has(c * ROWS + r)) continue;
        if (col[r].fx) nc[r] = col[r]; else movers.push(col[r]);
      }
      let i = 0;
      for (let r = ROWS - 1; r >= 0; r--) if (!nc[r] && i < movers.length) nc[r] = movers[i++];
      for (let r = ROWS - 1; r >= 0; r--) if (!nc[r]) nc[r] = draw(c, mode, rnd);
      out[c] = nc;
    }
    return out;
  }

  function placeWilds(grid, n, mTable, rnd) {
    const cand = [];
    for (let c = 1; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (PAY_SYMS.includes(grid[c][r].k)) cand.push([c, r]);
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    const placed = [];
    for (let i = 0; i < Math.min(n, cand.length); i++) {
      const [c, r] = cand[i], w = { id: UID++, k: 'W', m: pick(mTable, rnd), kr: 1 };
      grid[c][r] = w; placed.push({ c, r, id: w.id, m: w.m });
    }
    return placed;
  }

  /* ---------- Un tour (jeu de base ou tour gratuit) ----------
     opts.mode : 'base' | 'A' | 'B' | 'C' ; opts.fs : état des tours gratuits ;
     opts.grid : grille imposée (tests) ; opts.kraken : forcer le Kraken (tests).
     rec=false : pas d'enregistrement des étapes (simulateur, plus rapide). */
  function spin(opts, rnd, rec = true) {
    const mode = opts.mode || 'base', fs = opts.fs || null;
    let grid;
    if (opts.grid) grid = opts.grid.map((col, c) => col.map(k => typeof k === 'string' ? mkCell(k, mode, rnd) : Object.assign({ id: UID++ }, k)));
    else {
      grid = new Array(COLS);
      for (let c = 0; c < COLS; c++) { grid[c] = new Array(ROWS); for (let r = 0; r < ROWS; r++) grid[c][r] = draw(c, mode, rnd); }
    }
    const grid0 = rec ? clone(grid) : null;

    /* Le Kraken : aléatoire au jeu de base (avec gain garanti), à chaque tour en mode C */
    let kraken = null;
    if (mode === 'C') {
      kraken = placeWilds(grid, pick(T.krakenC.n, rnd), T.krakenC.m, rnd);
    } else if (mode === 'base' && (opts.kraken || (!opts.grid && rnd() < P.kraken.p))) {
      const n = pick(T.kraken.n, rnd);
      for (let tries = 0; tries < 40; tries++) {
        const g = clone(grid), placed = placeWilds(g, n, T.kraken.m, rnd);
        if (anyWin(g) || tries === 39) { grid = g; kraken = placed; break; }
      }
    }
    const expand0 = mode === 'B' ? expandReels(grid) : null;

    /* Cascades */
    const steps = []; let win = 0, k = 0, maxMult = 1;
    while (k < 80) {
      const wins = evaluate(grid);
      if (!wins.length) break;
      let mult;
      if (mode === 'A') mult = fs.tide; else mult = LADDER[Math.min(k, LADDER.length - 1)];
      maxMult = Math.max(maxMult, mult);
      let base = 0; for (const w of wins) base += w.pay;
      const stepWin = base * mult;
      const rm = new Set(), usedW = new Set();
      for (const w of wins) for (let c = 0; c < w.len; c++) for (const r of w.rows[c]) {
        const x = grid[c][r], i = c * ROWS + r;
        if (x.k === 'W') { usedW.add(i); if (!x.fx) rm.add(i); } else rm.add(i);
      }
      const before = rec ? clone(grid) : null;
      grid = collapse(grid, rm, mode, rnd);
      const expand = mode === 'B' ? expandReels(grid) : null;
      if (mode === 'A') fs.tide = Math.min(P.fs.A.tideCap, fs.tide + P.fs.A.inc);
      win += stepWin;
      if (rec) steps.push({ before, wins, mult, base, win: stepWin, rm: [...rm], used: [...usedW], after: clone(grid), expand });
      k++;
    }

    /* Fin de cascade : scatters, perles, fragments */
    let scat = 0; const pearls = [], frags = [], scats = [];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const x = grid[c][r];
      if (x.k === 'S') { scat++; scats.push([c, r]); } else if (x.k === 'PE') pearls.push({ c, r, cell: Object.assign({}, x) }); else if (x.k === 'FR') frags.push([c, r]);
    }
    const scatWin = mode === 'base' ? (SCAT_PAY[Math.min(scat, 6)] || 0) : 0;
    const total = Math.min(MAXWIN, win + scatWin);
    return {
      mode, grid0, kraken, expand0, steps, cascades: k, maxMult, grid, lineWin: win, scat, scats, scatWin, total,
      pearls, frags: frags.length, fragCells: frags,
      fsTrig: scat >= 3 && mode === 'base' ? scat : 0,
      retrig: scat >= 3 && mode !== 'base' ? scat : 0,
      hsTrig: mode === 'base' && pearls.length >= P.hs.need,
    };
  }
  /* Mode B « Tridents Déferlants » : un Trident qui tombe soulève une vague et
     recouvre tout son rouleau de Tridents (sauf les conques). Seul le Trident
     d'origine garde son multiplicateur. Renvoie les rouleaux submergés. */
  function expandReels(grid) {
    const out = [];
    for (let c = 1; c < COLS; c++) {
      const col = grid[c]; let src = -1;
      for (let r = 0; r < ROWS; r++) if (col[r].k === 'W' && !col[r].xp) { src = r; break; }
      if (src < 0) continue;
      const m = col[src].m; col[src].xp = 1;
      const ids = [];
      for (let r = 0; r < ROWS; r++) {
        if (r === src || col[r].k === 'S') continue;
        if (col[r].k === 'W') { col[r].xp = 1; continue; }
        col[r] = { id: UID++, k: 'W', m: 1, xp: 1 }; ids.push(r);
      }
      out.push({ c, src, m, rows: ids });
    }
    return out.length ? out : null;
  }

  /* ---------- Tours gratuits « La Tempête de Poséidon » ---------- */
  const fsSpinsFor = (mode, scat) => { const b = P.fs[mode].spins; return b + Math.round(b * (P.fsExtra[Math.min(6, scat)] || 0)); };
  function fsStart(mode, scat) {
    return { mode, scat, left: fsSpinsFor(mode, scat), played: 0, total: 0, tide: P.fs.A.tide0, retrigs: 0, capped: false, best: 0 };
  }
  function fsSpin(st, rnd, rec = true) {
    const res = spin({ mode: st.mode, fs: st }, rnd, rec);
    st.left--; st.played++;
    const room = MAXWIN - st.total, got = Math.min(res.total, room);
    res.paid = got; st.total += got; st.best = Math.max(st.best, got);
    if (res.retrig) { const add = P.fs[st.mode].retrig; st.left += add; st.retrigs++; res.added = add; }
    if (st.total >= MAXWIN) { st.capped = true; st.left = 0; }
    res.done = st.left <= 0;
    return res;
  }

  /* ---------- « Le Trésor des Abysses » (Hold & Spin des perles) ---------- */
  const pearlCash = x => (x && x.k === 'PE' && typeof x.v === 'number') ? x.v : 0;
  function hsStart(pearls) {
    const cells = new Array(NC).fill(null);
    for (const p of pearls) cells[p.c * ROWS + p.r] = Object.assign({}, p.cell, { id: p.cell.id || UID++ });
    return { cells, respins: P.hs.respins, dbl: 1, done: false, steps: 0, full: false };
  }
  function hsPearl(rnd) {
    const x = rnd();
    if (x < P.hs.col) return { id: UID++, k: 'PE', col: 1, v: 0 };
    if (x < P.hs.col + P.hs.dbl) return { id: UID++, k: 'PE', dbl: 1 };
    if (x < P.hs.col + P.hs.dbl + P.hs.grand) return { id: UID++, k: 'PE', jp: 'GRAND' };
    return pearlCell(rnd);
  }
  function hsStep(st, rnd) {
    if (st.done) return null;
    const landed = [];
    for (let i = 0; i < NC; i++) if (!st.cells[i] && rnd() < P.hs.q) { const p = hsPearl(rnd); st.cells[i] = p; landed.push(i); }
    const collects = [];
    let dblNow = 0;
    for (const i of landed) {
      const p = st.cells[i];
      if (p.col) {
        let add = 0; const from = [];
        for (let j = 0; j < NC; j++) if (j !== i && st.cells[j] && pearlCash(st.cells[j]) > 0 && !st.cells[j].col) { add += st.cells[j].v; from.push(j); }
        p.v = add || 5; collects.push({ i, from, v: p.v });
      }
      if (p.dbl) { if (st.dbl < P.hs.dblMax) { st.dbl *= 2; dblNow++; } }
    }
    st.steps++;
    st.respins = landed.length ? P.hs.respins : st.respins - 1;
    const filled = st.cells.every(Boolean);
    if (filled) st.full = true;
    if (filled || st.respins <= 0) st.done = true;
    return { landed, collects, dblNow, respins: st.respins, done: st.done };
  }
  function hsTotal(st) {
    let cash = 0, jp = 0; const jps = [];
    for (const x of st.cells) {
      if (!x) continue;
      if (typeof x.v === 'number') cash += x.v;
      if (x.jp) { jp += JP[x.jp]; jps.push(x.jp); }
    }
    if (st.full) { jp += JP.GRAND; jps.push('GRAND'); }
    const total = Math.min(MAXWIN, cash * st.dbl + jp);
    return { cash, dbl: st.dbl, jp, jps, total, count: st.cells.filter(Boolean).length };
  }

  /* ---------- « L'Expédition » (carte au trésor) ---------- */
  function expStart() { return { pos: 0, rolls: P.exp.rolls, total: 0, mult: 1, done: false, gate: false, pending: null, visits: 0, jp: null, jpv: 0, log: [] }; }
  function expRoll(st, rnd) {
    if (st.done || st.pending) return null;
    const die = 1 + Math.floor(rnd() * 6);
    st.rolls--;
    const from = st.pos, last = BOARD.length - 1;
    let to = Math.min(last, from + die);
    const ev = { die, from, to, tile: BOARD[to] };
    const tile = BOARD[to];
    st.pos = to; st.visits++;
    if (tile.t === 'c') { st.total += tile.v; ev.cash = tile.v; }
    else if (tile.t === 'r') { st.rolls++; ev.roll = 1; }
    else if (tile.t === 'x') { st.mult++; ev.mult = st.mult; }
    else if (tile.t === 'w' || tile.t === 'k') { st.pos = Math.max(0, to + tile.v); ev.back = st.pos; }
    else if (tile.t === 'e') { const vals = [pick(T.wreck, rnd), pick(T.wreck, rnd), pick(T.wreck, rnd)]; st.pending = { t: 'e', vals }; ev.wreck = vals; }
    else if (tile.t === 'g') {
      st.gate = true; st.total += P.exp.gatePrize; ev.gatePrize = P.exp.gatePrize;
      const c = chestDraw(rnd); st.jp = c.jp; st.jpv = JP[c.jp]; ev.chest = c; st.done = true;
    }
    if (!st.done && !st.pending && st.rolls <= 0) st.done = true;
    ev.done = st.done;
    st.log.push(ev);
    return ev;
  }
  function expPick(st, idx) {
    if (!st.pending) return null;
    const v = st.pending.vals[idx]; st.total += v; st.pending = null;
    if (st.rolls <= 0) st.done = true;
    return { v, done: st.done };
  }
  const expTotal = st => Math.min(MAXWIN, st.total * st.mult + (st.jpv || 0));
  /* Coffre de Poséidon : 12 coquilles, on retourne jusqu'à trouver 3 fois le même jackpot.
     Le jackpot gagnant est tiré d'abord, puis une séquence de révélations cohérente. */
  function chestDraw(rnd) {
    const jp = pick(T.chest, rnd);
    const others = JP_ORDER.filter(x => x !== jp);
    const seq = [jp, jp];
    for (const o of others) { const n = Math.floor(rnd() * 3); for (let i = 0; i < n; i++) seq.push(o); }
    for (let i = seq.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [seq[i], seq[j]] = [seq[j], seq[i]]; }
    while (seq.length > 11) { const idx = seq.findIndex(x => x !== jp); if (idx < 0) break; seq.splice(idx, 1); }
    seq.push(jp);
    return { jp, seq };
  }

  /* ---------- Achat de bonus : départs imposés ---------- */
  function buyFsScat(rnd) { return rnd() < .8 ? 3 : 4; }
  function buyHsPearls(rnd) {
    const idx = []; for (let i = 0; i < NC; i++) idx.push(i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return idx.slice(0, P.hs.need).map(i => ({ c: Math.floor(i / ROWS), r: i % ROWS, cell: pearlCell(rnd) }));
  }
  /* Prix d'achat (× la mise) : espérance simulée ÷ 0,96 (voir tools/sim-atlantide.js) */
  const BUY = { fs: 44, hs: 26 };

  return {
    COLS, ROWS, NC, MAXWIN, PAY_SYMS, NAMES, PAY, LADDER, SCAT_PAY, JP, JP_ORDER, P, BOARD, BUY,
    build, evaluate, spin, fsStart, fsSpin, fsSpinsFor, hsStart, hsStep, hsTotal, expStart, expRoll, expPick, expTotal,
    chestDraw, buyFsScat, buyHsPearls, pearlCash,
    dev: { grid: null, kraken: false },
  };
})();
if (typeof module !== 'undefined') module.exports = ATL;
