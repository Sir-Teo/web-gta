import RAPIER from '@dimforge/rapier3d-compat';
/* CWorld::ProcessLineOfSight with doShootThroughCheck, as every bullet line test (the player's, a ped's, a car gun's)
 * passes it: a face whose surface is shoot-through (SURFINFO: chain-link fences, scaffold poles, see-through cloth) is
 * flown through. A shoot-through primitive (a fence's box: one surface for the whole shape) is left out of the rest of
 * the line; stepping a hundredth past it began the next test inside the box, which met it again at once, and the bullet
 * died in the fence. A mesh's shoot-through face is stepped past, and the line goes on to the next face. */
type V={x:number;y:number;z:number};
export interface BulletLineOptions {isShootThrough?:(hit:RAPIER.RayColliderIntersection)=>boolean;excludeCollider?:RAPIER.Collider;excludeBody?:RAPIER.RigidBody;filter?:(c:RAPIER.Collider)=>boolean}
export function bulletLine(world:RAPIER.World,from:V,direction:V,range:number,o:BulletLineOptions){
 let start=from,left=range,travelled=0;const passed=new Set<number>();
 const through=(c:RAPIER.Collider)=>!passed.has(c.handle)&&(!o.filter||o.filter(c));
 for(let i=0;i<32;i++){
  const hit=world.castRayAndGetNormal(new RAPIER.Ray(start,direction),left,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,o.excludeCollider,o.excludeBody,passed.size?through:o.filter);
  if(!hit||!o.isShootThrough?.(hit)){if(hit)hit.timeOfImpact+=travelled;return hit;}
  if(hit.collider.shapeType()!==RAPIER.ShapeType.TriMesh){passed.add(hit.collider.handle);continue;}
  const step=hit.timeOfImpact+.01;travelled+=step;left-=step;if(left<=0)return null;
  start={x:start.x+direction.x*step,y:start.y+direction.y*step,z:start.z+direction.z*step};
 }
 return null;
}
