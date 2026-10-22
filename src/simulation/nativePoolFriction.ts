import type {PoolPoint} from './nativePoolBall';
/** CPhysical's pool-ball contact/cloth friction, native axes and per-frame units.
 * Response 9, zero centre-of-mass offset, enabled collision/turn force. */
export interface PoolFrictionState {velocity:PoolPoint;turn:PoolPoint;frictionMove:PoolPoint;frictionTurn:PoolPoint}
const f=Math.fround;
const point=(p:PoolPoint):PoolPoint=>({x:f(p.x),y:f(p.y),z:f(p.z)});
const add=(a:PoolPoint,b:PoolPoint):PoolPoint=>({x:f(a.x+b.x),y:f(a.y+b.y),z:f(a.z+b.z)});
const sub=(a:PoolPoint,b:PoolPoint):PoolPoint=>({x:f(a.x-b.x),y:f(a.y-b.y),z:f(a.z-b.z)});
const mul=(a:PoolPoint,n:number):PoolPoint=>({x:f(a.x*n),y:f(a.y*n),z:f(a.z*n)});
const dot=(a:PoolPoint,b:PoolPoint)=>f(f(f(a.x*b.x)+f(a.y*b.y))+f(a.z*b.z));
const cross=(a:PoolPoint,b:PoolPoint):PoolPoint=>({x:f(f(a.y*b.z)-f(a.z*b.y)),y:f(f(a.z*b.x)-f(a.x*b.z)),z:f(f(a.x*b.y)-f(a.y*b.x))});
function copy(s:PoolFrictionState):PoolFrictionState{return{velocity:point(s.velocity),turn:point(s.turn),frictionMove:point(s.frictionMove),frictionTurn:point(s.frictionTurn)};}
/** ApplyFriction(float, CColPoint&) -> GetSpeed -> ApplyFrictionForce, without sparks.
 * The offset is contact point minus object position, each already rounded in world space. */
export function nativePoolContactFriction(state:PoolFrictionState,offset:PoolPoint,normal:PoolPoint,strength:number,mass:number,turnMass:number):PoolFrictionState{
 const s=copy(state),r=point(offset),n=point(normal),speed=add(add(s.velocity,cross(add(s.turn,s.frictionTurn),r)),s.frictionMove),tangent=sub(speed,mul(n,dot(speed,n))),magnitude=f(Math.sqrt(dot(tangent,tangent)));
 if(magnitude<=0)return s;
 const direction=mul(tangent,f(1/magnitude)),lever=cross(r,direction),invMass=f(1/f(mass)),invTurn=f(1/f(turnMass)),effectiveMass=f(1/f(f(dot(lever,lever)/f(turnMass))+invMass)),impulse=-Math.min(f(magnitude*effectiveMass),f(strength)),force=mul(direction,impulse);
 s.frictionMove=add(s.frictionMove,{x:f(force.x*invMass),y:f(force.y*invMass),z:0});
 s.frictionTurn=add(s.frictionTurn,mul(cross(r,force),invTurn));return s;
}
/** ApplyFriction() (PC 5483D0; inspected arm64 1002494a8). Pending cushion impulses are
 * included in the cloth contact's speed, then applied and cleared after spin-Z damping. */
export function nativePoolGroundFriction(state:PoolFrictionState,position:PoolPoint,radius:number,timeStep:number,mass:number,turnMass:number):PoolFrictionState{
 const dt=f(timeStep),p=point(position),offset={x:0,y:0,z:f(f(p.z-f(radius))-p.z)},s=nativePoolContactFriction(state,offset,{x:0,y:0,z:1},f(dt*f(.001)),mass,turnMass);
 s.turn.z=f(f(Math.pow(f(.98),dt))*s.turn.z);s.velocity=add(s.velocity,s.frictionMove);s.turn=add(s.turn,s.frictionTurn);s.frictionMove={x:0,y:0,z:0};s.frictionTurn={x:0,y:0,z:0};return s;
}
