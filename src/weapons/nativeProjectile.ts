import type {Vec3} from '../core/math';
/** CProjectileInfo's projectiles. gta-reversed leaves AddProjectile and Update unreversed; the rockets and the
 * heat-seekers follow the iOS executable's (AddProjectile 0x100491668, Update 0x1004925bc): see stepRocketVelocity.
 * AUTHORED: the thrown weapons' gravity, drag, bounce, speed and fuse (grenades and molotovs arc and bounce, satchels
 * stick), not yet read from it. */
export type ProjectileKind='rocket'|'guided'|'grenade'|'molotov'|'satchel'|'tear'|'mine';
export interface ProjectileTuning {gravity:number;drag:number;bounce:number;fuse:number;speed:number;up:number}
/** The game's frames a second: CTimer's timestep is 1 at 50. */
const FPS=50;
export function projectileTuning(kind:string):ProjectileTuning{
 switch(kind){
  // AddProjectile: a rocket leaves at 0.4 units a frame and lives 3 s; a heat-seeker at 0.2 and lives 10 s. Neither
  // falls (it clears the projectile's bApplyGravity) and CProjectile's air resistance is 0.99999.
  case 'rocket':return {gravity:0,drag:0,fuse:3,speed:.4*FPS,bounce:0,up:0};
  case 'guided':return {gravity:0,drag:0,fuse:10,speed:.2*FPS,bounce:0,up:0};
  case 'satchel':return {gravity:9.81,drag:0.05,fuse:Infinity,speed:15,bounce:0.2,up:5};
  case 'molotov':return {gravity:9.81,drag:0.03,fuse:3,speed:15,bounce:0.3,up:5};
  case 'grenade':return {gravity:9.81,drag:0.03,fuse:3,speed:15,bounce:0.4,up:5};
  default:return {gravity:9.81,drag:0.03,fuse:3,speed:15,bounce:0.3,up:5};
 }
}
export function launchVelocity(kind:string,direction:Vec3):Vec3{
 const t=projectileTuning(kind);
 return {x:direction.x*t.speed,y:direction.y*t.speed+t.up,z:direction.z*t.speed};
}
/** A heat-seeker's target: where it is, its velocity (units a second) and whether it is a plane. */
export interface SeekTarget {position:Vec3;velocity:Vec3;plane:boolean}
const ROCKET_THRUST=.008,SPEED_CAP=9.9,AIR_RESISTANCE=.99999,PLAYER_TURN=.0117,OTHER_TURN=.009;
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
  const drag=1-Math.min(0.5,t.drag*dt*50);
  p.velocity={x:p.velocity.x*drag,y:p.velocity.y*drag,z:p.velocity.z*drag};
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
