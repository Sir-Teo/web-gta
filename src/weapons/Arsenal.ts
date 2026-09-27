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
  this.element.innerHTML='<header><div><small>LOADOUT</small><h2>Arsenal</h2><p>All weapons unlocked · Select to equip</p></div><button class="arsenal-close">Close [Esc]</button></header><div class="arsenal-actions"><input type="search" placeholder="Find a weapon…" aria-label="Find a weapon"><button class="refill-ammo">Refill ammunition</button></div><div class="arsenal-grid"></div><p class="arsenal-help">Right mouse: aim · Left mouse / Ctrl: fire or use · R: melee · Wheel: switch weapons, or zoom a scope</p>';
  const grid=this.element.querySelector('.arsenal-grid')!;
  for(const group of [...new Set(WEAPONS.map(w=>w.group))]){const section=document.createElement('section');section.innerHTML=`<h3>${group}</h3>`;for(const w of WEAPONS.filter(w=>w.group===group)){const button=document.createElement('button');button.dataset.weapon=String(w.id);button.textContent=w.name;button.onclick=()=>{weapons.inventory.select(w.id);this.onSelect?.(w.id);this.toggle(false);};section.append(button);}grid.append(section);}
  // Escape closes; Tab and Shift+Tab move through the controls and wrap round inside the open arsenal.
  this.element.addEventListener('keydown',e=>{
   if(e.code==='Escape'){e.preventDefault();e.stopPropagation();this.toggle(false);return;}
   if(e.code!=='Tab')return;e.stopPropagation();
   const controls=[...this.element.querySelectorAll<HTMLElement>('button,input')].filter(c=>!c.hidden&&!(c.closest('[hidden]')));
   const at=controls.indexOf(document.activeElement as HTMLElement),first=controls[0],last=controls[controls.length-1];
   if(e.shiftKey&&(at<=0)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(at<0||at===controls.length-1)){e.preventDefault();first?.focus();}
  });
  this.element.querySelector('.arsenal-close')!.addEventListener('click',()=>this.toggle(false));
  this.element.querySelector('.refill-ammo')!.addEventListener('click',()=>{weapons.inventory.refill();this.update();});
  // A search hides the weapons that do not match, the groups left with none, and says so when nothing matches.
  const empty=document.createElement('p');empty.className='arsenal-empty';empty.textContent='No weapons found.';empty.hidden=true;grid.after(empty);
  this.element.querySelector('input')!.addEventListener('input',e=>{
   const query=(e.target as HTMLInputElement).value.trim().toLowerCase();let shown=0;
   for(const section of grid.querySelectorAll<HTMLElement>(':scope > section')){
    let any=false;for(const button of section.querySelectorAll<HTMLButtonElement>('[data-weapon]')){button.hidden=!button.textContent!.toLowerCase().includes(query);if(!button.hidden){any=true;shown++;}}
    section.hidden=!any;
   }
   empty.hidden=shown>0;
  });
  this.readout.className='weapon-readout';this.readout.setAttribute('aria-label','Equipped weapon');this.crosshair.className='weapon-crosshair';this.crosshair.hidden=true;
  // CHud::DrawCrossHairs draws a first-person crosshair raster four times, mirrored into each quarter.
  for(let i=0;i<4;i++)this.crosshair.append(document.createElement('i'));
  // CHud::Draw draws the crosshairs before the rest of the HUD, which covers them.
  container.prepend(this.crosshair);container.append(this.element,this.readout);
 }
 toggle(open=!this.open){this.open=open;this.element.hidden=!open;this.onToggle?.(open);this.update();if(open)this.element.querySelector<HTMLInputElement>('input')!.focus();else (document.querySelector('canvas.world') as HTMLCanvasElement)?.focus();}
 /** `scope` is the held weapon's CROSSHAIR raster as an image URL. */
 /** hud.txd's siteM16 and siterocket as image URLs, once loaded. */
 hudSprites:Record<string,string>={};
 /** What update() last wrote, so a frame that changes nothing writes nothing to the document. */
 private pressedId?:number;private shownRadius?:number;
 update(error?:string,scope?:string){
  // Read only what the HUD shows: the full weapon snapshot (projectiles, shots, fires) is for the dev API, not every frame.
  const s={ready:this.weapons.ready,id:this.weapons.inventory.selected},w=this.weapons.inventory.weapon;
  // The original HUD has no weapon name, skill or state line; CHud::DrawAmmo draws the ammo under the icon.
  // Only a failed weapon asset is reported here.
  {const text=!s.ready&&error?`${w.name} · Asset unavailable`:'';if(this.readout.textContent!==text)this.readout.textContent=text;}
  // CHud::DrawCrossHairs draws each raster four times, mirrored into each quarter:
  // - the sniper's and camera's CROSSHAIR quarters span 210 × 210 and 256 × 192 of the 640 × 448 frame around the centre;
  // - the rocket's siterocket quarters are 24 × 24, 20 from the centre;
  // - in the aim camera, siteM16 quarters span 64 × the weapon radius, with a dot at the 0.2 minimum, for PISTOL to
  //   COUNTRYRIFLE, the flamethrower and the minigun only.
  // DRAW_CROSSHAIR forces the aim camera's siteM16 circle whatever is held.
  const forced=this.weapons.forceCrosshair,mode=this.weapons.firstPerson,circle=!mode&&(forced||w.id>=22&&w.id<=33||w.id===37||w.id===38);
  const image=mode==='sniper'||mode==='camera'?scope:mode==='rocket'||mode==='rocketHs'?this.hudSprites.siterocket:circle?this.hudSprites.siteM16:undefined;
  this.crosshair.hidden=!(this.weapons.aiming||forced)||this.open||!mode&&!circle;
  const scoped=(mode==='sniper'||mode==='camera')&&!!image,rocket=!!mode&&!scoped&&mode!=='sniper'&&mode!=='camera'&&!!image;
  this.crosshair.classList.toggle('native-scope',scoped);this.crosshair.classList.toggle('camera',scoped&&mode==='camera');
  this.crosshair.classList.toggle('native-rocket',rocket);this.crosshair.classList.toggle('native-site',circle&&!!image);
  this.crosshair.classList.toggle('scope',mode==='sniper'&&!image);this.crosshair.classList.toggle('site',!!mode&&!image&&mode!=='sniper');
  if(image&&this.crosshair.dataset.image!==image){this.crosshair.dataset.image=image;this.crosshair.style.setProperty('--scope-image',`url("${image}")`);}
  const radius=this.weapons.crosshairRadius;if(radius!==this.shownRadius){this.shownRadius=radius;this.crosshair.style.setProperty('--crosshair-radius',String(radius));}this.crosshair.classList.toggle('dot',radius<=.2&&circle);if(s.id!==this.pressedId){this.pressedId=s.id;for(const button of this.element.querySelectorAll<HTMLButtonElement>('[data-weapon]'))button.setAttribute('aria-pressed',String(Number(button.dataset.weapon)===s.id));}}
 dispose(){this.element.remove();this.readout.remove();this.crosshair.remove();}
}
