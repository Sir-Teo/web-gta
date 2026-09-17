import type {Vec3} from '../core/math';
/** CProjectileInfo physics (gta-reversed ProjectileInfo): per-kind gravity,
 * drag, bounce and fuse. Rockets fly flat with a short motor, thrown
 * grenades/molotovs arc under gravity with ground bounce, satchels stick. */
export type ProjectileKind='rocket'|'guided'|'grenade'|'molotov'|'satchel'|'tear'|'mine';
export interface ProjectileTuning {gravity:number;drag:number;bounce:number;fuse:number;speed:number;up:number}
export function projectileTuning(kind:string):ProjectileTuning{
 switch(kind){
  case 'rocket':return {gravity:0,drag:0.02,fuse:8,speed:38,bounce:0,up:0};
  case 'guided':return {gravity:0,drag:0.01,fuse:8,speed:38,bounce:0,up:0};
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
export function stepProjectile(p:{position:Vec3;velocity:Vec3;fuse:number},kind:string,dt:number,guidedTarget?:Vec3){
 const t=projectileTuning(kind);
 if(kind==='guided'&&guidedTarget){
  const dx=guidedTarget.x-p.position.x,dy=guidedTarget.y-p.position.y,dz=guidedTarget.z-p.position.z;
  const l=Math.hypot(dx,dy,dz)||1,steer=0.94;
  p.velocity={x:p.velocity.x*steer+dx/l*t.speed*(1-steer),y:p.velocity.y*steer+dy/l*t.speed*(1-steer),z:p.velocity.z*steer+dz/l*t.speed*(1-steer)};
 }
 p.velocity.y-=t.gravity*dt;
 const drag=1-Math.min(0.5,t.drag*dt*50);
 p.velocity={x:p.velocity.x*drag,y:p.velocity.y*drag,z:p.velocity.z*drag};
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
