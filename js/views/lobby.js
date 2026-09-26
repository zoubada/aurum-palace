'use strict';
/* ============ Lobby ============ */
const heroDeco={
 a:`<svg viewBox="0 0 200 200" class="deco" aria-hidden="true"><defs><radialGradient id="hc1"><stop offset="0" stop-color="#FFF4B8"/><stop offset=".6" stop-color="#D4AF37"/><stop offset="1" stop-color="#6b4d07"/></radialGradient></defs>${[[110,70,34],[150,120,28],[80,130,30],[140,50,18],[60,70,20],[120,160,16]].map(([x,y,r])=>`<g transform="translate(${x} ${y})"><circle r="${r}" fill="url(#hc1)"/><circle r="${r*.72}" fill="none" stroke="#8B6508" stroke-width="2" stroke-dasharray="4 3"/><text text-anchor="middle" dy=".35em" font-size="${r*.9}" font-weight="800" fill="#6b4d07">◈</text></g>`).join('')}</svg>`,
 b:`<svg viewBox="0 0 200 200" class="deco" aria-hidden="true"><defs><linearGradient id="hc2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F5D76E"/><stop offset="1" stop-color="#8B6508"/></linearGradient></defs><path d="M40 150h120l-12-70-34 30-14-50-14 50-34-30z" fill="url(#hc2)"/><rect x="40" y="152" width="120" height="16" rx="4" fill="url(#hc2)"/>${[60,100,140].map(x=>`<circle cx="${x}" cy="160" r="5" fill="#10B981"/>`).join('')}<circle cx="100" cy="58" r="8" fill="#F43F5E"/></svg>`,
 c:`<svg viewBox="0 0 200 200" class="deco" aria-hidden="true"><g transform="translate(110 100)">${Array.from({length:12},(_,i)=>`<path d="M0 0 L${Math.sin(i*Math.PI/6)*80} ${-Math.cos(i*Math.PI/6)*80} A80 80 0 0 1 ${Math.sin((i+1)*Math.PI/6)*80} ${-Math.cos((i+1)*Math.PI/6)*80}Z" fill="${['#D4AF37','#1C2130','#10B981','#1C2130'][i%4]}" stroke="#0B0D12" stroke-width="2"/>`).join('')}<circle r="16" fill="#0B0D12" stroke="#F5D76E" stroke-width="4"/></g><path d="M110 12l-9 16h18z" fill="#F5D76E"/></svg>`};
V.lobby=m=>{
  const slides=[
   {bg:'radial-gradient(600px 300px at 80% 50%,rgba(212,175,55,.35),transparent),linear-gradient(120deg,#171208,#2b200a 60%,#120e06)',t:'Le Palace t’offre 10 000 jetons',p:'Des machines à sous, la roulette, le blackjack et nos Originals. Gratuit, sans argent réel.',c:'Jouer à Pharaon d’Or',h:'#/game/pharaon',d:'a'},
   {bg:'radial-gradient(600px 300px at 80% 50%,rgba(16,185,129,.28),transparent),linear-gradient(120deg,#07140f,#0d2a1f 60%,#06100c)',t:'Le Jackpot Aurum grimpe',p:'Aligne cinq couronnes sur une ligne de Pharaon d’Or pour le décrocher.',c:'Tenter le jackpot',h:'#/game/pharaon',d:'b'},
   {bg:'radial-gradient(600px 300px at 80% 50%,rgba(96,165,250,.25),transparent),linear-gradient(120deg,#0a0f1c,#121b33 60%,#080c16)',t:'Ta roue du jour t’attend',p:'Un tour gratuit toutes les 24 h, multiplié selon ton niveau VIP.',c:'Tourner la roue',h:'#/promo',d:'c'}];
  const pop=['pharaon','roulette','blackjack','crash','mines','plinko','fruit','videopoker'].map(id=>GAMES[id]);
  const row=(t,list,href)=>`<div class="sec"><h2>${t}</h2>${href?`<a href="${href}">Tout voir</a>`:''}</div><div class="hs">${list.map(gcard).join('')}</div>`;
  const recents=S.recent.map(id=>GAMES[id]).filter(Boolean);
  const tick=Array.from({length:18},fakeWin);
  m.innerHTML=`<section class="hero" aria-roledescription="carrousel">${slides.map((s,i)=>`<div class="slide ${i?'':'on'}" style="background:${s.bg}">${heroDeco[s.d]}<h3>${s.t}</h3><p>${s.p}</p><a class="btn btn-gold" href="${s.h}">${s.c}</a></div>`).join('')}<div class="dots">${slides.map((_,i)=>`<button class="${i?'':'on'}" aria-label="Diapositive ${i+1}"></button>`).join('')}</div></section>
  <section class="jp"><div><div class="jp-l">Jackpot progressif Aurum</div><div class="jp-v gtext num" data-jp>◈ ${fmt(S.jackpot)}</div></div><div class="jp-r"><span class="live"><b class="num" id="online">2 184</b>&nbsp;joueurs en ligne</span><a class="btn btn-gold btn-sm" href="#/game/pharaon">Jouer</a></div></section>
  <div class="tick" aria-label="Derniers gains"><div class="tick-in">${[...tick,...tick].map(w=>`<span class="tk"><b>${esc(w.n)}</b><span class="g">${w.g}</span><span class="m">${fmtM(w.m)}</span><span>◈ ${fmt(w.w)}</span></span>`).join('')}</div></div>
  <div class="cats">${Object.entries(CATS).map(([k,c])=>`<a class="cat" href="#/cat/${k}"><span class="ci">${ic(c.i)}</span><div><b>${c.n}</b><span>${GL.filter(g=>g.cat===k).length} jeux</span></div></a>`).join('')}</div>
  ${recents.length?row('Récemment joués',recents,'#/recent'):''}
  ${row('Les plus joués',pop,'#/games')}
  ${row('Originals Aurum',GL.filter(g=>g.cat==='originals'),'#/cat/originals')}
  ${row('Machines à sous',GL.filter(g=>g.cat==='slots'),'#/cat/slots')}
  ${row('Jeux de table',GL.filter(g=>g.cat==='table'),'#/cat/table')}
  ${row('Jeux instantanés',GL.filter(g=>g.cat==='instant'),'#/cat/instant')}`;
  bindFavs(m);
  let si=0;const sl=$$('.slide',m),dt=$$('.dots button',m);const show=i=>{si=i;sl.forEach((s,k)=>s.classList.toggle('on',k===i));dt.forEach((d,k)=>d.classList.toggle('on',k===i))};
  dt.forEach((d,i)=>d.addEventListener('click',()=>show(i)));
  const iv=setInterval(()=>show((si+1)%sl.length),6000);
  let on=2184;const iv2=setInterval(()=>{on=Math.max(1700,Math.min(2900,on+Math.round((Math.random()-.48)*40)));const o=$('#online');if(o)o.textContent=on.toLocaleString('fr-FR')},2500);
  const iv3=setInterval(()=>{const w=fakeWin();if(w.m>=8)toast(`<b>${esc(w.n)}</b> vient de gagner <span class="gold">◈ ${fmt(w.w)}</span> sur ${w.g} (${fmtM(w.m)})`)},38000);
  destroy=()=>{clearInterval(iv);clearInterval(iv2);clearInterval(iv3)};
};

