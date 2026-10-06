import type {NativeWeaponInfo} from '../weapons/weaponData';
export interface NpcGunState {time:number;rounds:number;reload:number;active:boolean;
 /** CTaskSimpleGunControl: the rounds left in the burst, and the seconds until the next one (m_nextAtkTimeMs). */
 burstLeft?:number;pause?:number}
/** DEFAULT_GUN_ATTACK_PERIOD (0x8D2E78) is a value in the executable that the reference does not carry; the browser's
 * own 1000 ms stands in for it. */
export const GUN_ATTACK_PERIOD_MS=1000;
/** CTaskSimpleGunControl's burst: min(4 × the ped's shooting rate / 30, the clip) less 0 or 1, at least 1. */
export function npcBurstLength(clip:number,shootingRate:number,random:()=>number=Math.random){
 let n=clip;
 if(n>1&&shootingRate<100){n=Math.min(Math.trunc(4*shootingRate/30),n);n=Math.max(n-Math.floor(random()*2),1);}
 return n;
}
/** The pause before a burst: the attack period (twice it for projectiles) × 0.75 to 1.25 / (rate × 0.04), in seconds. */
export function npcBurstPause(projectile:boolean,shootingRate:number,random:()=>number=Math.random){
 return (projectile?2:1)*GUN_ATTACK_PERIOD_MS*(.75+random()*.5)/(Math.max(1,shootingRate)*.04)/1000;
}
/** Native weapon.dat fire marker and loop boundaries. With `burst` (a ped's CPed::m_nWeaponShootingRate, 40 unless set)
 * the gun fires in CTaskSimpleGunControl's bursts with a pause before each; without it, it fires every loop. */
export function stepNpcGun(state:NpcGunState,info:NativeWeaponInfo,reloadSeconds:number,dt:number,engaged:boolean,burst?:{rate:number;random?:()=>number}){
 if(state.reload>0){state.reload=Math.max(0,state.reload-dt);state.active=false;state.time=0;if(!state.reload)state.rounds=info.clip;return false;}
 // A gun-control task starts with m_nextAtkTimeMs at 0, so each engagement opens with a burst at once.
 if(!engaged){state.time=0;state.active=false;state.pause=undefined;state.burstLeft=0;return false;}
 if(burst){
  state.pause??=0;
  if(state.pause>0){state.pause=Math.max(0,state.pause-dt);state.active=false;state.time=0;return false;}
  if(!state.burstLeft)state.burstLeft=npcBurstLength(info.clip,burst.rate,burst.random);
 }
 state.active=true;
 const before=state.time;state.time+=dt;
 let fired=before<=info.loop.fire&&state.time>info.loop.fire;
 if(state.time>=info.loop.end){
  state.time=info.loop.start+(state.time-info.loop.end);
  fired ||= info.loop.fire>=info.loop.start&&state.time>info.loop.fire;
 }
 if(fired&&burst&&--state.burstLeft!<=0){state.burstLeft=0;state.pause=npcBurstPause(info.fire==='projectile',burst.rate,burst.random);state.active=false;state.time=0;}
 // A reload drops what is left of the burst: back in FIREBURST the last command was RELOAD, so the attack timer restarts
 // and a fresh pause follows the reload.
 if(fired&&--state.rounds<=0){state.reload=reloadSeconds;state.active=false;state.time=0;if(burst){state.burstLeft=0;state.pause=npcBurstPause(info.fire==='projectile',burst.rate,burst.random);}return true;}
 return fired;
}
/** The shotguns, whose shot takes no random end point (their pellets spread instead). */
export const SHOTGUN_TYPES:ReadonlySet<number>=new Set([25,26,27]);
/** CWeapon::FireInstantHit's line for a ped that is not the player, aiming at a target (the iOS executable's, at
 * 0x100494b6c; SA's is unreversed): the line runs from the muzzle through the target to the weapon's range, times
 * TargetWeaponRangeMultiplier (3 when the target is, or is in, a vehicle that is not a bike), and its end moves by
 * spread × (U(±0.2), U(±0.2), U(±0.1)) native units, spread being (100 − CPed::m_nWeaponAccuracy) over the weapon.dat
 * row's accuracy (none for a shotgun); against the player it is scaled by 0.8 + 0.3 × min(his speed, 0.33) / 0.33 (units
 * a frame). So the error is fixed at the range's end, an angle that does not grow with the target's distance, and the
 * shooter's own movement does not enter. Renderer axes in and out (native x, y, z are x, −z, y). */
export function npcShotEnd(start:{x:number;y:number;z:number},target:{x:number;y:number;z:number},info:{type:number;weaponRange:number;accuracy:number},accuracy:number,
 o:{targetIsPlayer?:boolean;targetSpeed?:number;rangeMultiplier?:number}={},random:()=>number=Math.random){
 const f=Math.fround,dx=target.x-start.x,dy=target.y-start.y,dz=target.z-start.z,length=Math.max(Math.hypot(dx,dy,dz),.01),reach=f(info.weaponRange*(o.rangeMultiplier??1));
 const end={x:start.x+dx/length*reach,y:start.y+dy/length*reach,z:start.z+dz/length*reach};
 let spread=SHOTGUN_TYPES.has(info.type)?0:f((100-accuracy)/info.accuracy);
 if(spread>0&&o.targetIsPlayer)spread=f(spread*(.8+.3*Math.min(o.targetSpeed??0,.33)/.33));
 if(spread>0){end.x+=spread*(random()*.4-.2);end.z-=spread*(random()*.4-.2);end.y+=spread*(random()*.2-.1);}
 return end;
}
/** SetUpPelletCol (iOS 0x100499000): a shotgun's pellets (eight for the SPAS 12, fifteen otherwise), the first down the
 * line and each other at a random angle and a distance from it of U(0.2, 1) × the depth, |hit − start| × 1.3 × the
 * spread rate (0.05 over the weapon's accuracy). */
export const shotgunPelletCount=(type:number)=>type===27?8:15;
export function shotgunPelletOffset(depth:number,random:()=>number=Math.random){
 const angle=random()*2*Math.PI-Math.PI,r=.2*depth+random()*.8*depth;
 return {across:Math.cos(angle)*r,up:Math.sin(angle)*r};
}
