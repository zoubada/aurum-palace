'use strict';
/* ============ Listes de jeux ============ */
function listView(m,{title,sub,list,filters=true,search=false,empty,q:q0='',kicker,art,accent}){
  m.innerHTML=`${pageHead({kicker,title,sub,art,accent})}
  ${search?`<label class="hsearch lsearch">${ic('search',18)}<input id="lsearch" type="search" placeholder="Rechercher un jeu" autocomplete="off"></label>`:''}
  ${filters?`<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px"><div class="chips" id="fv">${['Toutes','Faible','Moyenne','Haute','Réglable'].map((v,i)=>`<button class="chip ${i?'':'on'}" data-v="${v}">${i?'Volatilité '+v.toLowerCase():'Toutes volatilités'}</button>`).join('')}</div><select class="sel" id="fs" aria-label="Trier"><option value="pop">Populaires</option><option value="az">A à Z</option><option value="new">Nouveautés</option><option value="rtp">RTP le plus haut</option></select></div>`:''}
  <div class="ggrid" id="gg"></div>`;
  let vol='Toutes',sort='pop',q=q0;
  const rtpN=g=>parseFloat(g.rtp.replace(',','.').replace(/[^\d.]/g,''))||0;
  const draw=()=>{let L=list.filter(g=>(vol==='Toutes'||g.vol.toLowerCase().endsWith(vol.toLowerCase()))&&(!q||g.name.toLowerCase().includes(q.toLowerCase())||CATS[g.cat].n.toLowerCase().includes(q.toLowerCase())));
    if(sort==='az')L=[...L].sort((a,b)=>a.name.localeCompare(b.name,'fr'));if(sort==='new')L=[...L].sort((a,b)=>(b.badge==='new')-(a.badge==='new'));if(sort==='rtp')L=[...L].sort((a,b)=>rtpN(b)-rtpN(a));if(sort==='pop')L=[...L].sort((a,b)=>(b.pop||0)-(a.pop||0));
    $('#gg',m).innerHTML=L.length?L.map(gcard).join(''):`<div class="empty" style="grid-column:1/-1">${empty||'<b>Aucun jeu ne correspond</b>Essaie un autre filtre ou un autre mot-clé.'}</div>`;bindFavs(m)};
  if(filters){$$('#fv .chip',m).forEach(c=>c.addEventListener('click',()=>{vol=c.dataset.v;$$('#fv .chip',m).forEach(x=>x.classList.toggle('on',x===c));draw()}));$('#fs',m).addEventListener('change',e=>{sort=e.target.value;draw()})}
  if(search){const i=$('#lsearch',m);i.value=q;i.addEventListener('input',()=>{q=i.value;draw()});if(q)i.focus()}
  draw();
}
V.games=(m,arg)=>listView(m,{kicker:'Catalogue',title:'Tous les jeux',sub:`${GL.length} jeux jouables avec tes jetons ◈ : machines à sous, tables, Originals et jeux instantanés.`,list:GL,search:true,q:arg?decodeURIComponent(arg):'',art:fan(['roulette','pharaon','crash'],'fan-ph')});
const CAT_ART={slots:['fruit','pharaon','dragon'],table:['blackjack','eclair','roulette'],originals:['mines','crash','plinko'],instant:['keno','wheel','plinko']};
const CAT_AC={slots:'#F2B340',table:'#22C58B',originals:'#8B5CF6',instant:'#34D399'};
V.cat=(m,k)=>{if(!CATS[k])k='slots';const c=CATS[k];const L=GL.filter(g=>g.cat===k);listView(m,{kicker:L.length+' jeux',title:c.n,sub:c.d+'.',list:L,art:fan(CAT_ART[k],'fan-ph'),accent:CAT_AC[k]})};
V.fav=m=>listView(m,{kicker:'Mes jeux',accent:'#F4526E',art:`<div class="phd-ic" style="--ac:#F4526E">${ic('heart',64)}</div>`,title:'Favoris',sub:'Touche le cœur d’un jeu pour le retrouver ici.',list:S.fav.map(id=>GAMES[id]).filter(Boolean),filters:false,empty:'<b>Aucun favori pour l’instant</b>Ajoute un jeu avec le cœur en haut à droite de sa vignette.'});
V.recent=m=>listView(m,{kicker:'Mes jeux',accent:'#5B9CF6',art:`<div class="phd-ic" style="--ac:#5B9CF6">${ic('clock',64)}</div>`,title:'Récemment joués',sub:'Tes derniers jeux, du plus récent au plus ancien.',list:S.recent.map(id=>GAMES[id]).filter(Boolean),filters:false,empty:'<b>Tu n’as encore rien joué</b><a class="gold" href="#/lobby">Choisis un jeu dans le lobby</a>.'});

/* ============ Page de jeu ============ */
const when=t=>{const d=new Date(t);return d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})};
V.game=(m,id)=>{
  const g=GAMES[id];if(!g){location.hash='#/lobby';return}
  S.recent=[id,...S.recent.filter(x=>x!==id)].slice(0,12);save();
  const mode=g.layout||'fit';
  document.documentElement.classList.add('gx-lock');
  m.innerHTML=`<div class="gx gx-${mode}" style="--ac:${ACCENT[id]||'#D4AF37'}">
    <div class="gx-top"><a class="gx-ib" href="#/lobby" aria-label="Retour au lobby">${ic('back',18)}</a>
      <img class="gx-cov" src="${COVER(id)}" alt="" width="300" height="400"><div class="gx-t"><b>${g.name}</b><span>RTP ${g.rtp} · ${g.vol}</span></div>
      <span class="gx-bal"><i>◈</i><b class="num" id="gxbal">${S.hideBal?'••••':fmt(S.balance)}</b></span>
      <button class="gx-ib fav ${isFav(id)?'on':''}" id="gfav" aria-label="Favori">${ic('heart',17)}</button>
      <button class="gx-ib" id="ginfo" aria-label="Historique, session et règles">${ic('chart',17)}</button></div>
    <section class="stage gx-stage" id="stage"></section></div>`;
  const stage=$('#stage',m),balEl=$('#gxbal',m);
  const onBal=()=>{balEl.textContent=S.hideBal?'••••':fmt(S.balance)};document.addEventListener('bal',onBal);
  $('#gfav',m).addEventListener('click',e=>{const on=toggleFav(id);e.currentTarget.classList.toggle('on',on);toast(on?'Ajouté à tes favoris':'Retiré de tes favoris')});
  let tab='h',sheetEl=null;
  const tabHTML=()=>{
    if(tab==='h'){const L=S.hist.filter(e=>e.g===id).slice(0,20);return L.length?L.map(e=>`<div class="hrow"><div><div>◈ ${fmt(e.bet)} ${e.info?`<span class="mu2">· ${esc(e.info)}</span>`:''}</div><div class="t">${when(e.t)} · n° ${e.id}</div></div><span class="pill ${e.bet===0?'y':e.win>e.bet?'g':e.win===0?'r':''}">${e.bet||e.ref?fmtM(e.mult):'Offert'}</span><b class="num ${e.win>e.bet?'pos':e.win<e.bet?'neg':''}">${e.win>0?'+'+fmt(e.win):'0'}</b></div>`).join(''):'<div class="empty"><b>Aucune partie</b>Tes 20 derniers coups apparaîtront ici.</div>'}
    if(tab==='s'){const s=sess.g[id]||{bet:0,win:0,n:0};const net=s.win-s.bet;const mins=Math.floor((Date.now()-sess.start)/60000);return `<div class="stats"><div class="st"><b>${s.n}</b><span>Parties sur ce jeu</span></div><div class="st"><b>◈ ${fmt(s.bet)}</b><span>Misé</span></div><div class="st"><b>◈ ${fmt(s.win)}</b><span>Gagné</span></div><div class="st"><b class="${net>0?'pos':net<0?'neg':''}">${net>0?'+':''}${fmt(net)}</b><span>Résultat net</span></div></div><p class="mu" style="font-size:12.5px;margin:14px 0 0">Session en cours : ${mins} min · ${fmt(sess.wag)} ◈ misés tous jeux confondus.</p>`}
    return `<div class="rules">${typeof g.rules==='function'?g.rules():g.rules}</div>`};
  $('#ginfo',m).addEventListener('click',()=>{snd('click');
    const md=modal(`<div class="gx-sheet"><div class="tabs" role="tablist">${[['h','Historique'],['s','Session'],['r','Règles']].map(([k,l])=>`<button class="tab ${tab===k?'on':''}" data-t="${k}" role="tab">${l}</button>`).join('')}</div><div class="gx-sh-b">${tabHTML()}</div><button class="btn btn-gold btn-big" data-close style="margin-top:12px">Retour au jeu</button></div>`);
    sheetEl=md.el;
    $$('.tab',md.el).forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.t;$$('.tab',md.el).forEach(x=>x.classList.toggle('on',x===b));$('.gx-sh-b',md.el).innerHTML=tabHTML()}))});
  const onR=e=>{if(e.detail.g===id&&tab!=='r'&&sheetEl&&sheetEl.isConnected)$('.gx-sh-b',sheetEl).innerHTML=tabHTML()};document.addEventListener('round',onR);
  const d=g.init(stage);
  /* Mise en page plein écran : zone de jeu ajustée à la hauteur, commandes fixées en bas */
  let ro=null,raf=0,lastKey='';
  function arrange(){
    if(mode!=='fit'||stage.querySelector(':scope>.gx-play'))return;
    const ctrls=[...stage.querySelectorAll('.ctrl')];const ctrl=ctrls[ctrls.length-1];
    const play=h('<div class="gx-play"><div class="gx-fit"></div></div>'),fit=play.firstChild;
    [...stage.childNodes].forEach(n=>{if(n!==ctrl)fit.appendChild(n)});
    stage.appendChild(play);if(ctrl){ctrl.classList.add('gx-dock');stage.appendChild(ctrl)}
    ro=new ResizeObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(refit)});ro.observe(play);ro.observe(fit);
    refit();
  }
  function refit(){
    const play=stage.querySelector(':scope>.gx-play');if(!play)return;const fit=play.firstChild;
    if(stage.parentNode.classList.contains('gx-imm')){fit.style.transform='';fit.style.width='';play.classList.remove('scroll');lastKey='';return}
    const A=play.clientHeight,W=play.clientWidth;if(!A||!W)return;
    const prevW=fit.style.width;let best=null;
    for(const k of [1,1/.9,1/.8,1/.7,1/.6,1/.5]){
      const w=Math.round(W*k);fit.style.width=w+'px';
      const hh=fit.scrollHeight,ww=Math.max(w,fit.scrollWidth),sc=Math.min(1,W/ww,A/hh);
      if(!best||sc>best.s+.004||(Math.abs(sc-best.s)<=.004&&Math.abs(k-1)<Math.abs(best.k-1)))best={s:sc,w,hh,ww,k};
    }
    const s=Math.max(.45,best.s),left=Math.max(0,(W-best.ww*s)/2),top=Math.max(0,(A-best.hh*s)/2);
    fit.style.width=best.w+'px';
    const key=[W,A,best.w,best.hh,s.toFixed(3)].join('|');if(key===lastKey&&prevW===fit.style.width)return;lastKey=key;
    fit.style.transform=`translate(${left}px,${top}px) scale(${s})`;play.classList.toggle('scroll',best.hh*s>A+1);
  }
  arrange();
  destroy=()=>{document.documentElement.classList.remove('gx-lock');document.removeEventListener('round',onR);document.removeEventListener('bal',onBal);if(ro)ro.disconnect();cancelAnimationFrame(raf);d&&d()};
};
