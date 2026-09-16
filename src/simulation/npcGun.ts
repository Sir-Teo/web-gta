import type {NativeWeaponInfo} from '../weapons/weaponData';
export interface NpcGunState {time:number;rounds:number;reload:number;active:boolean}
/** Native weapon.dat fire marker and loop boundaries. Burst selection/aim
 * acquisition are browser policy; never substitute wanted level for gun cadence. */
export function stepNpcGun(state:NpcGunState,info:NativeWeaponInfo,reloadSeconds:number,dt:number,engaged:boolean){
 if(state.reload>0){state.reload=Math.max(0,state.reload-dt);state.active=false;state.time=0;if(!state.reload)state.rounds=info.clip;return false;}
 if(!engaged){state.time=0;state.active=false;return false;}
 state.active=true;
 const before=state.time;state.time+=dt;
 let fired=before<=info.loop.fire&&state.time>info.loop.fire;
 if(state.time>=info.loop.end){
  state.time=info.loop.start+(state.time-info.loop.end);
  fired ||= info.loop.fire>=info.loop.start&&state.time>info.loop.fire;
 }
 if(fired&&--state.rounds<=0){state.reload=reloadSeconds;state.active=false;state.time=0;return true;}
 return fired;
}
