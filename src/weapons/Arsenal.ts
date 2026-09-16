import {WEAPONS} from './catalog';
import type {WeaponSystem} from './WeaponSystem';
export class Arsenal {
 readonly element=document.createElement('section');
 readonly readout=document.createElement('div');
 readonly crosshair=document.createElement('div');
 open=false;
 onToggle?:(open:boolean)=>void;
 onSelect?:(id:number)=>void;
 constructor(container:HTMLElement,private weapons:WeaponSystem){
  this.element.className='arsenal';this.element.hidden=true;this.element.setAttribute('aria-label','Arsenal');
  this.element.innerHTML='<header><div><small>LOADOUT</small><h2>Arsenal</h2><p>All weapons unlocked · Select to equip</p></div><button class="arsenal-close">Close [Tab]</button></header><div class="arsenal-actions"><input type="search" placeholder="Find a weapon…" aria-label="Find a weapon"><button class="refill-ammo">Refill ammunition</button></div><div class="arsenal-grid"></div><p class="arsenal-help">Right mouse: aim · Left mouse / Ctrl: fire or use · R: reload / melee · Wheel: switch weapons</p>';
  const grid=this.element.querySelector('.arsenal-grid')!;
  for(const group of [...new Set(WEAPONS.map(w=>w.group))]){const section=document.createElement('section');section.innerHTML=`<h3>${group}</h3>`;for(const w of WEAPONS.filter(w=>w.group===group)){const button=document.createElement('button');button.dataset.weapon=String(w.id);button.textContent=w.name;button.onclick=()=>{weapons.inventory.select(w.id);this.onSelect?.(w.id);this.toggle(false);};section.append(button);}grid.append(section);}
  this.element.addEventListener('keydown',e=>{if(e.code==='Tab'||e.code==='Escape'){e.preventDefault();e.stopPropagation();this.toggle(false);}});
  this.element.querySelector('.arsenal-close')!.addEventListener('click',()=>this.toggle(false));
  this.element.querySelector('.refill-ammo')!.addEventListener('click',()=>{weapons.inventory.refill();this.update();});
  this.element.querySelector('input')!.addEventListener('input',e=>{const query=(e.target as HTMLInputElement).value.toLowerCase();for(const button of this.element.querySelectorAll<HTMLButtonElement>('[data-weapon]'))button.hidden=!button.textContent!.toLowerCase().includes(query);});
  this.readout.className='weapon-readout';this.crosshair.className='weapon-crosshair';this.crosshair.hidden=true;
  container.append(this.element,this.readout,this.crosshair);
 }
 toggle(open=!this.open){this.open=open;this.element.hidden=!open;this.onToggle?.(open);this.update();if(open)this.element.querySelector<HTMLInputElement>('input')!.focus();else (document.querySelector('canvas.world') as HTMLCanvasElement)?.focus();}
 update(error?:string){const s=this.weapons.snapshot(),w=this.weapons.inventory.weapon;this.readout.textContent=`${w.name}${s.twin?' ×2':''}${s.skill?` · ${s.skill[0].toUpperCase()}${s.skill.slice(1)}`:''}${s.magazine?` · ${s.clip}${s.reserve||w.reload?` / ${s.reserve}`:''}`:''}${s.reloading?' · Reloading…':s.ready?'':error?' · Asset unavailable':' · Loading…'}${s.vision?' · Vision on':''}${s.parachute?' · Chute deployed':''}`;this.readout.setAttribute('aria-label','Equipped weapon');this.crosshair.hidden=!this.weapons.aiming||this.open;this.crosshair.classList.toggle('scope',this.weapons.aiming&&w.id===34);this.crosshair.classList.toggle('locked',this.weapons.locked);for(const button of this.element.querySelectorAll<HTMLButtonElement>('[data-weapon]'))button.setAttribute('aria-pressed',String(Number(button.dataset.weapon)===s.id));}
 dispose(){this.element.remove();this.readout.remove();this.crosshair.remove();}
}
