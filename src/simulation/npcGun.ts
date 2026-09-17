import {CROSSHAIR_TANGENT,nativeWeaponRadiusOnScreen,type NativeWeaponInfo} from '../weapons/weaponData';
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
/** CTaskSimpleUseGun weapon-class dispersion: shotguns spray, SMGs/miniguns
 * drift, rifles and the sniper stay tight (multipliers on the weapon radius). */
export function npcWeaponSpread(type:number){
 if(type===25||type===26||type===27)return 1.7;
 if(type===30||type===31)return 0.7;
 if(type===34)return 0.5;
 if(type===38)return 1.5;
 if(type===28||type===29||type===32)return 1.2;
 return 1;
}
/** NPC dispersion from the same native weapon radius as the player crosshair:
 * officers no longer land perfect muzzle rays (CTaskSimpleUseGun spread).
 * CCopPed shooting accuracy (street 60, SWAT 68, FBI 76, army 84) scales the
 * cone; street cops fire the unscaled radius and elites tighten proportionally. */
export function npcAimSpread(direction:{x:number;y:number;z:number},info:NativeWeaponInfo,accuracy=60){
 const angle=Math.atan(nativeWeaponRadiusOnScreen(info,0,false)*CROSSHAIR_TANGENT)*npcWeaponSpread(info.type)*(60/Math.max(1,accuracy)),r=angle*Math.sqrt(Math.random()),theta=Math.random()*Math.PI*2;
 const norm=(v:{x:number;y:number;z:number})=>{const l=Math.hypot(v.x,v.y,v.z)||1;return {x:v.x/l,y:v.y/l,z:v.z/l};};
 const right=norm({x:-direction.z,y:0,z:direction.x}),up=norm({x:-direction.y*direction.x,y:direction.x**2+direction.z**2,z:-direction.y*direction.z});
 const scattered={x:direction.x+right.x*Math.cos(theta)*r+up.x*Math.sin(theta)*r,y:direction.y+right.y*Math.cos(theta)*r+up.y*Math.sin(theta)*r,z:direction.z+right.z*Math.cos(theta)*r+up.z*Math.sin(theta)*r};
 return {vector:norm(scattered),maxAngle:angle};
}
