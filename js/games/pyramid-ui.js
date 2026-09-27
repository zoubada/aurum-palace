'use strict';
/* ============ Bonus « La Marche du Pharaon » : écran ============
   L'état vit dans S.pyr = {g, st} (voir js/pyramid-bonus.js) et est sauvegardé
   à chaque porte ouverte : un rechargement reprend le bonus là où il en était.
   Le gain est versé au moment même où la dernière porte est ouverte. */
const PYR_DIR = 'assets/bonus/pyramid/';
const PYR_IMG = { bg: PYR_DIR + 'bg.jpg', door: PYR_DIR + 'door.jpg', sarco: PYR_DIR + 'sarco.png', prize: PYR_DIR + 'treasure.png', trap: null, torch: null, climber: null };

const PYR_ICON = {
  torch: `<svg viewBox="0 0 32 48" aria-hidden="true"><defs><radialGradient id="pyrFl" cx=".5" cy=".7" r=".6"><stop offset="0" stop-color="#FFF7C2"/><stop offset=".45" stop-color="#FFB42A"/><stop offset="1" stop-color="#E4401A"/></radialGradient></defs><path class="fl" d="M16 2c3 7 10 10 10 18a10 10 0 0 1-20 0c0-5 3-7 4-10 1 3 2 5 4 5-1-5 0-9 2-13z" fill="url(#pyrFl)"/><path d="M9 27h14l-3 19h-8z" fill="#8A5A0B"/><path d="M8 26h16v4H8z" fill="#E2B13F"/></svg>`,
  trap: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6c11 0 18 9 18 20 0 9-6 15-11 19v7H25v-7c-5-4-11-10-11-19C14 15 21 6 32 6z" fill="#1E3C8F" stroke="#E2B13F" stroke-width="2.5"/><path d="M32 12c6 0 10 6 10 12 0 7-5 10-10 10s-10-3-10-10c0-6 4-12 10-12z" fill="#E2B13F"/><circle cx="27.5" cy="22" r="2.4" fill="#D62828"/><circle cx="36.5" cy="22" r="2.4" fill="#D62828"/><path d="M29 29q3 3 6 0M32 31v6l-3 4M32 37l3 4" stroke="#D62828" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M23 52h18l3 6H20z" fill="#E2B13F"/></svg>`,
  coin: `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="pyrCo" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FFF7D0"/><stop offset=".4" stop-color="#F1C95B"/><stop offset="1" stop-color="#8A5A0B"/></radialGradient></defs><ellipse cx="32" cy="36" rx="24" ry="22" fill="#7A4E08"/><circle cx="32" cy="32" r="24" fill="url(#pyrCo)"/><circle cx="32" cy="32" r="18" fill="none" stroke="#8C5A0A" stroke-width="2" opacity=".7"/><path d="M32 20l9 12-9 12-9-12z" fill="#9A6410"/><path d="M32 25l5 7-5 7-5-7z" fill="#FFE9A3"/></svg>`,
  sun: `<svg viewBox="0 0 64 32" aria-hidden="true"><path d="M2 20q14-12 30-6 16-6 30 6-14-4-30 2-16-6-30-2z" fill="#E2B13F"/><circle cx="32" cy="15" r="8" fill="#D62828" stroke="#E2B13F" stroke-width="2"/></svg>`,
  skull: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5c3.3 0 5.5 2.2 5.5 5.2 0 2-1.1 3.2-2.3 3.9V13H5v-2.4C3.6 9.9 2.5 8.7 2.5 6.7 2.5 3.7 4.7 1.5 8 1.5z" fill="currentColor"/><circle cx="6" cy="7" r="1.3" fill="#1a0707"/><circle cx="10" cy="7" r="1.3" fill="#1a0707"/></svg>`
};

function runPyramid({ host, gameId, fresh }) {
  return new Promise(resolve => {
    const st = () => S.pyr && S.pyr.st;
    const s0 = st(); if (!s0) { resolve(); return; }
    const bet = s0.bet;
    const money = v => fmt(r2(v * bet));
    const img = (k, cls = '') => PYR_IMG[k] ? `<img class="${cls}" src="${PYR_IMG[k]}" alt="" draggable="false">` : '';
    const ov = h(`<div class="pyr" role="dialog" aria-modal="true" aria-label="Bonus La Marche du Pharaon">
      <div class="pyr-bg${PYR_IMG.bg ? ' has-img' : ''}"${PYR_IMG.bg ? ` style="background-image:url(${PYR_IMG.bg})"` : ''}></div><i class="pyr-rays"></i><div class="pyr-dust"></div>
      <header class="pyr-top"><div class="pyr-title"><small>Bonus</small><b>La Marche <span>du Pharaon</span></b></div>
        <div class="pyr-hud"><div class="pyr-torches" aria-label="Torches"></div><div class="pyr-total"><span>Trésor</span><b class="num">◈ 0</b></div></div></header>
      <div class="pyr-main"><div class="pyr-tower" aria-hidden="true"></div>
        <div class="pyr-play"><div class="pyr-msg" aria-live="polite"></div><div class="pyr-doors"></div></div></div>
      <div class="pyr-layer"></div></div>`);
    host.appendChild(ov);
    const $o = s => ov.querySelector(s);
    const tower = $o('.pyr-tower'), doorsEl = $o('.pyr-doors'), msgEl = $o('.pyr-msg'), layer = $o('.pyr-layer');
    const torchesEl = $o('.pyr-torches'), totalEl = $o('.pyr-total b');
    let shownTotal = 0, busy = false, alive = true;
    const later = ms => new Promise(r => setTimeout(r, ms));

    /* ---------- HUD ---------- */
    function paintTorches(lostAnim) {
      const s = st(); if (!s) return;
      torchesEl.innerHTML = Array.from({ length: PYR.MAX_T }, (_, i) => `<span class="pt ${i < s.torches ? 'on' : ''} ${lostAnim && i === s.torches ? 'lost' : ''}">${PYR_ICON.torch}</span>`).join('');
    }
    function paintTotal(to, animate = true) {
      const from = shownTotal, t0 = performance.now(), D = animate ? 700 : 0;
      const step = t => { if (!alive) return; const k = D ? Math.min(1, (t - t0) / D) : 1, e = 1 - Math.pow(1 - k, 3); totalEl.textContent = '◈ ' + money(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); else shownTotal = to; };
      requestAnimationFrame(step);
      if (animate && to > from) { totalEl.parentNode.classList.remove('bump'); void totalEl.offsetWidth; totalEl.parentNode.classList.add('bump'); }
    }
    /* ---------- Pyramide ---------- */
    function paintTower() {
      const s = st(); if (!s) return;
      const summit = s.phase === 'summit';
      let html = `<div class="ps cap ${summit ? 'cur' : ''}"><span>${summit ? 'Sommet' : '×2 · ×3 · ×5'}</span></div>`;
      for (let k = PYR.LEVELS - 1; k >= 0; k--) {
        const cls = k < s.level ? 'done' : k === s.level && !summit ? 'cur' : 'lock';
        const [a, b] = PYR.prizeRange(k);
        html += `<div class="ps ${cls} ${PYR.TRAPS[k] > 1 ? 'danger' : ''}" style="--k:${k}"><em>${k + 1}</em><span>◈ ${money(a)} – ${money(b)}</span>${PYR.TRAPS[k] > 1 ? `<i title="2 portes piégées">${PYR_ICON.skull}</i>` : ''}${cls === 'cur' ? `<b class="climber">${PYR_IMG.climber ? img('climber') : PYR_ICON.torch}</b>` : ''}</div>`;
      }
      tower.innerHTML = html;
    }
    /* ---------- Portes ---------- */
    const faceHTML = (i, summit) => summit
      ? `<span class="pd-face sarco">${PYR_IMG.sarco ? img('sarco', 'pd-img') : `<i class="sc-lid"></i><i class="sc-face"></i><i class="sc-band"></i>`}${PYR_IMG.sarco ? '' : `<b class="pd-n">${['I', 'II', 'III'][i]}</b>`}</span>`
      : `<span class="pd-face">${PYR_IMG.door ? img('door', 'pd-img') : `<i class="pd-lintel">${PYR_ICON.sun}</i><i class="pd-leaf l"></i><i class="pd-leaf r"></i><b class="pd-n">${['I', 'II', 'III'][i]}</b>`}</span>`;
    const backHTML = it => {
      if (it.t === 'prize') return `<span class="pd-back prize">${PYR_IMG.prize ? img('prize', 'pd-ico') : PYR_ICON.coin}<b>◈ ${money(it.v)}</b><small>×${String(it.v).replace('.', ',')}</small></span>`;
      if (it.t === 'trap') return `<span class="pd-back trap">${PYR_IMG.trap ? img('trap', 'pd-ico') : PYR_ICON.trap}<b>Piège !</b><small>−1 torche</small></span>`;
      if (it.t === 'torch') return `<span class="pd-back torch">${PYR_IMG.torch ? img('torch', 'pd-ico') : PYR_ICON.torch}<b>Torche</b><small>+1 torche</small></span>`;
      return `<span class="pd-back mult"><b>×${it.v}</b><small>le trésor</small></span>`;
    };
    function paintDoors() {
      const s = st(); if (!s) return;
      const summit = s.phase === 'summit';
      doorsEl.classList.toggle('summit', summit);
      doorsEl.innerHTML = [0, 1, 2].map(i => `<button type="button" class="pyr-door ${summit ? 'is-sarco' : ''}" data-i="${i}" aria-label="${summit ? 'Sarcophage' : 'Porte'} ${i + 1}"><span class="pd-in">${faceHTML(i, summit)}</span></button>`).join('');
      $$('.pyr-door', doorsEl).forEach(b => b.addEventListener('click', () => pick(+b.dataset.i)));
      if (summit) setMsg('Tu as atteint le sommet ! <b>Choisis un sarcophage</b> : ×2, ×3 ou ×5 sur ton trésor.');
      else setMsg(`Étage <b>${s.level + 1}</b> / ${PYR.LEVELS} — choisis une porte${PYR.TRAPS[s.level] > 1 ? ' · <span class="neg">2 portes sont piégées !</span>' : ''}`);
    }
    const setMsg = html => { msgEl.innerHTML = `<span>${html}</span>`; };

    async function pick(i) {
      const s = st(); if (busy || !s || s.phase === 'done') return;
      busy = true; doorsEl.classList.add('locked');
      const wasSummit = s.phase === 'summit';
      const res = PYR.choose(s, i, rand); save();
      let paid = null;
      if (s.phase === 'done') paid = settle(s);
      const btns = $$('.pyr-door', doorsEl);
      btns.forEach((b, k) => b.querySelector('.pd-in').insertAdjacentHTML('beforeend', backHTML(res.doors[k])));
      snd('door'); btns[i].classList.add('open', 'chosen');
      await later(650); if (!alive) return;
      const it = res.item;
      if (it.t === 'prize') { snd('coin'); paintTotal(s.total); burst(btns[i], 14); setMsg(`Trésor ! <b class="gold">+ ◈ ${money(it.v)}</b>`); }
      else if (it.t === 'torch') { snd('torch'); paintTorches(); burst(btns[i], 10); setMsg('Une torche de plus pour éclairer la montée !'); }
      else if (it.t === 'trap') { snd('boom'); ov.classList.remove('shake'); void ov.offsetWidth; ov.classList.add('shake'); paintTorches(true); setMsg(s.torches > 0 ? `Piège ! Tu perds une torche — il t’en reste <b>${s.torches}</b>.` : 'Piège ! Ta dernière torche s’éteint…'); }
      else { snd('big'); paintTotal(r2(s.total * s.mult), true); burst(btns[i], 30); setMsg(`Le sarcophage révèle <b class="gold">×${it.v}</b> !`); }
      await later(450); if (!alive) return;
      btns.forEach((b, k) => { if (k !== i) b.classList.add('open', 'other'); });
      await later(1100); if (!alive) return;
      if (s.phase === 'done') { await finale(s, paid, wasSummit); return; }
      if (it.t !== 'trap') { paintTower(); tower.classList.remove('climb'); void tower.offsetWidth; tower.classList.add('climb'); snd('tick'); }
      if (s.phase === 'summit' && !wasSummit) await summitIntro();
      paintDoors(); doorsEl.classList.remove('locked'); busy = false;
    }
    /* Gain versé immédiatement, au moment où la dernière porte est ouverte */
    function settle(s) {
      const win = PYR.winOf(s);
      S.pyr = null;
      if (win > 0) give(win);
      if (s.mult > 1) unlock('pyr');
      record(gameId, 0, win, `Bonus Pyramide · étage ${Math.min(s.level, PYR.LEVELS)}/${PYR.LEVELS}${s.mult > 1 ? ' · ×' + s.mult : ''}`);
      save();
      return win;
    }
    function burst(el, n) {
      if (REDUCED) return;
      const r = el.getBoundingClientRect(), o = ov.getBoundingClientRect();
      for (let k = 0; k < n; k++) {
        const p = h(`<i class="pyr-spark"></i>`), a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 90;
        p.style.left = (r.left - o.left + r.width / 2) + 'px'; p.style.top = (r.top - o.top + r.height / 2) + 'px';
        p.style.setProperty('--dx', Math.cos(a) * d + 'px'); p.style.setProperty('--dy', Math.sin(a) * d - 30 + 'px');
        layer.appendChild(p); setTimeout(() => p.remove(), 900);
      }
    }
    /* ---------- Séquences ---------- */
    function intro() {
      const s = st();
      return new Promise(done => {
        const box = h(`<div class="pyr-card pyr-intro"><i class="pyr-halo"></i>
          <div class="pyr-emb">${symBadge(SYMS_PHARAON.find(x => x.k === 'P'), false)}</div>
          <small>${fresh ? `${s.count} symboles Pyramide` : 'Reprise du bonus'}</small>
          <h2>La Marche<br>du Pharaon</h2>
          <ul><li>${PYR_ICON.torch}<span>Tu commences avec <b>${s.torches} torches</b></span></li>
          <li>${PYR_ICON.coin}<span>À chaque étage, choisis une porte : <b>trésor</b> ou <b>piège</b></span></li>
          <li>${PYR_ICON.sun}<span>Au sommet, la Chambre du Trésor multiplie tout par <b>×2, ×3 ou ×5</b></span></li></ul>
          <p class="pyr-min">Gain minimum garanti : <b>◈ ${money(PYR.MIN_WIN)}</b> (×${PYR.MIN_WIN} la mise)</p>
          <button type="button" class="btn btn-gold btn-big">${fresh ? 'Commencer l’ascension' : 'Reprendre l’ascension'}</button></div>`);
        layer.appendChild(box); layer.classList.add('dim');
        requestAnimationFrame(() => box.classList.add('in'));
        $('button', box).addEventListener('click', () => { snd('click'); box.classList.remove('in'); box.classList.add('out'); layer.classList.remove('dim'); setTimeout(() => { box.remove(); done(); }, 380); });
      });
    }
    async function summitIntro() {
      snd('bonus');
      const box = h(`<div class="pyr-banner"><small>Étage ${PYR.LEVELS} franchi</small><b>Le Sommet !</b></div>`);
      layer.appendChild(box); if (!REDUCED) confetti(60, true);
      await later(1900); box.remove();
    }
    function finale(s, win, wasSummit) {
      return new Promise(done => {
        const top = wasSummit;
        if (win > 0) { snd(top ? 'big' : 'win'); if (!REDUCED) confetti(top ? 140 : 70, true); }
        const box = h(`<div class="pyr-card pyr-end ${top ? 'top' : ''}"><i class="pyr-halo"></i>
          <small>${top ? 'Sommet atteint · trésor ×' + s.mult : 'Tes torches se sont éteintes'}</small>
          <h2>${top ? 'Le Pharaon te couvre d’or !' : 'Fin de l’ascension'}</h2>
          <div class="pyr-win"><span>Trésor remporté</span><b class="num">◈ 0</b>${s.total * s.mult < PYR.MIN_WIN ? `<em>Minimum garanti ×${PYR.MIN_WIN} la mise</em>` : ''}</div>
          <div class="pyr-stats"><div><b>${Math.min(s.level, PYR.LEVELS)}/${PYR.LEVELS}</b><span>Étages</span></div><div><b>${s.picks}</b><span>Portes ouvertes</span></div><div><b>${s.mult > 1 ? '×' + s.mult : '—'}</b><span>Sommet</span></div></div>
          <button type="button" class="btn btn-gold btn-big">Retour aux rouleaux</button></div>`);
        layer.appendChild(box); layer.classList.add('dim'); requestAnimationFrame(() => box.classList.add('in'));
        const b = $('.pyr-win b', box), t0 = performance.now(), D = 1400;
        const step = t => { if (!alive) return; const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); b.textContent = '◈ ' + fmt(r2(win * e)); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
        $('button', box).addEventListener('click', () => { snd('click'); close(); done(); });
      });
    }
    function close() { alive = false; ov.classList.add('out'); setTimeout(() => ov.remove(), 400); resolve(); }

    /* ---------- Démarrage ---------- */
    shownTotal = s0.total * (s0.mult || 1);
    paintTorches(); paintTotal(shownTotal, false); paintTower(); paintDoors();
    doorsEl.classList.add('locked'); busy = true;
    requestAnimationFrame(() => ov.classList.add('in'));
    intro().then(() => { if (!alive) return; doorsEl.classList.remove('locked'); busy = false; });
  });
}
