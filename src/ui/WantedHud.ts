import type {WantedSystem} from '../simulation/WantedSystem';
/** Edge-aligned wanted stars. CHud::DrawWanted (0x58D9A0) is still a retail stub upstream, so the
 * layout is the browser's; like the original it shows only the stars, with no instructions. */
export class WantedHud {
 readonly element=document.createElement('div');
 constructor(container:HTMLElement){this.element.className='wanted-status';this.element.hidden=true;this.element.innerHTML='<span class="wanted-stars" aria-hidden="true"></span>';this.element.setAttribute('role','status');container.append(this.element);}
 update(law:WantedSystem){const state=law.snapshot();this.element.hidden=!state.level;this.element.classList.toggle('searching',state.searching);this.element.querySelector('span')!.textContent='★'.repeat(state.level)+'☆'.repeat(6-state.level);this.element.setAttribute('aria-label',`${state.level} wanted stars`);}
 dispose(){this.element.remove();}
}
