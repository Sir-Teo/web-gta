import type {Vec3} from '../core/math';
import {NATIVE_GRAVITY_MS2} from '../simulation/nativeGravity';
/** CProjectileInfo's projectiles. gta-reversed leaves AddProjectile and Update unreversed; they follow the iOS
 * executable's (AddProjectile 0x100491668, Update 0x1004925bc): the launches (launchVelocity), the rockets' and
 * heat-seekers' flight (stepRocketVelocity), the thrown weapons' fuses, gravity and elasticity. `bounce` is the
 * projectile's elasticity (CPhysical::m_fElasticity). */
export type ProjectileKind='rocket'|'guided'|'grenade'|'molotov'|'satchel'|'tear'|'mine';
export interface ProjectileTuning {gravity:number;drag:number;bounce:number;fuse:number;speed:number;up:number}
/** The game's frames a second: CTimer's timestep is 1 at 50. */
const FPS=50;
/** CProjectile's air resistance a frame. */
const AIR_RESISTANCE=.99999;
export function projectileTuning(kind:string):ProjectileTuning{
 switch(kind){
  // AddProjectile: a rocket leaves at 0.4 units a frame and lives 3 s; a heat-seeker at 0.2 and lives 10 s. Neither
  // falls (it clears the projectile's bApplyGravity) and CProjectile's air resistance is 0.99999.
  case 'rocket':return {gravity:0,drag:0,fuse:3,speed:.4*FPS,bounce:.75,up:0};
  case 'guided':return {gravity:0,drag:0,fuse:10,speed:.2*FPS,bounce:.75,up:0};
  // The thrown ones fall (the tail sets bApplyGravity: CPhysical's 0.008 a frame squared). A grenade's destroy time is
  // 2 s on and its elasticity 0.5; a satchel's 2 s too, but Update clears it while the player holds the detonator, so
  // it waits; its elasticity is 0.03. Tear gas lives 20 s at 0.5; a molotov 2 s at CProjectile's 0.75.
  case 'satchel':return {gravity:NATIVE_GRAVITY_MS2,drag:0,fuse:Infinity,speed:.075*FPS,bounce:.03,up:.03*FPS};
  case 'molotov':return {gravity:NATIVE_GRAVITY_MS2,drag:0,fuse:2,speed:.2*FPS,bounce:.75,up:.08*FPS};
  case 'gas':return {gravity:NATIVE_GRAVITY_MS2,drag:0,fuse:20,speed:.15*FPS,bounce:.5,up:.06*FPS};
  case 'grenade':return {gravity:NATIVE_GRAVITY_MS2,drag:0,fuse:2,speed:.15*FPS,bounce:.5,up:.06*FPS};
  default:return {gravity:NATIVE_GRAVITY_MS2,drag:0,fuse:2,speed:.15*FPS,bounce:.5,up:.06*FPS};
 }
}
/** AddProjectile's velocity. A rocket or heat-seeker goes along `direction` at its speed (`creatorSpeed`, units a
 * second, added for one a vehicle fires). A thrown weapon ignores the aim: it goes along the thrower's heading (the
 * level part of `direction`) at 0.15 + 0.22 x the throw's force units a frame (half that for a satchel, at least 0.2
 * for a molotov), rising at 0.4 + 0.4 x the force (a molotov's 0.4 + 0.2 x) times that. (`speed` and `up` in the
 * tuning are a throw of no force.) */
export function launchVelocity(kind:string,direction:Vec3,force=0,creatorSpeed=0):Vec3{
 const t=projectileTuning(kind);
 if(kind==='rocket'||kind==='guided'){const s=t.speed+creatorSpeed;return {x:direction.x*s,y:direction.y*s,z:direction.z*s};}
 let speed=.15+.22*force,rise=.4+.4*force;
 if(kind==='satchel')speed*=.5;else if(kind==='molotov'){speed=Math.max(speed,.2);rise=.4+.2*force;}
 const level=Math.hypot(direction.x,direction.z),hx=level>0?direction.x/level:0,hz=level>0?direction.z/level:0;
 return {x:hx*speed*FPS,y:rise*speed*FPS,z:hz*speed*FPS};
}
/** CProjectileInfo::Update's rest for grenades, tear gas and satchels: once each part of the velocity is under 0.05
 * units a frame, the elasticity drops to 0.03, so it stops bouncing. */
export function settledElasticity(kind:string,velocity:Vec3,elasticity:number){
 const slow=Math.max(Math.abs(velocity.x),Math.abs(velocity.y),Math.abs(velocity.z))<.05*FPS;
 return (kind==='grenade'||kind==='gas'||kind==='satchel')&&elasticity>.1&&slow?.03:elasticity;
}
/** CPhysical's bounce off a surface of normal `n` (unit): the part of the velocity into it comes back at the
 * elasticity; the rest goes on. */
export function bounceVelocity(velocity:Vec3,n:Vec3,elasticity:number):Vec3{
 const into=velocity.x*n.x+velocity.y*n.y+velocity.z*n.z;if(into>=0)return {...velocity};
 const k=(1+elasticity)*into;return {x:velocity.x-k*n.x,y:velocity.y-k*n.y,z:velocity.z-k*n.z};
}
/** CPhysical::ApplyAirResistance for a projectile (0.99999 a frame). */
export const projectileAirResistance=(dt:number)=>Math.pow(AIR_RESISTANCE,dt*FPS);
/** A heat-seeker's target: where it is, its velocity (units a second) and whether it is a plane. */
export interface SeekTarget {position:Vec3;velocity:Vec3;plane:boolean}
const ROCKET_THRUST=.008,SPEED_CAP=9.9,PLAYER_TURN=.0117,OTHER_TURN=.009;
const scale=(v:Vec3,k:number):Vec3=>({x:v.x*k,y:v.y*k,z:v.z*k}),plus=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const length=(v:Vec3)=>Math.hypot(v.x,v.y,v.z),unit=(v:Vec3)=>{const l=length(v);return l>0?scale(v,1/l):{x:0,y:0,z:0};};
/** CProjectileInfo::Update's flight of a rocket or a heat-seeker, in the game's units a frame (velocities here are
 * units a second): a rocket gains 0.008 a frame along the way it was launched (its matrix does not turn); a
 * heat-seeker with a target steers for where the target will be, its velocity times the distance (at most 50) frames
 * on, from where it will be itself 100 frames on, the backward part of that taken away, turning by 0.0117 a frame (0.009
 * when not the player's) and a fifth more after a target faster than 0.8; one the player fired at a plane leads it by
 * at most 1.5 frames from where it is, keeps 0.95 of its speed a frame and turns by 0.15, and it faces its course.
 * Either is held to 9.9 a frame, and CPhysical's air resistance (0.99999) takes its share. */
export function stepRocketVelocity(p:{position:Vec3;velocity:Vec3;forward?:Vec3},kind:string,dt:number,seek?:SeekTarget,playerFired=true){
 const ts=dt*FPS;let v=scale(p.velocity,1/FPS);
 if(kind==='rocket'){p.forward??=unit(v);v=plus(v,scale(p.forward,ROCKET_THRUST*ts));}
 else if(kind==='guided'&&seek){
  const atPlane=playerFired&&seek.plane,heading=unit(v);
  const from=atPlane?p.position:plus(p.position,scale(v,100));
  const lead=Math.min(length(plus(seek.position,scale(p.position,-1))),atPlane?1.5:50);
  let want=plus(plus(seek.position,scale(seek.velocity,lead/FPS)),scale(from,-1));
  const back=heading.x*want.x+heading.y*want.y+heading.z*want.z;if(back<0)want=plus(want,scale(heading,-back));
  want=unit(want);
  let turn=playerFired?PLAYER_TURN:OTHER_TURN,keep=1;
  if(atPlane){keep=Math.pow(.95,ts);turn=.15;}else if(length(seek.velocity)/FPS>.8)turn*=1.2;
  v=plus(scale(v,keep),scale(want,turn*ts));p.forward=heading;
 }
 const speed=length(v);if(speed>SPEED_CAP)v=scale(v,SPEED_CAP/speed);
 p.velocity=scale(v,FPS*Math.pow(AIR_RESISTANCE,ts));
}
export function stepProjectile(p:{position:Vec3;velocity:Vec3;fuse:number;forward?:Vec3},kind:string,dt:number,seek?:SeekTarget){
 const t=projectileTuning(kind);
 if(kind==='rocket'||kind==='guided')stepRocketVelocity(p,kind,dt,seek);
 else{
  p.velocity.y-=t.gravity*dt;
  p.velocity=scale(p.velocity,projectileAirResistance(dt));
 }
 p.position={x:p.position.x+p.velocity.x*dt,y:p.position.y+p.velocity.y*dt,z:p.position.z+p.velocity.z*dt};
 p.fuse-=dt;
}
/** CWeapon::FireInstantHit spread: weapon.dat accuracy + skill/proficiency,
 * crouch bonus, move penalty and per-pellet golden-angle fan. */
export function instantHitSpread(baseSpread:number,o:{proficiency:number;crouched:boolean;moving:boolean;aiming:boolean}){
 let s=baseSpread*(1-o.proficiency*0.25);
 if(o.crouched)s*=0.7;
 if(o.moving)s*=1.6;
 if(o.aiming)s*=0.8;
 return Math.max(0.001,s);
}
export function pelletOffset(index:number,count:number,spread:number,distance:number){
 if(index===0)return {x:0,y:0};
 const angle=index*2.399963, r=spread*distance*Math.sqrt((index+0.5)/count);
 return {x:Math.cos(angle)*r,y:Math.sin(angle)*r};
}
