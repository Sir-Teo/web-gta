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
 update(law:WantedSystem,nowMs=performance.now()){
  const state=law.snapshot();this.element.hidden=!state.level;this.element.classList.toggle('searching',state.searching);
  if(state.level!==this.lastLevel){this.lastLevel=state.level;this.changedAt=nowMs;}
  const on=this.element.querySelector('b')!,off=this.element.querySelector('i')!;
  // Dark stars on the left, gold ones on the right, as they are right-justified from the edge.
  off.textContent='★'.repeat(6-state.level);on.textContent='★'.repeat(state.level);
  on.style.visibility=wantedStarsDrawn(nowMs,this.changedAt)?'visible':'hidden';
  this.element.setAttribute('aria-label',`${state.level} wanted stars`);
 }
 dispose(){this.element.remove();}
}
