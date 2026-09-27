'use strict';
/* ============ Petit bonus « Les Faveurs du Sphinx » : écran ============
   Réutilise l'habillage de La Marche du Pharaon (fond, rayons, cadre de
   portes) : un tirage instantané et sans risque, pensé pour être rapide —
   aucun état à sauvegarder, tout se résout en un seul geste. */
function runSphinx({ host, gameId, bet }) {
  return new Promise(resolve => {
    rngStart();
    const st = SPHINX.start(bet, rand);
    const money = v => fmt(r2(v * bet));
    let picked = false;
    const ov = h(`<div class="pyr sph" role="dialog" aria-modal="true" aria-label="Petit bonus Les Faveurs du Sphinx">
      <div class="pyr-bg${PYR_IMG.bg ? ' has-img' : ''}"${PYR_IMG.bg ? ` style="background-image:url(${PYR_IMG.bg})"` : ''}></div><i class="pyr-rays"></i><div class="pyr-dust"></div>
      <header class="pyr-top"><div class="pyr-title"><small>Petit bonus</small><b>Les Faveurs <span>du Sphinx</span></b></div></header>
      <div class="sph-main"><p class="sph-msg">Choisis une urne canope : le trésor qu’elle renferme est à toi, aussitôt.</p>
        <div class="pyr-doors sph-jars"></div></div>
      <div class="pyr-layer"></div></div>`);
    host.appendChild(ov);
    const jarsEl = $('.sph-jars', ov), msgEl = $('.sph-msg', ov), layer = $('.pyr-layer', ov), main = $('.sph-main', ov);
    jarsEl.innerHTML = [0, 1, 2].map(i => `<button type="button" class="pyr-door" data-i="${i}" aria-label="Urne ${i + 1}"><span class="pd-in"><span class="pd-face sarco">${PYR_IMG.sarco ? `<img class="pd-img" src="${PYR_IMG.sarco}" alt="" draggable="false">` : `<i class="sc-lid"></i><i class="sc-face"></i><i class="sc-band"></i>`}<b class="pd-n">${['I', 'II', 'III'][i]}</b></span><span class="pd-back"></span></span></button>`).join('');
    requestAnimationFrame(() => ov.classList.add('in'));
    $$('.pyr-door', jarsEl).forEach(b => b.addEventListener('click', () => pick(+b.dataset.i)));

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
    function pick(i) {
      if (picked) return; picked = true; jarsEl.classList.add('locked');
      const res = SPHINX.choose(st, i);
      snd('door');
      const btns = $$('.pyr-door', jarsEl);
      btns.forEach((b, k) => {
        const back = $('.pd-back', b); back.className = 'pd-back prize';
        back.innerHTML = `<b>◈ ${money(res.vals[k])}</b><small>×${String(res.vals[k]).replace('.', ',')}</small>`;
        b.classList.add('open'); if (k === i) b.classList.add('chosen');
      });
      give(res.win); record(gameId, 0, res.win, `Petit bonus Sphinx · ×${res.vals[i]}`); save();
      const big = res.vals[i] >= 15;
      snd(big ? 'big' : 'coin'); burst(btns[i], big ? 36 : 16); if (big && !REDUCED) confetti(80, true);
      msgEl.innerHTML = `Le sphinx t’offre <b class="gold">◈ ${money(res.vals[i])}</b> !`;
      setTimeout(() => {
        const box = h(`<button type="button" class="btn btn-gold btn-big sph-close">Retour aux rouleaux</button>`);
        main.appendChild(box); requestAnimationFrame(() => box.classList.add('in'));
        box.addEventListener('click', () => { snd('click'); close(); });
      }, 1300);
    }
    function close() { ov.classList.add('out'); setTimeout(() => { ov.remove(); resolve(); }, 380); }
  });
}
