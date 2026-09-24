import type {WantedSystem} from '../simulation/WantedSystem';
/** Edge-aligned wanted stars. CHud::DrawWanted (0x58D9A0) is still a retail stub upstream, so this follows
 * its Vice City ancestor (reVC CHud::Draw): six stars, the wanted ones gold and the rest dark, and for 2 s
 * after the level changes the wanted stars are drawn only on frames where the 30 fps frame counter has bit
 * 4 set, so they blink. Like the original it shows no instructions. */
export const WANTED_BLINK_MS=2000;
/** Whether the wanted stars are drawn this frame. */
export function wantedStarsDrawn(nowMs:number,changedAtMs:number){return nowMs>changedAtMs+WANTED_BLINK_MS||(Math.floor(nowMs*30/1000)&4)!==0;}
export class WantedHud {
 readonly element=document.createElement('div');
 private lastLevel=0;private changedAt=-Infinity;
 constructor(container:HTMLElement){this.element.className='wanted-status';this.element.hidden=true;this.element.innerHTML='<span class="wanted-stars" aria-hidden="true"><b></b><i></i></span>';this.element.setAttribute('role','status');container.append(this.element);}
 private on?:HTMLElement;private off?:HTMLElement;private shownLevel=-1;private shownSearching?:boolean;private shownDrawn?:boolean;
 /** `nowMs` is game time: the blink counts the game's 30 fps frames and stops while paused. Writes only what changed. */
 update(law:WantedSystem,nowMs=performance.now()){
  const level=law.level,searching=law.snapshot().searching;
  if(level!==this.lastLevel){this.lastLevel=level;this.changedAt=nowMs;}
  const on=this.on??=this.element.querySelector('b')!,off=this.off??=this.element.querySelector('i')!;
  if(level!==this.shownLevel){
   this.shownLevel=level;this.element.hidden=!level;
   // Dark stars on the left, gold ones on the right, as they are right-justified from the edge.
   off.textContent='★'.repeat(6-level);on.textContent='★'.repeat(level);this.element.setAttribute('aria-label',`${level} wanted stars`);
  }
  if(searching!==this.shownSearching){this.shownSearching=searching;this.element.classList.toggle('searching',searching);}
  const drawn=wantedStarsDrawn(nowMs,this.changedAt);
  if(drawn!==this.shownDrawn){this.shownDrawn=drawn;on.style.visibility=drawn?'visible':'hidden';}
 }
 dispose(){this.element.remove();}
}
