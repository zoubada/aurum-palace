'use strict';
/* ============ Promotions ============ */
const DAILY=[500,1000,750,2500,500,1500,1000,5000];
const DCOL=['#1C2130','#B8860B','#262C3F','#10B981','#1C2130','#7C3AED','#262C3F','#E11D48'];
V.promo=m=>{
  const L=LEVELS[lvl()];const ms=todaysMissions();save();
  const next=()=>S.daily+864e5-Date.now();
  m.innerHTML=`${pageHead({kicker:'Bonus gratuits',title:'Promotions',sub:`Des jetons offerts chaque jour. Ton niveau VIP ${L.n} multiplie la roue par ${String(L.b).replace('.',',')}.`,art:GIFT(130),accent:'#E23B5A'})}
  <div class="grid2"><div class="pan pan-wheel" style="text-align:center"><span class="kick" style="--ac:#F2B340;align-self:center">${ic('sparkle',13)} Toutes les 24 h</span><h2 class="pt">Roue du jour</h2>
  <div class="wheel-mini"><div class="wheel-ptr"></div><div class="wm-bulbs">${Array.from({length:24},(_,i)=>`<i style="transform:rotate(${i*15}deg) translateY(calc(var(--wr) * -1))"></i>`).join('')}</div><svg viewBox="-150 -150 300 300"><circle r="148" fill="#0B0D12" stroke="#D4AF37" stroke-width="4"/>${wheelSVG(DAILY.map((v,i)=>({l:fmt(v*L.b),c:DCOL[i],fs:13})),{r:140,inner:34,id:'dw'})}<circle r="30" fill="#0B0D12" stroke="#F5D76E" stroke-width="3"/><text text-anchor="middle" dy=".35em" fill="#F5D76E" font-size="22" font-weight="800">◈</text></svg></div>
  <button class="btn btn-gold btn-big" id="dspin"></button></div>
  <div class="pan"><span class="kick" style="--ac:#22C58B">${ic('target',13)} Quotidien</span><h2 class="pt" style="text-align:left">Missions du jour</h2><p class="mu" style="margin:-4px 0 8px;font-size:13px">Elles changent chaque jour à minuit.</p><div id="mis"></div></div></div>
  <div class="grid2" style="margin-top:14px"><div class="pan bonus"><span class="bonus-ic" style="--ac:#F2B340">${ic('crown',26)}</span><div><h3>Bonus de bienvenue</h3><p class="mu">10 000 ◈ crédités à ton arrivée au Palace. ${S.welcomed?'<span class="pos">Déjà reçu.</span>':''}</p></div></div>
  <div class="pan bonus"><span class="bonus-ic" style="--ac:#22C58B">${ic('refresh',26)}</span><div><h3>Recharge gratuite</h3><p class="mu">Sous 1 000 ◈ ? Reçois 5 000 ◈, une fois par jour.</p><button class="btn btn-ghost btn-sm" id="refill"></button></div></div></div>`;
  const dsp=$('#dspin',m),g=$('#dw',m);let rot=0,busy=false;
  const upd=()=>{const t=next();if(busy)return;if(t<=0){dsp.disabled=false;dsp.textContent='Tourner la roue'}else{dsp.disabled=true;const hh=Math.floor(t/36e5),mm=Math.floor(t%36e5/6e4),ss=Math.floor(t%6e4/1e3);dsp.textContent=`Prochain tour dans ${hh} h ${String(mm).padStart(2,'0')} min ${String(ss).padStart(2,'0')} s`}};
  upd();const iv=setInterval(upd,1000);
  dsp.addEventListener('click',()=>{if(next()>0||busy)return;busy=true;dsp.disabled=true;dsp.textContent='La roue tourne…';const i=randInt(DAILY.length);const a=360/DAILY.length;rot+=360*6+(((-i*a-rot)%360)+360)%360;g.style.transition='transform 4.5s cubic-bezier(.15,.7,.1,1)';g.style.transform=`rotate(${rot}deg)`;const tk=setInterval(()=>snd('tick'),120);
    setTimeout(()=>{clearInterval(tk);const v=DAILY[i]*L.b;S.daily=Date.now();give(v);S.won=r2(S.won-v);save();snd('big');confetti(100,true);modal(`<div style="font-size:48px">🎁</div><h3 class="mt">Bonus du jour</h3><div class="big gtext">+ ${fmt(v)} ◈</div><button class="btn btn-gold btn-big" data-close>Super</button>`);busy=false;upd()},4600)});
  const drawM=()=>{$('#mis',m).innerHTML=ms.map(x=>{const p=S.mis.p[x.id]||0,done=p>=x.n,cl=S.mis.c[x.id];return `<div class="mis ${done?'done':''}"><span class="mis-ic">${ic(done?'check':'target',18)}</span><div class="mi"><b>${x.t}</b><span class="mu" style="font-size:12px">${fmt(Math.min(p,x.n))} / ${fmt(x.n)} · récompense ${fmt(x.r)} ◈</span><div class="bar"><i style="width:${Math.min(100,p/x.n*100)}%"></i></div></div><button class="btn btn-sm ${done&&!cl?'btn-gold':'btn-ghost'}" data-m="${x.id}" ${done&&!cl?'':'disabled'}>${cl?'Reçu':done?'Récupérer':'En cours'}</button></div>`}).join('');
    $$('[data-m]',m).forEach(b=>b.addEventListener('click',()=>{const x=ms.find(y=>y.id===b.dataset.m);S.mis.c[x.id]=1;give(x.r);S.won=r2(S.won-x.r);save();snd('coin');confetti(50,true);toast(`+ ${fmt(x.r)} ◈ reçus`,'win');drawM()}))};
  drawM();
  const rf=$('#refill',m);const drawRf=()=>{const ok=S.refill!==today()&&S.balance<1000;rf.disabled=!ok;rf.textContent=S.refill===today()?'Déjà utilisée aujourd’hui':S.balance<1000?'Recevoir 5 000 ◈':'Disponible sous 1 000 ◈'};drawRf();
  rf.addEventListener('click',()=>{S.refill=today();give(5000);S.won=r2(S.won-5000);save();snd('coin');confetti(60,true);drawRf()});
  destroy=()=>clearInterval(iv);
};

/* ============ VIP ============ */
V.vip=m=>{
  const i=lvl(),L=LEVELS[i],N=LEVELS[i+1];const pr=N?(S.wagered-L.x)/(N.x-L.x):1;
  m.innerHTML=`${pageHead({kicker:'Programme de fidélité',title:'Club VIP',sub:'Ton niveau progresse avec le total de tes mises. Chaque palier multiplie ta roue du jour et ajoute du cashback.',art:medal(5,130),accent:'#F5D76E'})}
  <div class="lvl-card" style="--lc:${L.c}"><div class="lvl-m">${medal(i,92)}</div><div class="lvl-c"><span class="mu" style="font-size:13px">Ton niveau</span><h2>${L.n}</h2><div class="bar" style="height:10px"><i style="width:${pr*100}%"></i></div><p class="mu" style="font-size:13px;margin:8px 0 0">${N?`${fmt(S.wagered)} ◈ misés · encore ${fmt(N.x-S.wagered)} ◈ pour ${N.n}`:'Tu as atteint le sommet du Palace.'}</p>
  <div style="display:flex;gap:10px;align-items:center;margin-top:16px;flex-wrap:wrap"><span>Cashback disponible : <b class="gold">◈ ${fmt(S.cb||0)}</b></span><button class="btn btn-gold btn-sm" id="cb" ${(S.cb||0)>=1?'':'disabled'}>Récupérer le cashback</button></div></div></div>
  <div class="lvls">${LEVELS.map((l,k)=>`<div class="lv ${k===i?'cur':''} ${k>i?'lock':''}" style="--lc:${l.c}"><div class="lv-h">${medal(k,52)}<div><h4>${l.n}</h4><span class="mu" style="font-size:12px">${k?'Dès '+fmt(l.x)+' ◈ misés':'Niveau de départ'}</span></div></div><ul>${l.p.map(p=>`<li>${p}</li>`).join('')}</ul></div>`).join('')}</div>`;
  $('#cb',m).addEventListener('click',()=>{const v=S.cb;S.cb=0;give(v);S.won=r2(S.won-v);save();snd('coin');toast(`Cashback de ${fmt(v)} ◈ crédité`,'win');V.vip(m)});
};

/* ============ Classement ============ */
function boardPlayers(){
  const wk=Math.floor((Date.now()/864e5+3)/7);let x=wk*9301+49297;const rnd=()=>{x=(Math.imul(x,1103515245)+12345)>>>0;return x/4294967296};
  return NAMES.concat(NAMES.map(n=>n+'_'+Math.floor(rnd()*90+10))).slice(0,58).map(n=>({n,a:['🦊','🐯','🦅','🐺','🦄','🐉','🦁','🐼','🐙','🦈'][Math.floor(rnd()*10)],win:Math.round(Math.pow(rnd(),3)*480000+2500),wag:Math.round(Math.pow(rnd(),2.2)*9e6+40000)}));
}
V.board=m=>{
  const players=boardPlayers();
  const me={n:S.name+' (toi)',a:S.avatar,win:S.best.win,wag:S.wagered,me:true};
  let mode='win';
  m.innerHTML=`${pageHead({kicker:'Cette semaine',title:'Classement',sub:'Remis à zéro chaque lundi. Les autres joueurs sont fictifs : le Palace est un casino de démonstration.',art:TROPHY(130),accent:'#F5D76E'})}<div class="seg" style="max-width:360px;margin-bottom:14px"><button class="on" data-k="win">Plus gros gain</button><button data-k="wag">Total misé</button></div><div id="lb"></div>`;
  const draw=()=>{const all=[...players,me].sort((a,b)=>b[mode]-a[mode]);const pos=all.indexOf(me);const top=all.slice(0,50);
    const pd=top.slice(0,3);$('#lb',m).innerHTML=`<div class="pod pod-page">${[1,0,2].map(k=>{const p=pd[k];return `<div class="pod-i p${k+1} ${p.me?'me':''}"><span class="pod-av">${p.a}</span><b>${esc(p.n)}</b><span class="num">◈ ${fmt(p[mode])}</span><div class="pod-b"><span>${k+1}</span></div></div>`}).join('')}</div>`+top.slice(3).map((p,k0)=>{const k=k0+3;return `<div class="lb-row ${p.me?'me':''}"><span class="rk ${k<3?'t'+(k+1):''}">${k+1}</span><span class="pn"><span>${p.a}</span><span>${esc(p.n)}</span></span><b class="num">◈ ${fmt(p[mode])}</b></div>`}).join('')+(pos>=50?`<p class="mu" style="text-align:center">…</p><div class="lb-row me"><span class="rk">${pos+1}</span><span class="pn"><span>${me.a}</span><span>${esc(me.n)}</span></span><b class="num">◈ ${fmt(me[mode])}</b></div>`:'')};
  $$('.seg button',m).forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.k;$$('.seg button',m).forEach(y=>y.classList.toggle('on',y===b));draw()}));draw();
};

/* ============ Profil ============ */
const AVS=['🦁','🐯','🦊','🐺','🦅','🐉','🦄','🐼','🐙','🦈','👑','🎩'];
V.profile=m=>{
  const net=S.won-S.wagered;const favG=Object.entries(S.played).sort((a,b)=>b[1]-a[1])[0];
  const li=lvl(),LV=LEVELS[li];
  m.innerHTML=`${pageHead({kicker:'VIP '+LV.n,title:esc(S.name),sub:`${S.rounds.toLocaleString('fr-FR')} parties jouées · ${Object.keys(S.ach).length} succès débloqués sur ${Object.keys(ACH).length}.`,art:`<div class="pf-av" style="--lc:${LV.c}"><span>${S.avatar}</span><i>${medal(li,44)}</i></div>`,accent:LV.c})}
  <div class="grid2"><div class="pan"><label class="field">Pseudo<input class="tin" id="pn" maxlength="18" value="${esc(S.name)}"></label><div class="field" style="margin-top:14px">Avatar<div class="avs">${AVS.map(a=>`<button class="${a===S.avatar?'on':''}" data-a="${a}" aria-label="Avatar ${a}">${a}</button>`).join('')}</div></div></div>
  <div class="pan"><div class="stats stats-ic"><div class="st"><i>${ic('gem',16)}</i><b>◈ ${fmt(S.balance)}</b><span>Solde actuel</span></div><div class="st"><i>${ic('chart',16)}</i><b>◈ ${fmt(S.wagered)}</b><span>Total misé</span></div><div class="st"><i>${ic('trophy',16)}</i><b>◈ ${fmt(S.best.win)}</b><span>Plus gros gain</span></div><div class="st"><i>${ic('rocket',16)}</i><b>${S.best.mult?fmtM(S.best.mult):'—'}</b><span>Meilleur multiplicateur</span></div><div class="st"><i>${ic('scale',16)}</i><b class="${net>=0?'pos':'neg'}">${net>=0?'+':''}${fmt(net)}</b><span>Résultat des jeux</span></div><div class="st"><i>${ic('heart',16)}</i><b>${favG?GAMES[favG[0]]?.name||'—':'—'}</b><span>Jeu préféré</span></div></div></div></div>
  <div class="sec"><div class="sec-t"><span class="sec-ic">${ic('star',18)}</span><h2>Succès</h2></div><span class="mu" style="font-size:13px">${Object.keys(S.ach).length} / ${Object.keys(ACH).length}</span></div>
  <div class="achs">${Object.entries(ACH).map(([k,a])=>`<div class="ach ${S.ach[k]?'':'lock'}"><div class="e">${a.i}</div><b>${a.n}</b><span>${a.d}</span></div>`).join('')}</div>
  <div class="sec"><div class="sec-t"><span class="sec-ic">${ic('clock',18)}</span><h2>Historique</h2></div><a href="#/fair">Voir les tirages</a></div>
  <div class="pan" style="padding:6px 14px">${S.hist.length?S.hist.slice(0,50).map(e=>`<div class="hrow"><div><div>${GAMES[e.g]?.name||e.g} · ◈ ${fmt(e.bet)}</div><div class="t">${new Date(e.t).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} · n° ${e.id}</div></div><span class="pill ${e.bet===0?'y':e.win>e.bet?'g':e.win===0?'r':''}">${e.bet?fmtM(e.mult):'Offert'}</span><b class="num ${e.win>e.bet?'pos':e.win<e.bet?'neg':''}">${e.win>0?'+'+fmt(e.win):'0'}</b></div>`).join(''):'<div class="empty" style="margin:10px 0"><b>Aucune partie</b>Lance un jeu depuis le lobby.</div>'}</div>`;
  $('#pn',m).addEventListener('change',e=>{S.name=e.target.value.trim().slice(0,18)||'Joueur';save();toast('Pseudo enregistré')});
  $$('.avs button',m).forEach(b=>b.addEventListener('click',()=>{S.avatar=b.dataset.a;save();renderAvatar();$$('.avs button',m).forEach(x=>x.classList.toggle('on',x===b))}));
};

/* ============ Jeu responsable ============ */
V.rg=m=>{
  m.innerHTML=`${pageHead({kicker:'Garde le contrôle',title:'Jeu responsable',sub:'Même avec des jetons sans valeur, garde le contrôle de ton temps de jeu.',art:SHIELD(120,'check'),accent:'#22C58B'})}
  <div class="grid2"><div class="pan"><h3 style="font-family:var(--fd);margin:0 0 12px">Ta session</h3><div class="stats"><div class="st"><b id="rgt">0 min</b><span>Temps de jeu</span></div><div class="st"><b>◈ ${fmt(sess.wag)}</b><span>Misé cette session</span></div></div>
  <label class="field" style="margin-top:16px">Limite de temps par session (minutes, 0 = aucune)<input class="tin" id="lt" inputmode="numeric" value="${S.lim.time||0}"></label>
  <label class="field" style="margin-top:12px">Limite de mises par session (◈, 0 = aucune)<input class="tin" id="lw" inputmode="numeric" value="${S.lim.wager||0}"></label>
  <button class="btn btn-gold" id="lsave" style="margin-top:14px">Enregistrer mes limites</button>
  <p class="mu" style="font-size:12.5px;margin:12px 0 0">Un rappel de pause s’affiche automatiquement toutes les 60 minutes de jeu.</p></div>
  <div class="pan"><h3 style="font-family:var(--fd);margin:0 0 8px">Les bons réflexes</h3><div class="rules"><p>Le hasard n’a pas de mémoire : une série de pertes n’annonce pas un gain.</p><p>Chaque jeu a un avantage pour la maison, affiché dans son RTP. Sur la durée, le solde baisse en moyenne.</p><p>Fixe-toi une durée avant de jouer, et fais des pauses.</p><p>Si le jeu d’argent prend trop de place dans ta vie ou celle d’un proche, parles-en : <b>Joueurs Info Service, 09 74 75 13 13</b>, appel non surtaxé, 7 j/7 de 8 h à 2 h, ou joueurs-info-service.fr.</p></div>
  <h3 style="font-family:var(--fd);margin:18px 0 8px">Repartir de zéro</h3><p class="mu" style="font-size:13px;margin:0 0 12px">Remet ton solde à 10 000 ◈ et efface ton historique. Tes succès sont conservés.</p><button class="btn btn-ghost" id="reset">Réinitialiser mon solde</button></div></div>`;
  const tick=()=>{const e=$('#rgt',m);if(e)e.textContent=Math.floor((Date.now()-sess.start)/60000)+' min'};tick();const iv=setInterval(tick,5000);
  $('#lsave',m).addEventListener('click',()=>{S.lim.time=Math.max(0,parseInt($('#lt',m).value)||0);S.lim.wager=Math.max(0,parseNum($('#lw',m).value)||0);save();toast('Limites enregistrées','win')});
  $('#reset',m).addEventListener('click',()=>{const md=modal(`<h3 class="mt">Réinitialiser ton solde ?</h3><p class="mp">Ton solde revient à 10 000 ◈ et ton historique est effacé.</p><button class="btn btn-red btn-big" id="yes">Réinitialiser</button><button class="btn btn-ghost btn-big" style="margin-top:8px" data-close>Annuler</button>`);$('#yes',md.el).addEventListener('click',()=>{Object.assign(S,{balance:10000,wagered:0,won:0,rounds:0,best:{win:0,mult:0,game:''},hist:[],played:{},cb:0,rh:[],bh:[]});lastLvl=0;save();renderBal();renderAvatar();md.close();toast('Solde réinitialisé à 10 000 ◈','win')})});
  destroy=()=>clearInterval(iv);
};

/* ============ Équité ============ */
V.fair=m=>{
  m.innerHTML=`${pageHead({kicker:'Transparence',title:'Équité et hasard',sub:`Chaque résultat du Palace est tiré par <b>crypto.getRandomValues()</b>, le générateur cryptographique de ton navigateur. Aucun jeu n’ajuste ses chances en fonction de tes gains ou de tes pertes.`,art:SHIELD(120,'scale'),accent:'#5B9CF6'})}
  <div class="pan rules"><p>Pour chaque partie, le Palace enregistre un numéro de tirage et les premières valeurs aléatoires utilisées (nombres entre 0 et 1). Elles déterminent directement le résultat : la case de roulette, le point de crash, la position des mines, etc.</p><p>Les probabilités et tables de gains affichées dans l’onglet Règles de chaque jeu sont les vraies. Le RTP indiqué est le pourcentage des mises redistribué en moyenne sur un très grand nombre de parties.</p></div>
  <div class="sec"><div class="sec-t"><span class="sec-ic">${ic('dice',18)}</span><h2>Derniers tirages</h2></div></div><div class="pan" style="padding:6px 14px">${S.hist.slice(0,30).map(e=>`<div class="hrow" style="grid-template-columns:1fr auto"><div><div><b>n° ${e.id}</b> · ${GAMES[e.g]?.name||e.g} ${e.info?'· '+esc(e.info):''}</div><div class="t" style="word-break:break-all">${e.rng&&e.rng.length?'Tirages : '+e.rng.join(' · '):'Tirage sur sabot mélangé en début de partie'}</div></div><b class="num ${e.win>e.bet?'pos':e.win<e.bet?'neg':''}">${fmtM(e.mult)}</b></div>`).join('')||'<div class="empty" style="margin:10px 0"><b>Aucun tirage</b>Joue une partie pour voir ses valeurs ici.</div>'}</div>`;
};
