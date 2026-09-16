import type {WantedSystem} from '../simulation/WantedSystem';
/** Edge-aligned wanted indicator; world simulation owns pursuit and arrest time. */
export class WantedHud {
 readonly element=document.createElement('div');
 readonly busted=document.createElement('div');
 constructor(container:HTMLElement){this.element.className='wanted-status';this.element.hidden=true;this.element.innerHTML='<span class="wanted-stars" aria-hidden="true"></span><small></small>';this.element.setAttribute('role','status');this.busted.className='busted-overlay';this.busted.hidden=true;this.busted.textContent='Busted';container.append(this.element,this.busted);}
 update(law:WantedSystem){const state=law.snapshot();this.element.hidden=!state.level;this.element.classList.toggle('searching',state.searching);this.element.querySelector('span')!.textContent='★'.repeat(state.level)+'☆'.repeat(6-state.level);const action=state.surrendering?'Surrendering — stay still':state.searching?'Searching — stay out of sight':'Pursuit · Hold H to surrender';this.element.querySelector('small')!.textContent=action;this.element.setAttribute('aria-label',`${state.level} wanted stars. ${action}`);this.busted.hidden=state.arrestRemaining<=0;}
 dispose(){this.element.remove();this.busted.remove();}
}
