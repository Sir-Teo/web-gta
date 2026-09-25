/* CExplosion::AddExplosion and CWorld::TriggerExplosionSectorList, pinned gta-reversed
 * 0076f9017b4aeef7433957ac2bd8b6988e9df166 (Explosion.cpp, World.cpp). An explosion
 * applies its damage and push once, when it is added, to every vehicle, ped and object
 * whose position lies inside its radius. There is no line-of-sight test. The field the
 * source calls m_fVisibleDistance is the blast force. Native units: mass, units per
 * 1/50 s frame, Z up. */

type V3={x:number;y:number;z:number};
const dot=(a:V3,b:V3)=>a.x*b.x+a.y*b.y+a.z*b.z;

/** eExplosionType. */
export const EXPLOSION={grenade:0,molotov:1,rocket:2,weakRocket:3,car:4,quickCar:5,boat:6,aircraft:7,mine:8,object:9,tankFire:10,small:11,rcVehicle:12} as const;
export interface ExplosionParams {
 /** Blast radius at creation. */
 radius:number;
 /** m_fVisibleDistance: the push strength; zero means no damage or push at all. */
 force:number;
 /** m_fDamagePercentage, applied to vehicle damage only. */
 damagePercentage:number;
 /** Milliseconds the explosion stays active after its particle delay. */
 durationMs:number;
 /** Radius growth per frame while active. */
 propagation:number;
}
/** AddExplosion's per-type setup. */
export function explosionParams(type:number):ExplosionParams{
 const p=(radius:number,force:number,durationMs:number,propagation=0,damagePercentage=1):ExplosionParams=>({radius,force,damagePercentage,durationMs,propagation});
 switch(type){
  case EXPLOSION.grenade:return p(9,300,750,.5);
  case EXPLOSION.molotov:return p(6,0,3000);
  case EXPLOSION.rocket:return p(10,300,750,.5);
  case EXPLOSION.weakRocket:return p(10,200,750,.5,.2);
  case EXPLOSION.car:case EXPLOSION.quickCar:return p(9,300,4250,.5);
  case EXPLOSION.boat:case EXPLOSION.aircraft:return p(25,600,3000);
  case EXPLOSION.mine:case EXPLOSION.object:case EXPLOSION.tankFire:return p(10,150,750,.5);
  case EXPLOSION.small:case EXPLOSION.rcVehicle:return p(3,90,750,.5);
  default:return p(1,0,0);
 }
}

/** eExplosionType's EXPLOSION_UNDEFINED, which TestForExplosionInArea takes for any type. */
export const EXPLOSION_UNDEFINED=-1;
/** CExplosion::aExplosions: sixteen slots. AddExplosion takes the first inactive one (GetFree) and makes nothing when
 * all are active; a slot stays active until its expiry time (lifetime plus the type's own time) is reached in
 * CExplosion::Update. Positions are native. */
export class NativeExplosionSlots {
 static readonly SIZE=16;
 private readonly active:{type:number;position:{x:number;y:number;z:number};expireMs:number}[]=[];
 get count(){return this.active.length;}
 /** Update's expiry, for a time `nowMs`. */
 expire(nowMs:number){for(let i=this.active.length-1;i>=0;i--)if(nowMs>=this.active[i].expireMs)this.active.splice(i,1);}
 /** AddExplosion's slot: false when none is free, and the explosion is not made. */
 add(type:number,position:{x:number;y:number;z:number},nowMs:number,lifetimeMs=0){
  this.expire(nowMs);
  if(this.active.length>=NativeExplosionSlots.SIZE)return false;
  this.active.push({type,position:{...position},expireMs:nowMs+lifetimeMs+explosionParams(type).durationMs});
  return true;
 }
 /** TestForExplosionInArea: an active explosion of the type (or of any, for EXPLOSION_UNDEFINED) at a point within the
  * box, faces included. */
 inArea(type:number,min:{x:number;y:number;z:number},max:{x:number;y:number;z:number}){
  return this.active.some(e=>(type===EXPLOSION_UNDEFINED||e.type===type)&&e.position.x>=min.x&&e.position.x<=max.x
   &&e.position.y>=min.y&&e.position.y<=max.y&&e.position.z>=min.z&&e.position.z<=max.z);
 }
}

/** min(1, 2 (radius - distance) / radius): full strength inside half the radius. Zero outside. */
export function explosionFalloff(radius:number,distance:number){return distance>=radius?0:Math.min(1,2*(radius-distance)/radius);}
/** Direction from the blast to the entity, never pointing down. */
export function explosionDirection(point:V3,entity:V3):V3{
 const d={x:entity.x-point.x,y:entity.y-point.y,z:entity.z-point.z},l=Math.max(.01,Math.hypot(d.x,d.y,d.z));
 return {x:d.x/l,y:d.y/l,z:Math.max(0,d.z/l)};
}

/** The ped branch: ApplyMoveForce and CPedDamageResponseCalculator's damage (250 x falloff). */
export function explosionOnPed(o:{falloff:number;force:number;direction:V3;mass?:number;moveSpeed:V3;standing:boolean;timeStepMs?:number}){
 const mass=o.mass??70;
 let factor=Math.min(mass/1400*o.falloff*o.force,mass/4);
 const along=dot(o.moveSpeed,o.direction)*mass;
 if(along>2*factor)factor=Math.max(0,factor-along);
 const impulse={x:o.direction.x*factor,y:o.direction.y*factor,z:o.direction.z*factor};
 // A standing ped is lifted off its feet; an airborne one gets a frame of anti-gravity.
 impulse.z+=o.standing?4:(o.timeStepMs??20)*mass/125;
 return {impulse,damage:250*o.falloff};
}

/** The object branch for an unfrozen object: ApplyMoveForce, ApplyTurnForce about half its
 * bounding radius above its centre of mass, and ObjectDamage(300 x falloff). */
export function explosionOnObject(o:{falloff:number;force:number;direction:V3;mass:number;turnMass:number;moveSpeed:V3;boundRadius:number;disableCollisionForce?:boolean}){
 let move:V3|undefined,turn:{impulse:V3;arm:V3}|undefined;
 if(!o.disableCollisionForce){
  const dir={...o.direction};if(dir.z<.1)dir.z=.2;
  let factor=o.mass/1400*o.falloff*o.force;
  const along=dot(o.moveSpeed,dir)*o.mass;
  if(along>4*factor)factor=Math.max(0,factor-along);
  move={x:dir.x*factor,y:dir.y*factor,z:dir.z*factor};
  const share=Math.min(1,o.turnMass/o.mass);
  turn={impulse:{x:move.x*share,y:move.y*share,z:move.z*share},arm:{x:0,y:0,z:o.boundRadius/2}};
 }
 return {move,turn,damage:300*o.falloff};
}

/** A static object inside the blast: TriggerExplosionSectorList unfreezes it when the force
 * exceeds its uproot limit; one left static only takes ObjectDamage(falloff). */
export function explosionUnfreezes(force:number,uprootLimit:number){return force>uprootLimit;}

/** The vehicle branch: InflictDamage(1100 x falloff x damage percentage), and ApplyTurnForce
 * along the blast normal at the nearest point of the vehicle's bounding box. The exploding
 * vehicle itself takes a fifth of the push. Vehicles get no move force here. `local` is the
 * blast position in the vehicle's frame; axes turn local vectors into world ones. */
export function explosionOnVehicle(o:{falloff:number;force:number;damagePercentage:number;radius:number;mass:number;local:V3;boundsMin:V3;boundsMax:V3;isVictim:boolean;
 toWorld:(v:V3)=>V3;speedAt:(worldOffset:V3)=>V3}){
 const damage=1100*o.falloff*o.damagePercentage;
 const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
 const closest={x:clamp(o.local.x,o.boundsMin.x,o.boundsMax.x),y:clamp(o.local.y,o.boundsMin.y,o.boundsMax.y),z:clamp(o.local.z,o.boundsMin.z,o.boundsMax.z)};
 const out={x:closest.x-o.local.x,y:closest.y-o.local.y,z:closest.z-o.local.z},len=Math.hypot(out.x,out.y,out.z);
 // Blast centre inside the box: push out from the box centre.
 const centre={x:(o.boundsMin.x+o.boundsMax.x)/2,y:(o.boundsMin.y+o.boundsMax.y)/2,z:(o.boundsMin.z+o.boundsMax.z)/2};
 const n=len>1e-4?{x:out.x/len,y:out.y/len,z:out.z/len}:(()=>{const c={x:centre.x-o.local.x,y:centre.y-o.local.y,z:centre.z-o.local.z},l=Math.hypot(c.x,c.y,c.z)||1;return {x:c.x/l,y:c.y/l,z:c.z/l};})();
 const normal=o.toWorld(n);
 if(normal.z>=0){if(normal.z<.2&&normal.z>0)normal.z+=.2;}else normal.z=-.2;
 const point=o.toWorld(closest);
 const reach=Math.hypot(closest.x-o.local.x,closest.y-o.local.y,closest.z-o.local.z);
 let forceFactor=Math.min(1,(o.radius-reach)/o.radius*2);
 if(o.isVictim)forceFactor*=.2;
 forceFactor*=Math.min(1,o.mass/3000)*o.force;
 const closing=dot(o.speedAt(point),normal);
 if(closing>forceFactor*3)forceFactor=Math.max(0,forceFactor-closing);
 return {damage,turnForce:{x:normal.x*forceFactor,y:normal.y*forceFactor,z:normal.z*forceFactor},point};
}
