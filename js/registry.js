'use strict';
/* ============ Registre des jeux ============ */
const CATS={slots:{n:'Machines à sous',i:'slots',d:'Rouleaux, lignes et tours gratuits'},table:{n:'Jeux de table',i:'cards',d:'Roulette, blackjack, baccarat, poker'},originals:{n:'Originals',i:'zap',d:'Crash, Mines, Plinko et plus'},instant:{n:'Jeux instantanés',i:'ticket',d:'Keno, roue et cartes à gratter'}};
const GAMES={};const GL=[];
function reg(g){GAMES[g.id]=g;GL.push(g)}
const isFav=id=>S.fav.includes(id);
function toggleFav(id){S.fav=isFav(id)?S.fav.filter(x=>x!==id):[id,...S.fav];save();snd('click');return isFav(id)}
function gcard(g){return `<a class="gc" href="#/game/${g.id}" aria-label="${esc(g.name)}">
  <div class="art" style="background:${g.bg}"><div class="glyph">${g.art||g.glyph}</div></div>
  ${g.badge?`<span class="badge ${g.badge}">${{hot:'HOT',new:'NOUVEAU',jp:'JACKPOT'}[g.badge]}</span>`:''}
  <button class="gfav ${isFav(g.id)?'on':''}" data-fav="${g.id}" aria-label="Ajouter aux favoris">${ic('heart',15)}</button>
  <div class="nm"><span class="gc-t">${esc(g.name)}</span><span class="pv">${CATS[g.cat].n}</span>
  <span class="gc-meta"><span>RTP <b>${g.rtp}</b></span><span>Vol. <b>${g.vol}</b></span></span></div>
</a>`}
function bindFavs(root){$$('[data-fav]',root).forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const on=toggleFav(b.dataset.fav);b.classList.toggle('on',on);toast(on?'Ajouté à tes favoris':'Retiré de tes favoris')}))}
