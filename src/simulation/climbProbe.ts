import RAPIER from '@dimforge/rapier3d-compat';
import type {ClimbContact,ClimbEntity,ClimbSphere,ClimbWorld,V3} from '../ped/nativeClimb';
import type {NativeCollisionSource} from './nativeCollision';
import {nativeCollisionSurface} from './nativeWheelSurface';

/** A physics body standing in for one CEntity of ScanToGrab's sector lists. */
export interface ClimbBody extends ClimbEntity{body:RAPIER.RigidBody}
export interface ClimbProbeOptions{
 /** The entity list a collider's body belongs to, or undefined for bodies ScanToGrab never sees (peds, loose objects,
  * objects with infinite mass). */
 kind(collider:RAPIER.Collider):ClimbEntity['kind']|undefined;
 source(collider:RAPIER.Collider):NativeCollisionSource|undefined;
 /** SurfaceInfos_c::CanClimb by surface ID, from SURFINFO.DAT. */
 climbable():ReadonlyMap<number,boolean>|undefined;
}
const IDENTITY={x:0,y:0,z:0,w:1};
const toBrowser=(v:V3)=>({x:v.x,y:v.z,z:-v.y});
const toNative=(v:{x:number;y:number;z:number}):V3=>({x:v.x,y:-v.z,z:v.y});

/** ClimbWorld over Rapier. A contact is the deepest penetration of a model sphere into any of the body's colliders,
 * which is CCollision::ProcessSphereTriangle's closest point; the triangle's surface comes from a ray toward that point. */
export function rapierClimbWorld(world:RAPIER.World,options:ClimbProbeOptions):ClimbWorld<ClimbBody>{
 const balls=new Map<number,RAPIER.Ball>(),ball=(radius:number)=>{let b=balls.get(radius);if(!b)balls.set(radius,b=new RAPIER.Ball(radius));return b;};
 const surface=(collider:RAPIER.Collider,center:{x:number;y:number;z:number},point:{x:number;y:number;z:number})=>{
  const source=options.source(collider);if(!source)return undefined;
  if(source.kind!=='mesh')return nativeCollisionSurface(source)?.material;
  const d={x:point.x-center.x,y:point.y-center.y,z:point.z-center.z},length=Math.hypot(d.x,d.y,d.z);
  if(!(length>1e-6))return undefined;
  const hit=collider.castRayAndGetNormal(new RAPIER.Ray(center,{x:d.x/length,y:d.y/length,z:d.z/length}),length+.02,true);
  return hit?nativeCollisionSurface(source,hit)?.material:undefined;
 };
 return {
  entities(center,radius){
   // Collect first: calling back into Rapier from inside a query callback can alias its borrowed sets.
   const hits:RAPIER.Collider[]=[],bodies=new Map<number,ClimbBody>();
   world.intersectionsWithShape(toBrowser(center),IDENTITY,ball(radius),collider=>{hits.push(collider);return true;});
   for(const collider of hits){
    const body=collider.parent();if(!body||bodies.has(body.handle)||collider.isSensor())continue;
    const kind=options.kind(collider);if(kind)bodies.set(body.handle,{kind,body});
   }
   return bodies.values();
  },
  contact(entity,spheres:readonly ClimbSphere[]):ClimbContact|undefined{
   const colliders:RAPIER.Collider[]=[];
   for(let i=0;i<entity.body.numColliders();i++){const c=entity.body.collider(i);if(c.isEnabled()&&!c.isSensor())colliders.push(c);}
   for(let piece=0;piece<spheres.length;piece++){
    const sphere=spheres[piece],center=toBrowser(sphere.center),shape=ball(sphere.radius);
    let best:{collider:RAPIER.Collider;contact:RAPIER.ShapeContact}|undefined;
    for(const collider of colliders){
     const contact=collider.contactShape(shape,center,IDENTITY,0);
     if(contact&&contact.distance<0&&(!best||contact.distance<best.contact.distance))best={collider,contact};
    }
    if(best)return {piece,point:toNative(best.contact.point1),normal:toNative(best.contact.normal1),surface:surface(best.collider,center,best.contact.point1)};
   }
   return undefined;
  },
  // Without SURFINFO.DAT every surface is treated as climbable.
  canClimb(id){const table=options.climbable();return !table||id===undefined||table.get(id)===true;},
 };
}
