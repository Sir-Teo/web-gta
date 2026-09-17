import RAPIER from '@dimforge/rapier3d-compat';

/** Query installed terrain before Rapier's next broad-phase update. Scene
 * transfers happen while paused; stepping physics just to refresh a spawn
 * query would also advance every existing vehicle. */
export function fixedGroundDistance(world:RAPIER.World,x:number,z:number,top=1000,maxDistance=2000){
 const ray=new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0});
 let nearest=Infinity;
 world.forEachCollider(collider=>{
  const body=collider.parent();
  if(!collider.isEnabled()||collider.isSensor()||body&&(!body.isFixed()||!body.isEnabled()))return;
  const hit=collider.castRayAndGetNormal(ray,Math.min(maxDistance,nearest),true);
  if(hit)nearest=Math.min(nearest,hit.timeOfImpact);
 });
 return Number.isFinite(nearest)?nearest:undefined;
}
