'use strict';
/* ============ Registre des jeux ============ */
const CATS={slots:{n:'Machines à sous',i:'slots',d:'Rouleaux, lignes et tours gratuits'},table:{n:'Jeux de table',i:'cards',d:'Roulette, blackjack, baccarat, poker'},originals:{n:'Originals',i:'zap',d:'Crash, Mines, Plinko et plus'},instant:{n:'Jeux instantanés',i:'ticket',d:'Keno, roue et cartes à gratter'}};
const GAMES={};const GL=[];
function reg(g){GAMES[g.id]=g;GL.push(g)}
const isFav=id=>S.fav.includes(id);
function toggleFav(id){S.fav=isFav(id)?S.fav.filter(x=>x!==id):[id,...S.fav];save();snd('click');return isFav(id)}
function gcard(g){return `<a class="gc" href="#/game/${g.id}" aria-label="${esc(g.name)} — ${CATS[g.cat].n}" style="--ac:${ACCENT[g.id]||'#D4AF37'}">
  <img class="gc-img" src="${COVER(g.id)}" alt="" loading="lazy" decoding="async" width="300" height="400">
  <span class="gc-shine" aria-hidden="true"></span>
  ${g.badge?`<span class="badge ${g.badge}">${{hot:'HOT',new:'NOUVEAU',jp:'JACKPOT'}[g.badge]}</span>`:''}
  <button class="gfav ${isFav(g.id)?'on':''}" data-fav="${g.id}" aria-label="Ajouter ${esc(g.name)} aux favoris">${ic('heart',15)}</button>
  <span class="gc-hov" aria-hidden="true"><span class="gc-play">${ic('play',22)}</span><span class="gc-meta"><span>RTP <b>${g.rtp}</b></span><span>Vol. <b>${g.vol}</b></span></span></span>
</a>`}
function bindFavs(root){$$('[data-fav]',root).forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const on=toggleFav(b.dataset.fav);b.classList.toggle('on',on);toast(on?'Ajouté à tes favoris':'Retiré de tes favoris')}))}
