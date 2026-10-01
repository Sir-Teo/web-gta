import {CROSSHAIR_TANGENT,nativeWeaponRadiusOnScreen,type NativeWeaponInfo} from '../weapons/weaponData';
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
/** Weapon-class dispersion (AUTHORED: CWeapon::FireInstantHit, which aims an AI shot, is unreversed, and the reversed
 * CTaskSimpleUseGun applies no spread): shotguns spray, SMGs/miniguns drift, rifles and the sniper stay tight. */
export function npcWeaponSpread(type:number){
 if(type===25||type===26||type===27)return 1.7;
 if(type===30||type===31)return 0.7;
 if(type===34)return 0.5;
 if(type===38)return 1.5;
 if(type===28||type===29||type===32)return 1.2;
 return 1;
}
/** Where an AI shooter's round is sent: the point it aims at, moved by its inaccuracy (100 − CPed::m_nWeaponAccuracy).
 * AUTHORED in the shape of the earlier games' CWeapon::FireInstantHit, which moves an AI's target point by a random
 * amount in proportion to its inaccuracy (SA's FireInstantHit is unreversed): up to ±0.02 × it across the ground and
 * ±0.01 × it up at ten units. The offset grows with the range (an angular error, not a fixed one: a fixed ±0.8 units
 * let a street cop land a third of his rounds from forty units as from ten) and by half again on a target that moves
 * (the shooter aims where it was when the burst began). Tuned to play (0.9 + range/12, widened from 0.6 + range/15 when
 * a gang pistol at eight units landed over half its rounds): a street cop (accuracy 60) lands roughly a fifth of his
 * rounds on a man standing ten units off and few from across a street, SWAT (68) and the FBI (76) more, the army (84)
 * most. */
export function npcInaccurateAim(aim:{x:number;y:number;z:number},accuracy=60,random:()=>number=Math.random,from?:{x:number;y:number;z:number},moving=false){
 const range=from?Math.hypot(aim.x-from.x,aim.y-from.y,aim.z-from.z):10;
 const k=Math.max(0,100-accuracy)*(.9+range/12)*(moving?1.5:1);
 return {x:aim.x+(random()*2-1)*.02*k,y:aim.y+(random()*2-1)*.01*k,z:aim.z+(random()*2-1)*.02*k};
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
