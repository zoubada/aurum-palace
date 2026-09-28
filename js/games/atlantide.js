'use strict';
/* ============ Atlantide — l'Éveil de Poséidon (interface) ============
   Le moteur (js/atlantide-engine.js) calcule tout le tour d'avance ; ce
   fichier le rejoue : chute des symboles, courants gagnants, cascades et
   marée, Kraken, vagues de Tridents, perles et fragments de carte.
   Les écrans de bonus (tours gratuits, Trésor des Abysses, Expédition)
   sont dans atlantide-bonus.js et reçoivent le contexte X défini ici.

   Argent et reprise : la mise est prélevée et le résultat du tour est
   enregistré (S.atl.pend) AVANT l'animation. Si la page se ferme en plein
   tour, le gain est crédité au retour. Les bonus déclenchés sont mis en file
   (S.atl.queue) et leur état est sauvegardé après chaque tirage : quitter
   ne fait ni perdre ni rejouer un tirage. */
const ATLUI = (() => {
  const { COLS, ROWS } = ATL;
  const BETS = [1, 2, 5, 10, 20, 40, 50, 100, 200, 400, 500, 1000, 2000, 5000];
  const JPN = { MINI: 'Mini', MINEUR: 'Mineur', MAJEUR: 'Majeur', GRAND: 'Grand' };
  const DEF_ATL = () => ({ bet: 100, turbo: false, map: { n: 0, bs: 0 }, queue: [], fs: null, hs: null, exp: null, pend: null });
  const DEAD = { dead: 1 };
  function state() {
    if (!S.atl || typeof S.atl !== 'object') S.atl = DEF_ATL();
    const d = DEF_ATL();
    for (const k in d) if (S.atl[k] === undefined || S.atl[k] === null && d[k] !== null) S.atl[k] = d[k];
    if (!BETS.includes(S.atl.bet)) S.atl.bet = 100;
    return S.atl;
  }
  /* Montants compacts pour les étiquettes des perles (1,2 k · 15 k · 2,5 M) */
  const fk = n => {
    n = r2(n);
    if (n >= 1e6) return (n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: n >= 1e7 ? 0 : 1 }) + ' M';
    if (n >= 1e4) return (n / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: n >= 1e5 ? 0 : 1 }) + ' k';
    return fmt(n);
  };

  Object.assign(ACH, {
    atl_fs: { n: 'Tempête de Poséidon', d: 'Déclenche les tours gratuits d’Atlantide', i: '🔱' },
    atl_hs: { n: 'Trésor des Abysses', d: 'Ouvre le Trésor des perles d’Atlantide', i: '🦪' },
    atl_x12: { n: 'Marée d’équinoxe', d: 'Atteins la marée ×12 au jeu de base d’Atlantide', i: '🌊' },
    atl_gate: { n: 'La Porte d’Atlantide', d: 'Termine une Expédition à la Porte', i: '🗺️' },
    atl_grand: { n: 'Grand Jackpot', d: 'Remporte le Grand Jackpot d’Atlantide', i: '👑' },
  });

  /* ---------- Icônes du tableau de bord ---------- */
  const I = {
    spin: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6v8M24 6l-4 5M24 6l4 5" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M37.5 16.5A16 16 0 1 1 24 8" stroke="currentColor" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M38 9v8h-8" stroke="currentColor" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 17v14M19 19v5q0 3 5 3t5-3v-5" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>',
    turbo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor"/></svg>',
    buy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c-3 4-7 5-7 10a7 7 0 0 0 14 0c0-5-4-6-7-10z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9.5 14.5a2.5 2.5 0 0 0 5 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="1.4" opacity=".6"/><path d="M11 12l2 2m0-2-2 2" stroke="#FF6B5B" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };

  /* ---------- Décor : ruines englouties (silhouettes) ---------- */
  const RUINS = `<svg class="atl-ruins" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id="arF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B4660" stop-opacity=".0"/><stop offset=".45" stop-color="#0A3D55" stop-opacity=".55"/><stop offset="1" stop-color="#03141F" stop-opacity=".95"/></linearGradient>
    <linearGradient id="arN" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#062C3E" stop-opacity=".3"/><stop offset="1" stop-color="#010A11"/></linearGradient></defs>
    <g fill="url(#arF)">
      <path d="M330 600V330l170-70 170 70v270z"/><path d="M345 330h310v14H345z"/>
      ${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${362 + i * 52}" y="350" width="22" height="250" rx="3"/>`).join('')}
      <path d="M470 250h60v-40l-30-28-30 28z"/><circle cx="500" cy="236" r="9" fill="#5FE3FF" opacity=".35"/>
      <path d="M90 600V420q0-40 40-40t40 40v180h-20V430q0-22-20-22t-20 22v170z"/>
      <path d="M800 600V400h18v200zM850 600V446l18-10v164zM900 600V380h18v220z"/>
      <path d="M205 600V468l14-4 4 12 10-6v130z"/>
    </g>
    <g fill="url(#arN)">
      <path d="M0 600V520q60-30 120-8t140-14 150 22 160-18 170 20 140-16 110 10V600z"/>
    </g>
    <g class="atl-weed" fill="none" stroke-linecap="round">
      <path d="M60 600q-18-60 6-120t-8-120" stroke="#0E5A48" stroke-width="10" opacity=".7"/>
      <path d="M90 600q20-50-4-100t10-90" stroke="#0B4A3C" stroke-width="7" opacity=".7"/>
      <path d="M940 600q-20-70 6-130t-10-110" stroke="#0E5A48" stroke-width="10" opacity=".7"/>
      <path d="M905 600q16-40-6-86t8-70" stroke="#0B4A3C" stroke-width="7" opacity=".7"/>
      <path d="M270 600q-12-40 4-80" stroke="#0E5A48" stroke-width="6" opacity=".6"/>
      <path d="M735 600q14-46-4-92" stroke="#0E5A48" stroke-width="6" opacity=".6"/>
    </g>
  </svg>`;

  /* ---------- Ambiance : bulles et plancton (canvas léger, pausé hors écran) ---------- */
  function ambient(cv) {
    const ctx = cv.getContext('2d'); let W = 0, H = 0, raf = 0, on = true, last = 0;
    const P = [];
    const size = () => { const d = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    size();
    for (let i = 0; i < 70; i++) {
      const b = i < 26;
      P.push({ b, x: Math.random() * W, y: Math.random() * H, r: b ? 1.2 + Math.random() * 3.4 : .5 + Math.random() * 1.3, v: b ? .25 + Math.random() * .7 : .05 + Math.random() * .15, w: Math.random() * 6.28, ws: .01 + Math.random() * .02, a: b ? .25 + Math.random() * .35 : .2 + Math.random() * .5 });
    }
    function frame(t) {
      raf = requestAnimationFrame(frame);
      if (t - last < 30) return; // ~30 i/s : largement assez pour un décor lent
      const dt = Math.min(3, (t - last) / 16.7 || 1); last = t;
      ctx.clearRect(0, 0, W, H);
      for (const p of P) {
        p.w += p.ws * dt; p.y -= p.v * dt; p.x += Math.sin(p.w) * (p.b ? .35 : .15) * dt;
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        if (p.b) {
          ctx.globalAlpha = p.a; ctx.strokeStyle = '#BFF6FF'; ctx.lineWidth = .9;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.stroke();
          ctx.globalAlpha = p.a * .8; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x - p.r * .35, p.y - p.r * .35, p.r * .28, 0, 6.283); ctx.fill();
        } else {
          ctx.globalAlpha = p.a * (.6 + .4 * Math.sin(p.w * 3)); ctx.fillStyle = '#9FF3FF';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    const vis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (on && !raf && !REDUCED) raf = requestAnimationFrame(frame); };
    document.addEventListener('visibilitychange', vis);
    if (!REDUCED) raf = requestAnimationFrame(frame); else frame(40);
    return { size, stop() { on = false; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis); } };
  }

  /* ---------- Effets : particules (bulles, éclats, pièces) ---------- */
  function fxLayer(cv) {
    const ctx = cv.getContext('2d'); let W = 0, H = 0, raf = 0, P = [];
    const size = () => { const d = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    size();
    function loop() {
      ctx.clearRect(0, 0, W, H);
      P = P.filter(p => p.life > 0);
      for (const p of P) {
        p.life -= 1; p.vy += p.g; p.vx *= .985; p.vy *= .985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        const k = Math.min(1, p.life / p.max * 1.6);
        ctx.globalAlpha = k;
        if (p.t === 'b') { ctx.strokeStyle = p.c; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.stroke(); }
        else if (p.t === 's') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
          const s = p.s; ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s); ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s); ctx.fill(); ctx.restore();
        } else if (p.t === 'c') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.scale(Math.max(.2, Math.abs(Math.cos(p.rot))), 1);
          const g = ctx.createRadialGradient(-p.s * .3, -p.s * .3, 1, 0, 0, p.s); g.addColorStop(0, '#FFF6C8'); g.addColorStop(.6, '#E2B43E'); g.addColorStop(1, '#8A5A0B');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 6.283); ctx.fill(); ctx.restore();
        } else { ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      raf = P.length ? requestAnimationFrame(loop) : 0;
      if (!raf) ctx.clearRect(0, 0, W, H);
    }
    function add(p) { if (REDUCED) return; P.push(p); if (P.length > 700) P.splice(0, P.length - 700); if (!raf) raf = requestAnimationFrame(loop); }
    function burst(x, y, c, n = 14, o = {}) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, v = (o.v || 3) * (.4 + Math.random());
        const t = o.t || (i % 3 === 0 ? 'b' : i % 3 === 1 ? 's' : 'd');
        add({ t, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0), g: o.g ?? (t === 'b' ? -.06 : .06), s: t === 'b' ? 2 + Math.random() * 4 : t === 'c' ? 5 + Math.random() * 5 : 1.5 + Math.random() * 3, c: t === 'b' ? '#CFF8FF' : c, life: 40 + Math.random() * 30 | 0, max: 70, rot: Math.random() * 6, vr: (Math.random() - .5) * .3 });
      }
    }
    function rain(n, W0) { for (let i = 0; i < n; i++) add({ t: 'c', x: Math.random() * (W0 || W), y: -20 - Math.random() * 200, vx: (Math.random() - .5) * 2, vy: 2 + Math.random() * 3, g: .12, s: 6 + Math.random() * 6, life: 150, max: 150, rot: Math.random() * 6, vr: .15 + Math.random() * .2 }); }
    return { size, burst, rain, stop() { cancelAnimationFrame(raf); P = []; } };
  }

  /* ---------- Gabarit ---------- */
  const TPL = () => `<div class="atl" id="atl">
    <div class="atl-scene" aria-hidden="true">
      <div class="atl-bg"${ATL_IMG.bg ? ` style="background-image:url('${ATL_IMG.bg}')"` : ''}></div>
      <div class="atl-rays"></div>${ATL_IMG.bg ? '' : RUINS}
      <canvas class="atl-amb"></canvas><div class="atl-flash"></div>
    </div>
    <div class="atl-main">
      <div class="atl-head">
        <button class="atl-cb" id="aexit" type="button" aria-label="Quitter le plein écran">${ic('compress', 17)}</button>
        <div class="atl-logo">${ATL_IMG.logo ? `<img src="${ATL_IMG.logo}" alt="Atlantide">` : '<small>L’Éveil de Poséidon</small><b>Atlantide</b>'}</div>
        <div class="atl-jps">${['GRAND', 'MAJEUR', 'MINEUR', 'MINI'].map(j => `<div class="atl-jp j-${j}" data-j="${j}"><span>${JPN[j]}</span><b class="num"></b></div>`).join('')}</div>
        <button class="atl-cb r" id="ainfo" type="button" aria-label="Règles et historique">${I.info}</button>
      </div>
      <div class="atl-fbar" id="afbar"></div>
      <div class="atl-mid">
        <div class="atl-tide" id="atide" aria-label="Marée : multiplicateur de cascade">
          <span class="atl-tl">Marée</span>
          ${ATL.LADDER.map((m, i) => `<i data-i="${i}">×${m}</i>`).join('')}
          <b class="atl-tA">×2</b>
        </div>
        <div class="atl-bw" id="abw">
          <div class="atl-board" id="aboard">
            <div class="atl-frame"${ATL_IMG.frame ? ` style="background-image:url('${ATL_IMG.frame}')"` : ''}></div>
            <div class="atl-reels" id="areels">
              ${Array.from({ length: COLS }, (_, c) => `<div class="atl-col" style="--c:${c}"></div>`).join('')}
              <div class="atl-cells" id="acells"></div>
              <svg class="atl-lines" id="alines" viewBox="0 0 600 500" preserveAspectRatio="none"></svg>
            </div>
            <div class="atl-bov" id="abov"></div>
          </div>
        </div>
        <div class="atl-map" id="amap" title="Fragments de carte : 18 déclenchent l’Expédition">
          <span class="atl-mi">${I.map}</span>
          <span class="atl-mb"><i id="amapf"></i></span>
          <b class="num" id="amapn">0/18</b>
        </div>
      </div>
      <div class="atl-msg" id="amsg" aria-live="polite"></div>
    </div>
    <div class="atl-dock">
      <div class="ad-val ad-bal"><span>Solde</span><b class="num" id="abal"></b></div>
      <button class="ad-btn ad-buy" id="abuy" type="button">${I.buy}<span>Achat</span></button>
      <div class="ad-bet"><button type="button" id="abm" aria-label="Baisser la mise">−</button><button type="button" class="ad-bv" id="abv" aria-label="Choisir la mise"><span>Mise</span><b class="num"></b></button><button type="button" id="abp" aria-label="Augmenter la mise">+</button></div>
      <button class="ad-spin" id="spin" type="button" aria-label="Lancer">${I.spin}<em id="aspinN"></em></button>
      <button class="ad-btn ad-auto" id="aauto" type="button">${I.auto}<span>Auto</span></button>
      <button class="ad-btn ad-turbo" id="aturbo" type="button" aria-pressed="false">${I.turbo}<span>Turbo</span></button>
      <div class="ad-val ad-win"><span>Gain</span><b class="num" id="awin">0</b></div>
    </div>
    <canvas class="atl-fx" id="afx" aria-hidden="true"></canvas>
    <div class="atl-layer" id="alayer"></div>
  </div>`;

  function init(stage) {
    const A = state();
    const gx = stage.closest('.gx'); gx.classList.add('gx-atl');
    stage.innerHTML = TPL();
    const root = $('#atl', stage), q = s => $(s, root);
    const reels = q('#areels'), cellsEl = q('#acells'), linesEl = q('#alines'), bw = q('#abw'), board = q('#aboard'),
      bov = q('#abov'), layer = q('#alayer'), msgEl = q('#amsg'), fbar = q('#afbar'), tideEl = q('#atide'),
      spinBtn = q('#spin'), autoBtn = q('#aauto'), turboBtn = q('#aturbo'), buyBtn = q('#abuy'), winEl = q('#awin');
    const amb = ambient(q('.atl-amb')), fx = fxLayer(q('#afx'));
    let dead = false, busy = false, hurry = false, auto = 0, cs = 60, featBusy = false, cur = null;
    const els = new Map(), anims = new Set(), timers = new Set();

    /* ---------- Temps : turbo, accélération (toucher pendant un tour) ---------- */
    const SP = () => (REDUCED ? .35 : 1) * (A.turbo ? .5 : 1) * (hurry ? .3 : 1);
    function an(el, kf, o = {}) {
      const a = el.animate(kf, { duration: Math.max(1, (o.duration || 300) * SP()), delay: (o.delay || 0) * SP(), easing: o.easing || 'ease', fill: o.fill || 'backwards', iterations: o.iterations || 1 });
      anims.add(a); a.finished.then(() => anims.delete(a), () => anims.delete(a));
      return a;
    }
    const fin = a => a.finished.then(() => { if (dead) throw DEAD; }, () => { if (dead) throw DEAD; });
    function wait(ms) {
      return new Promise((res, rej) => {
        let p = 0, last = performance.now();
        const f = now => { if (dead) return rej(DEAD); p += (now - last) / SP(); last = now; if (p >= ms) res(); else requestAnimationFrame(f); };
        requestAnimationFrame(f);
      });
    }
    const later = (ms, fn) => { wait(ms).then(fn, () => {}); };
    function speedUp() { if (hurry) return; hurry = true; for (const a of anims) try { a.updatePlaybackRate(3.3); } catch (e) {} }
    const guard = p => p.catch(e => { if (e !== DEAD) console.error(e); });

    /* ---------- Mise en page : taille de case calculée sur la place disponible ---------- */
    function fit() {
      if (dead) return;
      const W = root.clientWidth, H = root.clientHeight; if (!W || !H) return;
      root.classList.toggle('land', W > H * 1.12 && W >= 560);
      root.classList.toggle('short', H < 560);
      root.classList.toggle('tiny', H < 400);
      const r = bw.getBoundingClientRect();
      const side = root.classList.contains('land') ? 2 * Math.min(100, Math.max(70, r.width * .09)) : 0;
      /* Diviseurs alignés sur l'encombrement réel du cadre illustré (bien plus large
         que les rouleaux) pour qu'il ne soit jamais rogné par .atl-bw{overflow:hidden}. */
      const n = Math.max(24, Math.floor(Math.min((r.width - 4 - side) / 9.75, (r.height - 4) / 8.75)));
      if (n !== cs || !root.style.getPropertyValue('--cs')) { cs = n; root.style.setProperty('--cs', cs + 'px'); }
      amb.size(); fx.size();
    }
    let fitRaf = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fit); });
    ro.observe(root); ro.observe(bw);

    /* ---------- Cases ---------- */
    const cellHTML = (x, bet) => `<img src="${ATL_ART.src(x.k)}" alt="" draggable="false">` +
      (x.k === 'W' && x.m > 1 ? `<span class="ab-m">×${x.m}</span>` : '') +
      (x.k === 'PE' ? `<span class="ab-v${x.jp ? ' jp j-' + x.jp : ''}">${x.jp ? JPN[x.jp] : fk(x.v * bet)}</span>` : '');
    let shownBet = A.bet;
    function mk(x) {
      const e = document.createElement('div');
      e.className = 'ac k-' + x.k + (x.k === 'W' && x.m > 1 ? ' wm' : '');
      e.style.setProperty('--kc', ATL_COL[x.k] || '#fff');
      e.innerHTML = cellHTML(x, shownBet);
      els.set(x.id, e); cellsEl.appendChild(e); return e;
    }
    function place(e, c, r) { e.dataset.c = c; e.dataset.r = r; e.style.setProperty('--c', c); e.style.setProperty('--r', r); }
    const elAt = (c, r) => cur && cur[c] && cur[c][r] ? els.get(cur[c][r].id) : null;
    function drop(id) { const e = els.get(id); if (e) { e.remove(); els.delete(id); } }
    /* Aligne l'affichage sur une grille, sans animation (reprise, sécurité) */
    function sync(g) {
      const keep = new Set();
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) { const x = g[c][r]; keep.add(x.id); const e = els.get(x.id) || mk(x); place(e, c, r); e.classList.remove('win', 'gone', 'taken'); }
      for (const [id] of els) if (!keep.has(id)) drop(id);
      cur = g.map(col => col.slice());
    }
    function cellCenter(c, r) {
      const R = reels.getBoundingClientRect(), O = root.getBoundingClientRect();
      return [R.left - O.left + (c + .5) * cs, R.top - O.top + (r + .5) * cs];
    }
    const rectIn = el => { const a = el.getBoundingClientRect(), o = root.getBoundingClientRect(); return { x: a.left - o.left, y: a.top - o.top, w: a.width, h: a.height }; };

    /* Chute : départ décalé vers le haut, arrivée avec un léger rebond */
    const fallKF = dy => [
      { transform: `translateY(${dy}px)`, easing: 'cubic-bezier(.5,0,.9,.5)' },
      { transform: 'translateY(0)', offset: .76, easing: 'cubic-bezier(.2,.6,.4,1)' },
      { transform: `translateY(${-cs * .07}px)`, offset: .88, easing: 'ease-in' },
      { transform: 'translateY(0)' }];

    /* Anime l'affichage vers la grille g : les cases existantes tombent à leur
       nouvelle place, les nouvelles arrivent du haut. */
    function animateTo(g, o = {}) {
      const ps = [];
      for (let c = 0; c < COLS; c++) {
        let nNew = 0; for (let r = 0; r < ROWS; r++) if (!els.has(g[c][r].id)) nNew++;
        const cd = o.colDelay ? o.colDelay(c) : c * 34;
        for (let r = ROWS - 1; r >= 0; r--) {
          const x = g[c][r]; let e = els.get(x.id);
          if (e) {
            const r0 = +e.dataset.r;
            if (r0 !== r) { place(e, c, r); ps.push(fin(an(e, fallKF((r0 - r) * cs), { duration: 230 + 55 * (r - r0), delay: cd }))); }
          } else {
            e = mk(x); place(e, c, r);
            if (x.hide) e.style.opacity = 0;
            const from = o.from || nNew;
            ps.push(fin(an(e, fallKF(-(from + (o.gap || 0)) * cs), { duration: (o.dur || 240) + 45 * from, delay: cd + (ROWS - 1 - r) * (o.rowGap ?? 18) })));
          }
        }
      }
      cur = g.map(col => col.slice());
      return Promise.all(ps);
    }

    async function dropOut() {
      clearLines();
      if (!els.size) return;
      const ps = [];
      for (const [id, e] of els) {
        const c = +e.dataset.c, r = +e.dataset.r;
        ps.push(fin(an(e, [{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${(ROWS - r + .6) * cs}px)`, opacity: .15 }], { duration: 250, delay: c * 30, easing: 'cubic-bezier(.55,0,1,.45)', fill: 'forwards' })));
      }
      await Promise.all(ps);
      for (const [id] of els) drop(id);
      cur = null;
    }

    /* Arrivée de la grille, rouleau par rouleau ; suspense quand 2 conques sont déjà là */
    async function dropIn(g) {
      const colT = []; let t = 0, scat = 0, antic = false;
      for (let c = 0; c < COLS; c++) {
        if (scat >= 2 && !antic) antic = true;
        t += c === 0 ? 0 : antic ? 620 : 62;
        colT.push({ t, antic });
        for (let r = 0; r < ROWS; r++) if (g[c][r].k === 'S') scat++;
      }
      const cols = $$('.atl-col', reels);
      colT.forEach((x, c) => {
        if (x.antic) later(Math.max(0, x.t - 620), () => { cols[c].classList.add('antic'); snd('atl-antic'); });
        later(x.t + 300, () => { cols[c].classList.remove('antic'); snd('atl-drop'); });
      });
      await animateTo(g, { colDelay: c => colT[c].t, from: ROWS, gap: .4, dur: 250, rowGap: 22 });
      cols.forEach(e => e.classList.remove('antic'));
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (g[c][r].k === 'S') { const e = els.get(g[c][r].id); e && an(e, [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 420 }); }
    }

    /* ---------- Courants gagnants (SVG) ---------- */
    function clearLines() { linesEl.innerHTML = ''; cellsEl.classList.remove('dim'); for (const [, e] of els) e.classList.remove('win'); }
    function drawLines(wins) {
      let out = '';
      wins.forEach((w, wi) => {
        const pts = [];
        for (let c = 0; c < w.len; c++) { const rs = w.rows[c]; pts.push([c * 100 + 50, rs.reduce((a, r) => a + r, 0) / rs.length * 100 + 50]); }
        let d = `M${pts[0][0] - 44} ${pts[0][1]}L${pts[0][0]} ${pts[0][1]}`;
        for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2; d += `C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`; }
        const L = pts[pts.length - 1]; d += `L${L[0] + 44} ${L[1]}`;
        let br = '', dots = '';
        for (let c = 0; c < w.len; c++) for (const r of w.rows[c]) {
          const y = r * 100 + 50, x = c * 100 + 50;
          if (Math.abs(y - pts[c][1]) > 1) br += `M${x} ${pts[c][1]}L${x} ${y}`;
          dots += `<circle cx="${x}" cy="${y}" r="9"/>`;
        }
        out += `<g class="wl" style="--lc:${ATL_COL[w.k]};--ld:${wi * 110}ms"><path class="wl-g" d="${d}${br}"/><path class="wl-b" d="${br || 'M0 0'}"/><path class="wl-c" d="${d}" pathLength="1"/><path class="wl-f" d="${d}" pathLength="1"/><g class="wl-d">${dots}</g></g>`;
      });
      linesEl.innerHTML = out;
    }

    /* ---------- Messages, montants, bandeaux ---------- */
    let msgT = 0;
    function msg(html, cls = '') { msgEl.className = 'atl-msg ' + cls; msgEl.innerHTML = html; clearTimeout(msgT); }
    function amount(v, mult) {
      const e = h(`<div class="atl-amt"><b class="num">+ ◈ ${fmt(v)}</b>${mult > 1 ? `<i>Marée ×${mult}</i>` : ''}</div>`);
      bov.appendChild(e);
      an(e, [{ opacity: 0, transform: 'translate(-50%,-30%) scale(.6)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.08)', offset: .25 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: .8 }, { opacity: 0, transform: 'translate(-50%,-70%) scale(.96)' }], { duration: 1150, fill: 'forwards' }).finished.then(() => e.remove(), () => e.remove());
    }
    async function banner(title, sub = '', o = {}) {
      const e = h(`<div class="atl-ban ${o.cls || ''}"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div>`);
      bov.appendChild(e);
      const a = an(e, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.5)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.06)', offset: .18 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: .85 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.1)' }], { duration: o.dur || 1700, fill: 'forwards' });
      try { await fin(a); } finally { e.remove(); }
    }
    function setWin(v) { winEl.textContent = fmt(v); winEl.parentNode.classList.toggle('on', v > 0); }

    /* ---------- Marée ---------- */
    function setTide(i, mode, mult) {
      root.classList.toggle('tideA', mode === 'A');
      if (mode === 'A') { const b = q('.atl-tA'); if (b.textContent !== '×' + mult) { b.textContent = '×' + mult; if (i >= 0) an(b, [{ transform: 'scale(1.35)', color: '#fff' }, { transform: 'scale(1)' }], { duration: 420 }); } return; }
      $$('i', tideEl).forEach((e, k) => { e.classList.toggle('on', k === Math.min(i, ATL.LADDER.length - 1)); e.classList.toggle('past', i >= 0 && k < Math.min(i, ATL.LADDER.length - 1)); });
      if (i > 0) { const e = $(`i[data-i="${Math.min(i, ATL.LADDER.length - 1)}"]`, tideEl); an(e, [{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 380 }); }
    }

    /* ---------- Étapes d'un tour ---------- */
    async function showWins(s, bet, i) {
      cellsEl.classList.add('dim');
      const seen = new Set();
      for (const w of s.wins) for (let c = 0; c < w.len; c++) for (const r of w.rows[c]) {
        const x = s.before[c][r], e = els.get(x.id); if (!e || seen.has(x.id)) continue; seen.add(x.id);
        e.classList.add('win'); if (x.k !== 'W') e.style.setProperty('--kc', ATL_COL[w.k]);
      }
      drawLines(s.wins);
      snd(i ? 'atl-casc' : 'atl-win');
      amount(r2(s.win * bet), s.mult);
      const top = s.wins.slice().sort((a, b) => b.pay - a.pay)[0];
      msg(`<b>${ATL.NAMES[top.k]}</b> · ${top.len} rouleaux · ${top.ways} voie${top.ways > 1 ? 's' : ''}${top.wmult > 1 ? ` · Trident ×${top.wmult}` : ''}${s.wins.length > 1 ? ` <em>+${s.wins.length - 1} combinaison${s.wins.length > 2 ? 's' : ''}</em>` : ''}`, 'w');
      await wait(s.wins.length > 2 ? 1150 : 950);
    }
    async function burst(s) {
      const ps = [];
      for (const i of s.rm) {
        const c = Math.floor(i / ROWS), r = i % ROWS, x = s.before[c][r], e = els.get(x.id); if (!e) continue;
        const [px, py] = cellCenter(c, r); fx.burst(px, py, ATL_COL[x.k] || '#fff', 9);
        e.classList.add('gone');
        ps.push(fin(an(e, [{ transform: 'scale(1)', opacity: 1, filter: 'brightness(1)' }, { transform: 'scale(1.2)', opacity: 1, filter: 'brightness(1.8)', offset: .35 }, { transform: 'scale(.2)', opacity: 0, filter: 'brightness(2)' }], { duration: 340, delay: c * 22, fill: 'forwards' })).then(() => drop(x.id)));
      }
      snd('atl-pop');
      await Promise.all(ps);
      clearLines();
    }
    /* Chute après une cascade. En mode B, les cases que la vague va recouvrir
       sont d'abord remplies de symboles « de passage » (décor), puis la vague les
       transforme en Tridents : le joueur voit tomber puis déferler. */
    async function collapse(s) {
      const expRows = {};
      if (s.expand) for (const e of s.expand) expRows[e.c] = new Set(e.rows);
      const rm = new Set(s.rm), mid = [];
      for (let c = 0; c < COLS; c++) {
        const surv = []; for (let r = 0; r < ROWS; r++) if (!rm.has(c * ROWS + r)) surv.push(s.before[c][r]);
        const k = ROWS - surv.length, col = [];
        for (let r = 0; r < ROWS; r++) {
          if (r >= k) col.push(surv[r - k]);
          else { const x = s.after[c][r]; col.push(expRows[c] && expRows[c].has(r) ? { id: 'p' + x.id, k: ATL.PAY_SYMS[5 + (Math.random() * 6 | 0)] } : x); }
        }
        mid.push(col);
      }
      await animateTo(mid, { rowGap: 16 });
      snd('atl-drop');
    }
    async function wave(list, g) {
      snd('atl-wave');
      const ps = [];
      for (const e of list) {
        const w = h(`<div class="atl-wave" style="--c:${e.c}"></div>`); reels.appendChild(w);
        ps.push(fin(an(w, [{ transform: 'translateY(105%)', opacity: .9 }, { transform: 'translateY(-105%)', opacity: .9 }], { duration: 720, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' })).finally(() => w.remove()));
        const src = elAt(e.c, e.src); if (src) an(src, [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 500 });
        for (const r of e.rows) {
          const old = cur[e.c][r], x = g[e.c][r];
          later(120 + (ROWS - 1 - r) * 90, () => {
            drop(old.id);
            if (els.has(x.id)) return;
            const ne = mk(x); place(ne, e.c, r);
            an(ne, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: .6 }, { transform: 'scale(1)', opacity: 1 }], { duration: 300 });
            const [px, py] = cellCenter(e.c, r); fx.burst(px, py, '#9FF6FF', 6, { t: 'b' });
          });
          cur[e.c][r] = x;
        }
      }
      await Promise.all(ps);
      await wait(120);
      sync(g);
    }
    /* Le Kraken : les tentacules surgissent, l'encre se répand et des Tridents se plantent */
    async function kraken(placed, big) {
      snd('atl-kraken');
      root.classList.add('krak');
      const k = h(`<div class="atl-krak">${ATL_IMG.kraken ? `<img src="${ATL_IMG.kraken}" alt="">` : KRAKEN_SVG}</div>`); bov.appendChild(k);
      an(board, [{ transform: 'translate(0,0)' }, { transform: 'translate(-4px,2px)' }, { transform: 'translate(5px,-2px)' }, { transform: 'translate(-3px,1px)' }, { transform: 'translate(0,0)' }], { duration: 420, iterations: 2 });
      await fin(an(k, [{ transform: 'translateY(60%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }));
      if (big) msg(`<b>Le Kraken frappe !</b> ${placed.length} Tridents`, 'k');
      else msg(`<b>Le Kraken s’éveille !</b> ${placed.length} Tridents sauvages`, 'k');
      for (const p of placed) {
        const old = cur[p.c][p.r]; drop(old.id);
        const x = { id: p.id, k: 'W', m: p.m }, e = mk(x); place(e, p.c, p.r); e.classList.add('kr');
        an(e, [{ transform: 'scale(2) rotate(-25deg)', opacity: 0 }, { transform: 'scale(.9) rotate(4deg)', opacity: 1, offset: .7 }, { transform: 'scale(1) rotate(0)', opacity: 1 }], { duration: 380 });
        const [px, py] = cellCenter(p.c, p.r); fx.burst(px, py, '#6B2FA0', 12, { t: 'd' }); fx.burst(px, py, '#9FF6FF', 5, { t: 'b' });
        cur[p.c][p.r] = x; snd('atl-splash');
        await wait(170);
      }
      await wait(260);
      await fin(an(k, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(70%)', opacity: 0 }], { duration: 420, fill: 'forwards' }));
      k.remove(); root.classList.remove('krak');
    }

    /* ---------- Fragments de carte ---------- */
    function paintMap(n) {
      const need = ATL.P.frag.need;
      q('#amapn').textContent = n + '/' + need;
      q('#amapf').style.setProperty('--p', Math.min(1, n / need));
      q('#amap').classList.toggle('full', n >= need);
    }
    async function fragsFly(cells, from) {
      const tgt = rectIn(q('.atl-mi')); let n = from; const need = ATL.P.frag.need;
      const ps = cells.map(([c, r], i) => {
        const e = elAt(c, r); if (!e) return Promise.resolve();
        const a = rectIn(e), f = h(`<img class="atl-fly" src="${ATL_ART.src('FR')}" alt="">`);
        f.style.cssText = `left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px`;
        root.appendChild(f); e.classList.add('taken');
        const dx = tgt.x + tgt.w / 2 - (a.x + a.w / 2), dy = tgt.y + tgt.h / 2 - (a.y + a.h / 2);
        return fin(an(f, [{ transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 }, { transform: `translate(${dx * .45}px,${dy * .45 - 60}px) scale(.8) rotate(160deg)`, opacity: 1, offset: .5 }, { transform: `translate(${dx}px,${dy}px) scale(.28) rotate(360deg)`, opacity: .9 }], { duration: 760, delay: i * 140, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' })).then(() => {
          f.remove(); n++; snd('atl-frag');
          paintMap(n >= need ? need : n);
          an(q('#amap'), [{ transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 300 });
          if (n >= need) n -= need;
        });
      });
      await Promise.all(ps);
      if (!A.queue.some(t => t.t === 'exp')) paintMap(A.map.n);
    }

    /* ---------- Rejouer un tour complet (jeu de base ou tour gratuit) ---------- */
    async function playSpin(res, o) {
      const bet = o.bet; shownBet = bet;
      if (res.mode === 'A') setTide(-1, 'A', o.tide0);
      else { root.classList.remove('tideA'); $$('i', tideEl).forEach(e => e.classList.remove('on', 'past')); }
      await dropOut();
      await dropIn(res.grid0);
      if (res.kraken) await kraken(res.kraken, res.mode === 'C');
      if (res.expand0) await wave(res.expand0, res.steps.length ? res.steps[0].before : res.grid);
      let acc = o.acc0 || 0;
      for (let i = 0; i < res.steps.length; i++) {
        const s = res.steps[i];
        setTide(i, res.mode, s.mult);
        await showWins(s, bet, i);
        acc = r2(acc + s.win * bet); setWin(acc);
        await burst(s);
        await collapse(s);
        if (s.expand) await wave(s.expand, s.after);
        else sync(s.after);
        if (res.mode !== 'A' && i === 5 && !o.fs) unlock('atl_x12');
      }
      sync(res.grid);
      /* Fin de cascade : conques, perles, fragments */
      if (res.scat >= 2) {
        for (const [c, r] of res.scats) { const e = elAt(c, r); if (e) { e.classList.add('glow'); an(e, [{ transform: 'scale(1)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1)' }], { duration: 520, iterations: res.scat >= 3 ? 2 : 1 }); } }
        if (res.scat >= 3) {
          snd('atl-scat');
          for (const [c, r] of res.scats) { const [px, py] = cellCenter(c, r); fx.burst(px, py, '#FF9EC4', 16); }
          if (res.scatWin > 0) { acc = r2(acc + res.scatWin * bet); setWin(acc); amount(r2(res.scatWin * bet), 1); }
          msg(o.fs ? `<b>${res.scat} conques !</b> Tours supplémentaires` : `<b>${res.scat} conques !</b> La Tempête de Poséidon approche`, 'b');
          await wait(1400);
        }
      }
      if (res.pearls.length && !o.fs) {
        for (const p of res.pearls) { const e = elAt(p.c, p.r); if (e) { e.classList.add('glow'); an(e, [{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 480 }); } }
        if (res.hsTrig) { snd('atl-pearl'); msg(`<b>${res.pearls.length} perles !</b> Le Trésor des Abysses s’ouvre`, 'b'); await wait(1300); }
      }
      if (res.frags && !o.fs) await fragsFly(res.fragCells, o.map0);
      return acc;
    }

    /* ---------- Grosse victoire : paliers qui montent pendant le décompte ---------- */
    const TIERS = [[10, 'Gros gain'], [25, 'Super gain'], [50, 'Méga gain'], [100, 'Gain épique'], [500, 'Légendaire']];
    function bigWinFx(win, mult, head) {
      return new Promise(res => {
        const top = TIERS.filter(t => mult >= t[0]).length - 1;
        const dur = (1800 + top * 1100) * (A.turbo ? .6 : 1);
        const o = h(`<div class="atl-big t${top}" role="dialog" aria-label="Gros gain"><div class="atl-big-in">${head ? `<small>${head}</small>` : ''}<h2>${TIERS[0][1]}</h2><b class="num">◈ 0</b><i>×${fmt(mult)}</i><span>Touchez pour continuer</span></div></div>`);
        layer.appendChild(o);
        const t2 = $('h2', o), nb = $('b', o); let tier = 0, t0 = performance.now(), done = false, raf = 0;
        snd('big'); fx.rain(40, root.clientWidth); confetti(50, true);
        const step = t => {
          if (dead) return res();
          const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 2.2), v = win * e;
          nb.textContent = '◈ ' + fmt(k < 1 ? Math.round(v) : win);
          const m = v / win * mult; let nt = tier; while (nt < top && m >= TIERS[nt + 1][0]) nt++;
          if (nt !== tier) { tier = nt; t2.textContent = TIERS[tier][1]; o.className = 'atl-big t' + tier; snd('big'); fx.rain(30, root.clientWidth); an(t2, [{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 420 }); }
          if (k < 1) raf = requestAnimationFrame(step); else if (!done) { done = true; t2.textContent = TIERS[top][1]; o.className = 'atl-big t' + top + ' end'; setTimeout(close, 2200); }
        };
        raf = requestAnimationFrame(step);
        let closed = false;
        function close() { if (closed) return; closed = true; cancelAnimationFrame(raf); o.classList.add('out'); setTimeout(() => { o.remove(); res(); }, 260); }
        o.addEventListener('click', () => { if (!done) { t0 = -1e9; } else close(); });
      });
    }

    /* ---------- Argent ---------- */
    function settle() {
      const p = A.pend; if (!p) return;
      A.pend = null;
      if (p.win > 0) give(p.win);
      record('atlantide', p.bet, p.win, p.info, { quiet: true });
      save();
    }
    function infoOf(res) {
      const t = [];
      if (res.cascades > 1) t.push(res.cascades + ' cascades');
      if (res.kraken) t.push('Kraken');
      if (res.fsTrig) t.push(res.fsTrig + ' conques');
      if (res.hsTrig) t.push(res.pearls.length + ' perles');
      if (res.frags) t.push(res.frags + ' fragment' + (res.frags > 1 ? 's' : ''));
      return t.join(' · ');
    }
    /* Paie une fin de bonus et l'inscrit à l'historique (ref : mise de référence du multiplicateur) */
    function payFeature(win, cost, bet, info) {
      win = r2(win);
      if (win > 0) give(win);
      record('atlantide', cost, win, info, { quiet: true, ref: cost || bet });
      save();
    }

    /* ---------- Jeu de base ---------- */
    async function spinBase() {
      if (busy) { speedUp(); return; }
      if (A.queue.length || A.fs || A.hs || A.exp) return runQueue();
      const bet = A.bet;
      if (!canBet(bet)) { stopAuto(); return; }
      busy = true; hurry = false; paint();
      try {
        take(bet); rngStart();
        const dv = ATL.dev; const opts = { mode: 'base' };
        if (dv.grid) { opts.grid = dv.grid; dv.grid = null; }
        if (dv.kraken) { opts.kraken = true; dv.kraken = false; }
        const res = ATL.spin(opts, rand);
        const win = r2(res.total * bet), map0 = A.map.n;
        /* Tout ce que le tour rapporte est acquis ici, avant l'animation */
        A.pend = { bet, win, info: infoOf(res) };
        if (res.hsTrig) A.queue.push({ t: 'hs', pearls: res.pearls, bet, cost: 0 });
        if (res.fsTrig) A.queue.push({ t: 'fs', scat: res.fsTrig, bet, cost: 0 });
        if (res.frags) {
          A.map.n += res.frags; A.map.bs = r2(A.map.bs + res.frags * bet);
          const need = ATL.P.frag.need;
          while (A.map.n >= need) { const avg = A.map.bs / A.map.n; A.map.n -= need; A.map.bs = r2(Math.max(0, A.map.bs - avg * need)); A.queue.push({ t: 'exp', bet: Math.max(1, r2(avg)) }); }
        }
        save();
        setWin(0); msg('');
        const shown = await playSpin(res, { bet, map0 });
        if (win !== shown) setWin(win);
        const mult = win / bet;
        if (win > 0 && !res.fsTrig && !res.hsTrig) msg(`Gain <b>◈ ${fmt(win)}</b>${res.cascades > 1 ? ` · ${res.cascades} cascades` : ''}`, 'w');
        else if (!win && !A.queue.length) msg(IDLE[Math.random() * IDLE.length | 0], 'i');
        if (mult >= 10) await bigWinFx(win, mult);
        settle();
        if (A.queue.length) { stopAuto(); busy = false; await runQueue(); return; }
      } catch (e) { if (e !== DEAD) console.error(e); return; }
      finally { if (!dead) { busy = false; paint(); } }
      if (auto > 0 && !dead) { auto--; paint(); if (auto > 0) { await wait(A.turbo ? 120 : 350).catch(() => {}); if (auto > 0 && !dead && !busy) guard(spinBase()); else paint(); } }
    }
    const IDLE = ['Les courants sont calmes… relancez', 'Trois conques déclenchent la Tempête', 'Six perles ouvrent le Trésor des Abysses', 'Chaque cascade fait monter la marée', 'Les fragments de carte mènent à l’Expédition'];

    /* ---------- File des bonus ---------- */
    async function runQueue() {
      if (featBusy) return; featBusy = true; busy = true; paint();
      try {
        while (!dead) {
          if (A.hs) { await ATLB.hs(X); continue; }
          if (A.fs) { await ATLB.fs(X); continue; }
          if (A.exp) { await ATLB.exp(X); continue; }
          const t = A.queue[0]; if (!t) break;
          if (t.t === 'hs') { A.hs = { st: ATL.hsStart(t.pearls), bet: t.bet, cost: t.cost || 0, pearls: t.pearls }; A.queue.shift(); save(); }
          else if (t.t === 'fs') {
            const mode = await ATLB.chooseMode(X, t);
            A.fs = { st: ATL.fsStart(mode, t.scat), bet: t.bet, cost: t.cost || 0 }; A.queue.shift(); save();
          } else if (t.t === 'exp') { A.exp = { st: ATL.expStart(), bet: t.bet }; A.queue.shift(); save(); }
          else A.queue.shift();
        }
      } catch (e) { if (e !== DEAD) console.error(e); }
      finally { featBusy = false; if (!dead) { busy = false; setScene('base'); paint(); } }
    }

    /* ---------- Décor selon la phase de jeu ---------- */
    let flashT = 0;
    function setScene(s) {
      root.dataset.scene = s;
      clearTimeout(flashT);
      if (s.startsWith('fs')) {
        const fl = q('.atl-flash');
        const strike = () => { if (dead || !root.dataset.scene.startsWith('fs')) return; if (!REDUCED) { an(fl, [{ opacity: 0 }, { opacity: .8, offset: .08 }, { opacity: .1, offset: .2 }, { opacity: .6, offset: .3 }, { opacity: 0 }], { duration: 700 }); snd('atl-thunder'); } flashT = setTimeout(strike, 5000 + Math.random() * 7000); };
        flashT = setTimeout(strike, 1500);
      }
    }

    /* ---------- Tableau de bord ---------- */
    const betV = q('#abv b'), balV = q('#abal');
    function paintJP() { for (const e of $$('.atl-jp', root)) $('b', e).textContent = fk(ATL.JP[e.dataset.j] * A.bet); }
    function paint() {
      if (dead) return;
      betV.textContent = fmt(A.bet);
      balV.textContent = S.hideBal ? '••••' : fmt(S.balance);
      const inFeat = !!(A.fs || A.hs || A.exp || featBusy);
      q('#abm').disabled = q('#abp').disabled = q('#abv').disabled = busy || inFeat;
      buyBtn.disabled = busy || inFeat;
      autoBtn.classList.toggle('on', auto > 0);
      autoBtn.innerHTML = (auto > 0 ? I.stop : I.auto) + `<span>${auto > 0 ? 'Stop' : 'Auto'}</span>`;
      q('#aspinN').textContent = auto > 0 ? auto : '';
      spinBtn.classList.toggle('busy', busy);
      turboBtn.classList.toggle('on', !!A.turbo); turboBtn.setAttribute('aria-pressed', !!A.turbo);
      root.classList.toggle('in-feat', inFeat);
    }
    function stopAuto() { auto = 0; paint(); }
    const onBal = () => { balV.textContent = S.hideBal ? '••••' : fmt(S.balance); };
    document.addEventListener('bal', onBal);
    function setBet(b) { if (busy) return; A.bet = b; shownBet = b; save(); snd('chip'); paint(); paintJP(); refreshPearls(); }
    function refreshPearls() {
      if (!cur || A.fs || A.hs) return;
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) { const x = cur[c][r], e = x.k === 'PE' && !x.jp && els.get(x.id), lab = e && $('.ab-v', e); if (lab) lab.textContent = fk(x.v * A.bet); }
    }
    q('#abm').addEventListener('click', () => { const i = BETS.indexOf(A.bet); if (i > 0) setBet(BETS[i - 1]); });
    q('#abp').addEventListener('click', () => { const i = BETS.indexOf(A.bet); if (i < BETS.length - 1) setBet(BETS[i + 1]); });
    q('#abv').addEventListener('click', () => {
      if (busy) return; snd('click');
      const m = modal(`<h3 class="mt">Mise par tour</h3><p class="mp">Jackpots, perles et gains sont proportionnels à la mise.</p><div class="atl-bets">${BETS.map(b => `<button type="button" class="chip${b === A.bet ? ' on' : ''}" data-b="${b}"${b > S.balance && b !== A.bet ? ' disabled' : ''}>${fmt(b)}</button>`).join('')}</div><button class="btn btn-ghost btn-big" data-close style="margin-top:12px">Fermer</button>`);
      $$('[data-b]', m.el).forEach(b => b.addEventListener('click', () => { setBet(+b.dataset.b); m.close(); }));
    });
    spinBtn.addEventListener('click', () => { if (featBusy) { speedUp(); return; } guard(spinBase()); });
    autoBtn.addEventListener('click', () => {
      if (auto > 0) { stopAuto(); return; }
      snd('click');
      const presets = [10, 25, 50, 100, 250, 500];
      const m = modal(`<h3 class="mt">Tours automatiques</h3><p class="mp">L’auto s’arrête dès qu’un bonus se déclenche ou si le solde ne suffit plus.</p><div class="atl-bets">${presets.map(n => `<button type="button" class="chip${n === S.autoSpins ? ' on' : ''}" data-n="${n}">${n}</button>`).join('')}</div><button class="btn btn-ghost btn-big" data-close style="margin-top:12px">Annuler</button>`);
      $$('[data-n]', m.el).forEach(b => b.addEventListener('click', () => { S.autoSpins = +b.dataset.n; save(); m.close(); auto = S.autoSpins; paint(); if (!busy) guard(spinBase()); }));
    });
    turboBtn.addEventListener('click', () => { A.turbo = !A.turbo; save(); snd('click'); paint(); });
    buyBtn.addEventListener('click', () => { if (!busy) ATLB.buy(X); });
    q('#ainfo').addEventListener('click', () => { const b = $('#ginfo', gx); b && b.click(); });

    /* ---------- Plein écran immersif ---------- */
    let imm = false;
    const immBtn = h('<button class="gx-ib gx-imm-btn" type="button"></button>');
    { const info = $('#ginfo', gx); info ? info.before(immBtn) : $('.gx-top', gx).appendChild(immBtn); }
    const paintImm = () => { immBtn.innerHTML = ic(imm ? 'compress' : 'expand', 17); immBtn.setAttribute('aria-label', imm ? 'Quitter le plein écran' : 'Plein écran'); immBtn.classList.toggle('on', imm); };
    function setImm(on) { if (on === imm) return; imm = on; gx.classList.toggle('gx-atl-imm', on); paintImm(); requestAnimationFrame(fit); }
    async function toggleImm() {
      snd('click');
      if (imm) { setImm(false); if (document.fullscreenElement) try { await document.exitFullscreen(); } catch (e) {} return; }
      setImm(true);
      const de = document.documentElement;
      if (de.requestFullscreen && !document.fullscreenElement) try { await de.requestFullscreen({ navigationUI: 'hide' }); } catch (e) {}
    }
    immBtn.addEventListener('click', toggleImm); q('#aexit').addEventListener('click', toggleImm);
    const onFs = () => { if (!document.fullscreenElement && imm) setImm(false); };
    document.addEventListener('fullscreenchange', onFs);
    paintImm();

    /* ---------- Contexte partagé avec les écrans de bonus ---------- */
    const X = {
      A, root, board, reels, cellsEl, bov, layer, fbar, fx, DEAD, JPN, fk, I, spinBtn,
      an, fin, wait, later, speedUp, guard, snd, msg, banner, amount, setWin, setTide, setScene, bigWinFx, payFeature,
      playSpin, sync, cellCenter, rectIn, paint, paintMap, elAt, cellHTML,
      cs: () => cs, dead: () => dead, get cur() { return cur; },
      setHurry(v) { hurry = v; }, busy(v) { busy = v; paint(); },
      startQueue() { guard(runQueue()); },
    };
    ATL.dev.ui = X;

    /* ---------- Démarrage ---------- */
    fit();
    paint(); paintJP(); paintMap(A.map.n); setScene('base');
    { // grille d'accueil décorative (tirée au hasard du décor, sans valeur)
      const g = []; for (let c = 0; c < COLS; c++) { g.push([]); for (let r = 0; r < ROWS; r++) g[c].push({ id: 'd' + c + r, k: ATL.PAY_SYMS[(Math.random() * ATL.PAY_SYMS.length) | 0] }); }
      g[2][2] = { id: 'dw', k: 'W', m: 2 };
      requestAnimationFrame(() => { fit(); if (!cur) guard(animateTo(g, { colDelay: c => 120 + c * 80, from: ROWS, gap: .4, dur: 260, rowGap: 22 })); });
    }
    msg('Alignez 3 symboles ou plus, de gauche à droite', 'i');
    if (A.pend) { const w = A.pend.win; settle(); if (w > 0) toast(`Gain de ton dernier tour crédité : ◈ ${fmt(w)}`, 'win'); }
    const PRELOAD = [...ATL.PAY_SYMS, 'W', 'S', 'PE', 'FR'].map(k => { const im = new Image(); im.src = ATL_ART.src(k); return im; });
    if (A.fs || A.hs || A.exp || A.queue.length) setTimeout(() => { if (!dead) { toast('Reprise de ton bonus en cours', 'win'); guard(runQueue()); } }, 700);

    return () => {
      dead = true; auto = 0;
      for (const a of anims) try { a.cancel(); } catch (e) {}
      amb.stop(); fx.stop(); ro.disconnect(); clearTimeout(flashT); PRELOAD.length = 0;
      document.removeEventListener('bal', onBal); document.removeEventListener('fullscreenchange', onFs);
      if (imm && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      gx.classList.remove('gx-atl', 'gx-atl-imm');
      if (ATL.dev.ui === X) ATL.dev.ui = null;
    };
  }

  /* Tentacules du Kraken (décor vectoriel en attendant l'illustration) */
  const KRAKEN_SVG = `<svg viewBox="0 0 600 300" preserveAspectRatio="xMidYMax meet"><defs><linearGradient id="kg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8B3FC4"/><stop offset="1" stop-color="#2A0B45"/></linearGradient></defs>
    ${[[60, -18], [170, 10], [430, -8], [540, 16]].map(([x, a], i) => `<g transform="translate(${x} 300) rotate(${a})"><path d="M-26 0C-30-80 20-120 0-190c-10-36 20-60 34-44-16 0-24 18-14 40 26 60-10 120-4 194z" fill="url(#kg)" stroke="#1A0630" stroke-width="3"/>${[0, 1, 2, 3, 4].map(j => `<circle cx="${-8 + j * 2}" cy="${-20 - j * 34}" r="${7 - j}" fill="#E6B8FF" opacity=".55"/>`).join('')}</g>`).join('')}</svg>`;

  /* ---------- Règles et fiche technique ---------- */
  function rules() {
    const bet = (S.atl && S.atl.bet) || 100;
    const im = k => `<img src="${ATL_ART.src(k)}" alt="" width="28" height="28" style="vertical-align:middle;margin-right:6px">`;
    const rows = ATL.PAY_SYMS.map(k => `<tr><td>${im(k)}${ATL.NAMES[k]}</td>${[3, 4, 5, 6].map(n => `<td class="num">${fmt(r2(ATL.PAY[k][n] * bet))}</td>`).join('')}</tr>`).join('');
    return `<p><b>Atlantide — l’Éveil de Poséidon</b> : 6 rouleaux × 5 rangées, <b>15 625 voies</b> de gain. Un symbole paie quand il apparaît sur au moins 3 rouleaux consécutifs depuis la gauche, à n’importe quelle rangée. Le gain d’une combinaison est multiplié par le nombre de voies (produit du nombre d’occurrences sur chaque rouleau).</p>
    <h4>Gains par voie (mise ◈ ${fmt(bet)})</h4>
    <table class="ptab atl-pt"><thead><tr><th>Symbole</th><th>×3</th><th>×4</th><th>×5</th><th>×6</th></tr></thead><tbody>${rows}</tbody></table>
    <h4>${im('W')}Trident (Wild)</h4><p>Apparaît sur les rouleaux 2 à 6 et remplace tous les symboles payants. Certains portent un multiplicateur ×2 ou ×3 (jusqu’à ×5 en tours gratuits) : les multiplicateurs d’une même combinaison s’additionnent.</p>
    <h4>Cascades et Marée</h4><p>Les symboles gagnants disparaissent, les autres tombent et de nouveaux arrivent. Chaque cascade successive fait monter la Marée : ×1, ×2, ×3, ×5, ×8 puis ×12, appliqué au gain de la cascade.</p>
    <h4>Le Kraken</h4><p>Au hasard, le Kraken surgit et plante 3 à 6 Tridents sur la grille ; il garantit toujours un gain.</p>
    <h4>${im('S')}Conques — La Tempête de Poséidon</h4><p>3 conques ou plus paient ${Object.entries(ATL.SCAT_PAY).map(([n, v]) => `${n} → ${v}×`).join(', ')} la mise et ouvrent les tours gratuits. Vous choisissez votre tempête :</p>
    <ul><li><b>Marée Montante</b> — ${ATL.P.fs.A.spins} tours. La marée démarre à ×${ATL.P.fs.A.tide0}, monte de 1 à chaque cascade et ne redescend jamais.</li>
    <li><b>Tridents Déferlants</b> — ${ATL.P.fs.B.spins} tours. Chaque Trident soulève une vague qui recouvre tout son rouleau ; multiplicateurs jusqu’à ×5.</li>
    <li><b>Colère du Kraken</b> — ${ATL.P.fs.C.spins} tours. Le Kraken plante 2 à 4 Tridents à chaque tour, jusqu’à ×5.</li></ul>
    <p>4, 5 ou 6 conques ajoutent 25 %, 50 % ou 100 % de tours. 3 conques pendant les tours gratuits en rajoutent. Les trois tempêtes ont la même espérance de gain : seule la volatilité change.</p>
    <h4>${im('PE')}Perles — Le Trésor des Abysses</h4><p>Les perles affichent une valeur (1× à 50× la mise) ou un jackpot. 6 perles ou plus à la fin d’un tour ouvrent le Trésor : les perles restent en place et vous avez 3 relances ; chaque nouvelle perle remet le compteur à 3. Perles spéciales : <b>Collectrice</b> (additionne toutes les perles présentes), <b>Doubleuse</b> (double le total, jusqu’à ×8). Remplir les 30 cases remporte le <b>Grand Jackpot</b>.</p>
    <p>Jackpots : Mini ${ATL.JP.MINI}×, Mineur ${ATL.JP.MINEUR}×, Majeur ${ATL.JP.MAJEUR}×, Grand ${fmt(ATL.JP.GRAND)}× la mise.</p>
    <h4>${im('FR')}Fragments de carte — L’Expédition</h4><p>Chaque fragment tombé est conservé, même d’une session à l’autre. À ${ATL.P.frag.need} fragments, l’Expédition commence : ${ATL.P.exp.rolls} lancers de dé sur la carte d’Atlantide. Trésors, coquillages (+1 lancer), multiplicateurs, tourbillons et Kraken (recul), épaves (choisissez 1 coffre sur 3). Atteindre la Porte d’Atlantide rapporte ${ATL.P.exp.gatePrize}× et ouvre le Coffre de Poséidon : 3 coquilles identiques désignent le jackpot gagné. Les gains de l’Expédition sont calculés sur la mise moyenne des fragments collectés.</p>
    <h4>Achat de bonus</h4><p>Tempête de Poséidon : ${ATL.BUY.fs}× la mise · Trésor des Abysses (6 perles) : ${ATL.BUY.hs}× la mise.</p>
    <h4>Fiche technique</h4><p>RTP théorique <b>95,7 %</b> (mesuré sur 16 millions de tours simulés avec le moteur du jeu) · achat de bonus ≈ 95,9 % · fréquence de gain ≈ 53 % · tours gratuits ≈ 1 tour sur 190 · Trésor ≈ 1 sur 180 · Expédition ≈ 1 sur 240 · volatilité très haute · gain maximal ${fmt(ATL.MAXWIN)}× la mise par tour ou par bonus. Un tour interrompu est payé à votre retour ; un bonus reprend là où il s’était arrêté.</p>`;
  }

  return { init, rules, fk, JPN, BETS };
})();

reg({
  id: 'atlantide', layout: 'self', name: 'Atlantide', cat: 'slots', rtp: '95,7 %', vol: 'Très haute', badge: 'new', pop: 99,
  init: stage => ATLUI.init(stage),
  rules: () => ATLUI.rules(),
});
