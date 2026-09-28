'use strict';
/* ============ Atlantide — écrans de bonus ============
   Chaque écran reçoit le contexte X du jeu (js/games/atlantide.js).
   Règle d'or : un tirage est TOUJOURS fait par le moteur et sauvegardé
   (S.atl) avant d'être montré. Une page fermée reprend là où elle était,
   sans relancer ni perdre un tirage. */
const ATLB = (() => {
  const { ROWS, NC } = ATL;
  const MODES = {
    A: { n: 'Marée Montante', d: 'La marée démarre à ×2, monte de 1 à chaque cascade et ne redescend jamais.', vol: 3, vl: 'Haute', ic: '<path d="M4 30q8-8 16 0t16 0 16 0 16 0" /><path d="M4 42q8-8 16 0t16 0 16 0 16 0" opacity=".6"/><path d="M36 6v16M30 12l6-6 6 6"/>' },
    B: { n: 'Tridents Déferlants', d: 'Chaque Trident soulève une vague qui recouvre tout son rouleau. Multiplicateurs jusqu’à ×5.', vol: 5, vl: 'Extrême', ic: '<path d="M36 44V14M24 10v10q0 6 12 6t12-6V10M36 6v8M24 10l-3 4M48 10l3 4"/><path d="M8 46q7-6 14 0t14 0 14 0 14 0" opacity=".6"/>' },
    C: { n: 'Colère du Kraken', d: 'Le Kraken plante 2 à 4 Tridents (jusqu’à ×5) à chaque tour. Le plus régulier.', vol: 2, vl: 'Moyenne', ic: '<path d="M14 46c-4-12 6-18 2-28-2-5 3-9 6-6-3 1-3 5-1 8 5 9-3 16 1 26M36 46c-3-14 5-20 1-32-2-6 4-9 6-5-3 1-2 5-1 8 4 11-3 18-1 29M58 46c-4-12 6-18 2-28-2-5 3-9 6-6-3 1-3 5-1 8 5 9-3 16 1 26"/>' },
  };
  const svg = (inner, vb = '0 0 72 52') => `<svg viewBox="${vb}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

  /* ---------- Écran de fin de bonus ---------- */
  function outro(X, head, title, win, ref) {
    const mult = ref > 0 ? win / ref : 0;
    if (mult >= 10) return X.bigWinFx(win, mult, head);
    return new Promise(res => {
      const o = h(`<div class="atl-ov atl-out"><div class="atl-out-in"><small>${head}</small><h2>${title}</h2><b class="num">◈ ${fmt(win)}</b>${ref > 0 && win > 0 ? `<i>×${fmt(r2(mult))} la mise</i>` : ''}<button class="btn btn-gold btn-big" type="button">Continuer</button></div></div>`);
      X.layer.appendChild(o); X.snd(win > 0 ? 'win' : 'click');
      if (win > 0) X.fx.rain(18, X.root.clientWidth);
      let t = 0;
      const close = () => { clearTimeout(t); if (!o.isConnected) return res(); o.classList.add('out'); setTimeout(() => { o.remove(); res(); }, 250); };
      $('button', o).addEventListener('click', close);
      t = setTimeout(close, 4200);
    });
  }

  /* ---------- Choix de la tempête ---------- */
  function chooseMode(X, t) {
    return new Promise(res => {
      const bet = t.bet, spins = m => ATL.fsSpinsFor(m, t.scat);
      const o = h(`<div class="atl-ov atl-choose" role="dialog" aria-label="Choisissez votre tempête">
        <div class="atl-ch-in">
          <small>${t.cost ? 'Bonus acheté' : t.scat + ' conques'} · mise ◈ ${fmt(bet)}</small>
          <h2>La Tempête de Poséidon</h2>
          <p>Choisissez votre tempête. Les trois ont la même espérance de gain, seule la volatilité change.</p>
          <div class="atl-modes">${['A', 'B', 'C'].map(m => `<button type="button" class="atl-md md-${m}" data-m="${m}">
            <span class="md-ic">${svg(MODES[m].ic)}</span>
            <b>${MODES[m].n}</b>
            <em class="num">${spins(m)} tours gratuits</em>
            <span class="md-d">${MODES[m].d}</span>
            <span class="md-v"><small>Volatilité</small>${[1, 2, 3, 4, 5].map(i => `<i class="${i <= MODES[m].vol ? 'on' : ''}"></i>`).join('')}<small>${MODES[m].vl}</small></span>
          </button>`).join('')}</div>
        </div></div>`);
      X.layer.appendChild(o); X.snd('bonus');
      X.an(o, [{ opacity: 0 }, { opacity: 1 }], { duration: 350 });
      $$('.atl-md', o).forEach((b, i) => X.an(b, [{ opacity: 0, transform: 'translateY(30px) scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 120 + i * 110, easing: 'cubic-bezier(.2,.8,.3,1)' }));
      $$('.atl-md', o).forEach(b => b.addEventListener('click', () => {
        if (o.classList.contains('picked')) return;
        o.classList.add('picked'); b.classList.add('sel'); X.snd('atl-scat');
        setTimeout(() => { o.classList.add('out'); setTimeout(() => { o.remove(); res(b.dataset.m); }, 280); }, 520);
      }));
    });
  }

  /* ---------- Tours gratuits ---------- */
  async function fs(X) {
    const A = X.A, F = A.fs, st = F.st, bet = F.bet, M = MODES[st.mode];
    X.setScene('fs' + st.mode); X.root.classList.add('in-fs'); unlock('atl_fs');
    const bar = tot => { X.fbar.innerHTML = `<div class="afb afb-fs"><span><small>Tempête</small><b>${M.n}</b></span><span><small>Tour</small><b class="num">${Math.min(st.played + (st.left > 0 ? 1 : 0), st.played + st.left)} / ${st.played + st.left}</b></span><span><small>Gain des tours</small><b class="num">◈ ${fmt(r2(tot * bet))}</b></span></div>`; };
    bar(st.total); X.setWin(r2(st.total * bet));
    if (st.mode === 'A') X.setTide(-1, 'A', st.tide);
    if (st.played === 0) { X.snd('bonus'); await X.banner(`${st.left} tours gratuits`, M.n, { dur: 2300, cls: 'big' }); }
    else await X.banner('Reprise de la tempête', `${st.left} tour${st.left > 1 ? 's' : ''} restant${st.left > 1 ? 's' : ''}`, { dur: 1500 });
    X.msg(`<b>${M.n}</b> · ${M.d}`, 'i');
    while (st.left > 0) {
      X.setHurry(false);
      bar(st.total);
      await X.wait(420);
      const tide0 = st.tide, before = st.total;
      rngStart();
      const res = ATL.fsSpin(st, rand); save();
      await X.playSpin(res, { bet, fs: true, acc0: r2(before * bet), tide0 });
      X.setWin(r2(st.total * bet)); bar(st.total);
      if (res.paid >= 20) X.amount(r2(res.paid * bet), 1);
      if (res.retrig) { X.snd('bonus'); await X.banner(`+${res.added} tours`, 'La tempête redouble', { dur: 1600 }); bar(st.total); }
      if (st.capped) await X.banner('Gain maximal', `${fmt(ATL.MAXWIN)}× la mise`, { dur: 2000, cls: 'big' });
    }
    const win = r2(st.total * bet);
    A.fs = null;
    X.payFeature(win, F.cost, bet, `Tempête · ${M.n} · ${st.played} tours`);
    await X.wait(300);
    await outro(X, 'La Tempête de Poséidon', 'La tempête s’apaise', win, F.cost || bet);
    X.root.classList.remove('in-fs'); X.fbar.innerHTML = ''; X.setScene('base'); X.setTide(-1, 'base');
    X.msg(win > 0 ? `Tempête terminée : <b>◈ ${fmt(win)}</b>` : 'La tempête s’apaise…', win > 0 ? 'w' : 'i');
  }

  /* ---------- Le Trésor des Abysses (perles) ---------- */
  const pearlLab = (x, bet, fk) => x.col ? `<span class="hp-l col">${x.v ? fk(x.v * bet) : 'Collecte'}</span>` : x.dbl ? '<span class="hp-l dbl">×2</span>' : x.jp ? `<span class="hp-l jp j-${x.jp}">${ATLUI.JPN[x.jp]}</span>` : `<span class="hp-l">${fk(x.v * bet)}</span>`;
  async function hs(X) {
    const A = X.A, F = A.hs, st = F.st, bet = F.bet;
    X.setScene('hs'); X.root.classList.add('in-hs'); unlock('atl_hs');
    const box = h('<div class="atl-hs"></div>'); X.reels.appendChild(box);
    const sock = [];
    for (let i = 0; i < NC; i++) { const s = h(`<div class="hsk" style="--c:${Math.floor(i / ROWS)};--r:${i % ROWS}"></div>`); box.appendChild(s); sock.push(s); }
    const put = (i, anim) => {
      const x = st.cells[i], s = sock[i];
      s.className = 'hsk on' + (x.col ? ' col' : x.dbl ? ' dbl' : x.jp ? ' jp' : '');
      s.innerHTML = `<div class="hp"><img src="${ATL_ART.src('PE')}" alt="">${pearlLab(x, bet, X.fk)}</div>`;
      if (anim) {
        X.an(s.firstChild, [{ transform: 'translateY(-60%) scale(.3)', opacity: 0 }, { transform: 'translateY(0) scale(1.15)', opacity: 1, offset: .65 }, { transform: 'scale(1)', opacity: 1 }], { duration: 420 });
        const [px, py] = X.cellCenter(Math.floor(i / ROWS), i % ROWS); X.fx.burst(px, py, x.jp ? '#FFD86B' : '#E8F4FF', 12);
      }
    };
    const cashNow = () => { let v = 0; for (const x of st.cells) if (x && typeof x.v === 'number') v += x.v; return v; };
    const bar = () => {
      const n = st.cells.filter(Boolean).length;
      X.fbar.innerHTML = `<div class="afb afb-hs"><span><small>Relances</small><b class="lamps">${[0, 1, 2].map(i => `<i class="${i < st.respins ? 'on' : ''}"></i>`).join('')}</b></span><span><small>Perles</small><b class="num">${n} / ${NC}</b></span>${st.dbl > 1 ? `<span><small>Doubleur</small><b class="num">×${st.dbl}</b></span>` : ''}<span><small>Trésor</small><b class="num">◈ ${fmt(r2(cashNow() * st.dbl * bet))}</b></span></div>`;
    };
    bar();
    if (st.steps === 0) {
      X.snd('bonus');
      const idx = []; for (let i = 0; i < NC; i++) if (st.cells[i]) idx.push(i);
      X.banner('Le Trésor des Abysses', '3 relances · chaque perle les remet à 3', { dur: 2300, cls: 'big' });
      await X.wait(500);
      for (const i of idx) { put(i, true); X.snd('atl-pearl'); await X.wait(170); }
      await X.wait(1100);
    } else { for (let i = 0; i < NC; i++) if (st.cells[i]) put(i, false); await X.banner('Reprise du Trésor', '', { dur: 1300 }); }
    X.msg('Chaque perle qui tombe se fixe et relance le compteur', 'i');
    while (!st.done) {
      X.setHurry(false);
      await X.wait(380);
      box.classList.add('roll'); X.snd('atl-roll');
      const res = ATL.hsStep(st, rand); save();
      await X.wait(650);
      box.classList.remove('roll');
      for (const i of res.landed) { put(i, true); X.snd(st.cells[i].jp ? 'atl-jp' : 'atl-pearl'); await X.wait(200); }
      for (const cl of res.collects) {
        X.snd('atl-collect');
        const to = sock[cl.i].getBoundingClientRect();
        const ps = cl.from.map((j, k) => {
          const fr = sock[j].getBoundingClientRect(), orb = h('<i class="atl-orb"></i>'), R = X.root.getBoundingClientRect();
          orb.style.cssText = `left:${fr.left - R.left + fr.width / 2}px;top:${fr.top - R.top + fr.height / 2}px`;
          X.root.appendChild(orb);
          return X.fin(X.an(orb, [{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.2)', opacity: 1, offset: .2 }, { transform: `translate(calc(-50% + ${to.left - fr.left}px),calc(-50% + ${to.top - fr.top}px)) scale(.5)`, opacity: .9 }], { duration: 560, delay: k * 50, easing: 'cubic-bezier(.5,0,.4,1)', fill: 'forwards' })).finally(() => orb.remove());
        });
        await Promise.all(ps);
        put(cl.i, false); X.an(sock[cl.i].firstChild, [{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 380 });
        X.snd('coin');
      }
      if (res.dblNow) { X.snd('atl-jp'); await X.banner(`Doubleur ×${st.dbl}`, 'Le trésor double', { dur: 1400 }); }
      bar();
      if (!res.landed.length) { X.snd('tick'); const l = $$('.lamps i', X.fbar)[st.respins]; l && X.an(l, [{ transform: 'scale(1.6)', background: '#fff' }, { transform: 'scale(1)' }], { duration: 400 }); }
    }
    if (st.full) { X.snd('big'); await X.banner('Grille complète !', 'Grand Jackpot', { dur: 2200, cls: 'big jp' }); }
    /* Décompte : chaque perle rejoint le trésor */
    const t = ATL.hsTotal(st);
    let run = 0;
    for (let i = 0; i < NC; i++) {
      const x = st.cells[i]; if (!x) continue;
      sock[i].classList.add('tally');
      if (typeof x.v === 'number') { run += x.v; X.fbar.querySelector('.afb-hs span:last-child b').textContent = '◈ ' + fmt(r2(run * bet)); X.snd('tick'); }
      await X.wait(110);
    }
    if (t.dbl > 1) await X.banner(`× ${t.dbl}`, `◈ ${fmt(r2(t.cash * bet))} → ◈ ${fmt(r2(t.cash * t.dbl * bet))}`, { dur: 1500 });
    for (const j of t.jps) {
      X.snd('atl-jp'); if (j === 'GRAND') unlock('atl_grand');
      await X.banner(`Jackpot ${ATLUI.JPN[j]}`, `◈ ${fmt(r2(ATL.JP[j] * bet))}`, { dur: 1900, cls: 'jp j-' + j });
    }
    const win = r2(t.total * bet);
    A.hs = null;
    X.payFeature(win, F.cost, bet, `Trésor des Abysses · ${t.count} perles${t.jps.length ? ' · ' + t.jps.map(j => ATLUI.JPN[j]).join(', ') : ''}`);
    X.setWin(win);
    await outro(X, 'Le Trésor des Abysses', t.count + ' perles remontées', win, F.cost || bet);
    await X.fin(X.an(box, [{ opacity: 1 }, { opacity: 0 }], { duration: 350, fill: 'forwards' })).catch(() => {});
    box.remove(); X.root.classList.remove('in-hs'); X.fbar.innerHTML = '';
    X.msg(`Trésor remonté : <b>◈ ${fmt(win)}</b>`, 'w');
  }

  /* ---------- L'Expédition ---------- */
  const TI = {
    s: svg('<path d="M36 8v34M26 16h20M18 32q2 12 18 12t18-12M14 36l4-4 4 4M50 36l4-4 4 4"/>'),
    c: svg('<ellipse cx="36" cy="38" rx="16" ry="5"/><path d="M20 38v-6M52 38v-6"/><ellipse cx="36" cy="32" rx="16" ry="5"/><ellipse cx="36" cy="20" rx="12" ry="4"/><path d="M24 20v5M48 20v5"/>'),
    r: svg('<path d="M36 44 16 22q6-12 20-12t20 12z"/><path d="M36 44V12M36 44 24 14M36 44l12-30M36 44 18 20M36 44l18-24"/>'),
    x: svg('<path d="M24 16l24 24M48 16 24 40"/>'),
    w: svg('<path d="M36 28a4 4 0 1 1 4-4 8 8 0 1 1-8-8 12 12 0 1 1 12 12 16 16 0 0 1-16-16"/>'),
    k: svg('<path d="M18 46c-4-10 6-16 2-26-2-5 3-8 6-5M36 46c-3-12 5-18 1-30-2-5 4-8 6-4M54 46c-4-10 6-16 2-26"/>'),
    e: svg('<path d="M10 34h52l-8 10H18z"/><path d="M24 34V14l16 8-16 6M40 34V20"/><path d="M8 46q7-5 14 0t14 0 14 0 14 0" opacity=".6"/>'),
    g: svg('<path d="M16 46V22q0-14 20-14t20 14v24"/><path d="M26 46V26q0-8 10-8t10 8v20M12 46h48"/><circle cx="36" cy="30" r="2" fill="currentColor"/>'),
  };
  const SUB = `<svg viewBox="0 0 80 50" aria-hidden="true"><defs><linearGradient id="exsub" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7A0"/><stop offset=".55" stop-color="#D49A2A"/><stop offset="1" stop-color="#7A4A0E"/></linearGradient></defs><ellipse cx="40" cy="30" rx="30" ry="13" fill="url(#exsub)" stroke="#4A2A06" stroke-width="2"/><path d="M32 18v-9h14v9" fill="url(#exsub)" stroke="#4A2A06" stroke-width="2"/><path d="M40 9V3h8" stroke="#4A2A06" stroke-width="2" fill="none"/><circle cx="30" cy="30" r="5" fill="#9FF6FF" stroke="#4A2A06" stroke-width="2"/><circle cx="46" cy="30" r="5" fill="#9FF6FF" stroke="#4A2A06" stroke-width="2"/><path d="M70 30l8-7v14z" fill="#B7832A" stroke="#4A2A06" stroke-width="2"/></svg>`;
  const CHEST = `<svg viewBox="0 0 80 64" aria-hidden="true"><defs><linearGradient id="exch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A5A2B"/><stop offset="1" stop-color="#3E230C"/></linearGradient><linearGradient id="exchg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF1B8"/><stop offset=".5" stop-color="#D9A331"/><stop offset="1" stop-color="#7A4A0E"/></linearGradient></defs><path d="M8 28q0-20 32-20t32 20z" fill="url(#exch)" stroke="url(#exchg)" stroke-width="3"/><rect x="8" y="28" width="64" height="30" rx="3" fill="url(#exch)" stroke="url(#exchg)" stroke-width="3"/><path d="M8 38h64M24 10v48M56 10v48" stroke="url(#exchg)" stroke-width="3"/><rect x="34" y="32" width="12" height="14" rx="2" fill="url(#exchg)"/></svg>`;
  const tilePos = i => { const row = Math.floor(i / 6), k = i % 6, col = row % 2 ? 5 - k : k; return [9 + col * 16.4, 89 - row * 19.5]; };

  async function exp(X) {
    const A = X.A, F = A.exp, st = F.st, bet = F.bet;
    X.setScene('exp'); X.paintMap(A.map.n); X.spinBtn.disabled = true;
    const B = ATL.BOARD;
    const tileLab = t => t.t === 'c' ? X.fk(t.v * bet) : t.t === 'r' ? '+1 lancer' : t.t === 'x' ? 'Multi +1' : t.t === 'w' ? 'Tourbillon' : t.t === 'k' ? 'Kraken' : t.t === 'e' ? 'Épave' : t.t === 'g' ? 'La Porte' : 'Départ';
    const pts = B.map((_, i) => tilePos(i));
    const o = h(`<div class="atl-ov atl-exp">
      <div class="ex-head">
        <div class="ex-title"><small>Carte d’Atlantide · mise moyenne ◈ ${fmt(bet)}</small><b>L’Expédition</b></div>
        <div class="ex-stats"><span><small>Lancers</small><b class="num" id="exR"></b></span><span><small>Multiplicateur</small><b class="num" id="exM"></b></span><span><small>Butin</small><b class="num" id="exT"></b></span></div>
      </div>
      <div class="ex-mapw"><div class="ex-map"${ATL_IMG.map ? ` style="background-image:url('${ATL_IMG.map}')"` : ''}>
        <svg class="ex-path" viewBox="0 0 120 100" preserveAspectRatio="none"><path d="M${pts.map(([x, y]) => (x * 1.2).toFixed(1) + ' ' + y).join('L')}"/></svg>
        ${B.map((t, i) => `<div class="ex-t t-${t.t}" data-i="${i}" style="left:${pts[i][0]}%;top:${pts[i][1]}%"><span class="ex-ti">${TI[t.t]}</span><em>${tileLab(t)}</em></div>`).join('')}
        <div class="ex-tok">${ATL_IMG.sub ? `<img src="${ATL_IMG.sub}" alt="">` : SUB}</div>
      </div></div>
      <div class="ex-foot"><div class="ex-die" id="exDie"></div><button class="btn btn-gold btn-big ex-go" type="button" id="go">Lancer le dé</button></div>
    </div>`);
    X.layer.appendChild(o);
    const mapEl = $('.ex-map', o), mapW = $('.ex-mapw', o), tok = $('.ex-tok', o), go = $('#go', o), die = $('#exDie', o);
    const fitMap = () => { const w = mapW.clientWidth, hh = mapW.clientHeight; if (!w || !hh) return; const W = Math.min(w, hh * 1.2); mapEl.style.width = W + 'px'; mapEl.style.height = W / 1.2 + 'px'; };
    const ro = new ResizeObserver(fitMap); ro.observe(mapW); fitMap();
    const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
    const face = n => { die.innerHTML = Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[n].includes(i) ? 'on' : ''}"></i>`).join(''); };
    face(6);
    const setTok = i => { tok.style.left = pts[i][0] + '%'; tok.style.top = pts[i][1] + '%'; $$('.ex-t', o).forEach(e => e.classList.toggle('here', +e.dataset.i === i)); };
    const stats = () => { $('#exR', o).textContent = st.rolls; $('#exM', o).textContent = '×' + st.mult; $('#exT', o).textContent = '◈ ' + fmt(r2(st.total * st.mult * bet)); };
    for (const ev of st.log) $(`.ex-t[data-i="${ev.to}"]`, o)?.classList.add('seen');
    setTok(st.pos); stats();
    X.an(o, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
    if (!st.log.length) { X.snd('bonus'); await X.banner('L’Expédition', `${st.rolls} lancers vers la Porte d’Atlantide`, { dur: 2200, cls: 'big' }); }
    const hop = async (to, back) => {
      const [x0, y0] = [parseFloat(tok.style.left), parseFloat(tok.style.top)], [x1, y1] = pts[to];
      const W = mapEl.clientWidth, H = mapEl.clientHeight;
      setTok(to);
      await X.fin(X.an(tok, [{ transform: `translate(calc(-50% + ${(x0 - x1) / 100 * W}px),calc(-50% + ${(y0 - y1) / 100 * H}px))` }, { transform: `translate(calc(-50% + ${(x0 - x1) / 200 * W}px),calc(-50% + ${(y0 - y1) / 200 * H - (back ? 0 : 18)}px))`, offset: .5 }, { transform: 'translate(-50%,-50%)' }], { duration: back ? 150 : 240, easing: 'ease-in-out' }));
      X.snd('atl-step');
    };
    const float = (i, txt, cls = '') => {
      const e = h(`<div class="ex-float ${cls}">${txt}</div>`); e.style.left = pts[i][0] + '%'; e.style.top = pts[i][1] + '%'; mapEl.appendChild(e);
      X.an(e, [{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-140%) scale(1.1)', opacity: 1, offset: .3 }, { transform: 'translate(-50%,-190%) scale(1)', opacity: 0 }], { duration: 1500, fill: 'forwards' }).finished.then(() => e.remove(), () => e.remove());
    };
    const pop = html => { const p = h(`<div class="ex-pop"><div class="ex-pop-in">${html}</div></div>`); o.appendChild(p); X.an(p, [{ opacity: 0 }, { opacity: 1 }], { duration: 250 }); return p; };

    async function wreck(vals) {
      X.snd('atl-chest');
      const p = pop(`<small>Épave engloutie</small><h3>Choisissez un coffre</h3><div class="ex-chests">${vals.map((_, i) => `<button type="button" class="ex-ch" data-i="${i}">${ATL_IMG.chest ? `<img src="${ATL_IMG.chest}" alt="">` : CHEST}<b></b></button>`).join('')}</div>`);
      const idx = await new Promise(res => $$('.ex-ch', p).forEach(b => b.addEventListener('click', () => res(+b.dataset.i), { once: true })));
      const r = ATL.expPick(st, idx); save();
      $$('.ex-ch', p).forEach((b, i) => { b.disabled = true; $('b', b).textContent = '◈ ' + fmt(r2(vals[i] * bet)); b.classList.add(i === idx ? 'pick' : 'miss'); });
      X.snd('coin'); X.an($$('.ex-ch', p)[idx], [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1.08)' }], { duration: 500, fill: 'forwards' });
      stats(); await X.wait(1600); p.remove();
      return r;
    }
    async function chest(c) {
      X.snd('atl-jp');
      const p = pop(`<small>La Porte d’Atlantide s’ouvre · +◈ ${fmt(r2(ATL.P.exp.gatePrize * bet))}</small><h3>Le Coffre de Poséidon</h3><p>Retournez les coquilles : 3 identiques désignent votre jackpot.</p>
        <div class="ex-jpc">${ATL.JP_ORDER.map(j => `<span class="j-${j}" data-j="${j}"><b>${ATLUI.JPN[j]}</b><em class="num">${X.fk(ATL.JP[j] * bet)}</em><i></i><i></i><i></i></span>`).join('')}</div>
        <div class="ex-shells">${Array.from({ length: 12 }, (_, i) => `<button type="button" class="ex-sh" data-i="${i}" aria-label="Coquille ${i + 1}"></button>`).join('')}</div>
        <button type="button" class="btn btn-ghost ex-auto">Tout révéler</button>`);
      let k = 0; const cnt = {};
      await new Promise(res => {
        const reveal = b => {
          if (b.classList.contains('open') || k >= c.seq.length) return;
          const j = c.seq[k++]; cnt[j] = (cnt[j] || 0) + 1;
          b.classList.add('open', 'j-' + j); b.innerHTML = `<b>${ATLUI.JPN[j]}</b>`; X.snd('atl-pearl');
          const pip = $$(`.ex-jpc [data-j="${j}"] i`, p)[cnt[j] - 1]; pip && pip.classList.add('on');
          if (k >= c.seq.length) { $$('.ex-sh', p).forEach(x => { x.disabled = true; if (x.classList.contains('j-' + c.jp)) x.classList.add('win'); }); $(`.ex-jpc [data-j="${c.jp}"]`, p).classList.add('win'); setTimeout(res, 700); }
        };
        $$('.ex-sh', p).forEach(b => b.addEventListener('click', () => reveal(b)));
        $('.ex-auto', p).addEventListener('click', async e => { e.currentTarget.disabled = true; for (const b of $$('.ex-sh:not(.open)', p)) { if (k >= c.seq.length || X.dead()) break; reveal(b); await sleep(260); } });
      });
      if (c.jp === 'GRAND') unlock('atl_grand');
      await X.banner(`Jackpot ${ATLUI.JPN[c.jp]}`, `◈ ${fmt(r2(ATL.JP[c.jp] * bet))}`, { dur: 2000, cls: 'jp j-' + c.jp });
      p.remove();
    }

    const turn = async () => {
      go.disabled = true;
      const ev = ATL.expRoll(st, rand); save();
      X.snd('atl-dice');
      for (let i = 0; i < 9; i++) { face(1 + (Math.random() * 6 | 0)); die.style.transform = `rotate(${(Math.random() - .5) * 60}deg) scale(1.1)`; await X.wait(70); }
      face(ev.die); die.style.transform = ''; X.an(die, [{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 300 });
      stats(); $('#exR', o).textContent = st.rolls + (ev.roll ? -1 : 0);
      await X.wait(350);
      for (let i = ev.from + 1; i <= ev.to; i++) await hop(i);
      const tEl = $(`.ex-t[data-i="${ev.to}"]`, o); tEl.classList.add('seen'); X.an(tEl, [{ transform: 'translate(-50%,-50%) scale(1.3)' }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 400 });
      if (ev.cash) { float(ev.to, '+◈ ' + X.fk(ev.cash * bet)); X.snd('coin'); }
      else if (ev.roll) { float(ev.to, '+1 lancer', 'r'); X.snd('atl-pearl'); }
      else if (ev.mult) { float(ev.to, 'Multiplicateur ×' + ev.mult, 'x'); X.snd('atl-jp'); }
      else if (ev.back !== undefined) {
        float(ev.to, ev.tile.t === 'k' ? 'Le Kraken ! Recul' : 'Tourbillon ! Recul', 'bad'); X.snd(ev.tile.t === 'k' ? 'atl-kraken' : 'atl-wave');
        await X.wait(700);
        for (let i = ev.to - 1; i >= ev.back; i--) await hop(i, true);
      }
      stats();
      if (ev.wreck) await wreck(ev.wreck);
      if (ev.chest) await chest(ev.chest);
      await X.wait(250);
      if (!st.done) go.disabled = false;
    };
    let busyTurn = false;
    go.addEventListener('click', () => { if (busyTurn || st.done) return; busyTurn = true; X.guard(turn()).finally(() => { busyTurn = false; }); });

    try {
      if (st.pending) await wreck(st.pending.vals);
      else if (st.done && st.gate) { const last = st.log[st.log.length - 1]; if (last && last.chest) await chest(last.chest); }
      if (!st.done) {
        go.disabled = false;
        await new Promise((res, rej) => { const iv = setInterval(() => { if (X.dead()) { clearInterval(iv); rej(X.DEAD); } else if (st.done && !busyTurn) { clearInterval(iv); res(); } }, 120); });
      }
      if (st.gate) unlock('atl_gate');
      const win = r2(ATL.expTotal(st) * bet);
      A.exp = null;
      X.payFeature(win, 0, bet, `Expédition · case ${st.pos + 1}/30${st.gate ? ' · Porte · ' + ATLUI.JPN[st.jp] : ''}${st.mult > 1 ? ' · ×' + st.mult : ''}`);
      await X.wait(400);
      await outro(X, 'L’Expédition', st.gate ? 'La Porte d’Atlantide !' : 'Retour à la surface', win, bet);
      await X.fin(X.an(o, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' })).catch(() => {});
    } finally {
      ro.disconnect(); o.remove();
      if (!X.dead()) { X.spinBtn.disabled = false; X.setScene('base'); X.paintMap(A.map.n); }
    }
  }

  /* ---------- Achat de bonus ---------- */
  function buy(X) {
    const A = X.A, bet = A.bet;
    const price = k => r2(ATL.BUY[k] * bet);
    snd('click');
    const m = modal(`<div class="atl-buy"><h3 class="mt">Achat de bonus</h3><p class="mp">Mise ◈ ${fmt(bet)}. Le bonus démarre immédiatement.</p>
      <div class="atl-bcs">
        <button type="button" class="atl-bc" data-k="fs"><img src="${ATL_ART.src('S')}" alt=""><b>La Tempête de Poséidon</b><span>3 ou 4 conques · vous choisissez la tempête</span><em class="num">◈ ${fmt(price('fs'))}</em><small>${ATL.BUY.fs}× la mise</small></button>
        <button type="button" class="atl-bc" data-k="hs"><img src="${ATL_ART.src('PE')}" alt=""><b>Le Trésor des Abysses</b><span>6 perles au départ · jackpots en jeu</span><em class="num">◈ ${fmt(price('hs'))}</em><small>${ATL.BUY.hs}× la mise</small></button>
      </div>
      <p class="mu2" style="font-size:12px;margin:10px 0 0">Retour théorique de l’achat ≈ 95,9 %. L’achat ne rend pas les gains plus probables qu’au jeu normal : il paie le prix moyen du bonus.</p>
      <button class="btn btn-gold btn-big atl-bok" type="button" disabled>Choisissez un bonus</button>
      <button class="btn btn-ghost btn-big" data-close style="margin-top:8px">Annuler</button></div>`);
    let k = null; const ok = $('.atl-bok', m.el);
    $$('.atl-bc', m.el).forEach(b => b.addEventListener('click', () => {
      k = b.dataset.k; $$('.atl-bc', m.el).forEach(x => x.classList.toggle('on', x === b)); snd('chip');
      ok.disabled = false; ok.textContent = `Acheter pour ◈ ${fmt(price(k))}`;
    }));
    ok.addEventListener('click', () => {
      if (!k || X.dead()) return;
      const p = price(k); if (!canBet(p)) return;
      take(p); rngStart();
      if (k === 'fs') A.queue.push({ t: 'fs', scat: ATL.buyFsScat(rand), bet, cost: p });
      else A.queue.push({ t: 'hs', pearls: ATL.buyHsPearls(rand), bet, cost: p });
      save(); m.close(); X.setWin(0);
      X.startQueue();
    });
  }

  return { chooseMode, fs, hs, exp, buy, MODES };
})();
