import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {installRapierUnfilteredQueries} from '../src/simulation/rapierUnfilteredQueries';

beforeAll(async()=>{await RAPIER.init();});

/** Calls the WASM makes back into JS while `work` runs (each goes through Function.prototype.call). */
function callbacks(work:()=>void){
 const call=Function.prototype.call;let n=0;
 Function.prototype.call=function(this:(...args:unknown[])=>unknown,...args:unknown[]){n++;return call.apply(this,args as [unknown,...unknown[]]);} as typeof call;
 try{work();}finally{Function.prototype.call=call;}
 return n;
}

test('queries without a filter answer the same with no calls back into JS; a filter or callback still runs',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0});
 world.createCollider(RAPIER.ColliderDesc.cuboid(60,.5,60).setTranslation(0,-.5,0));
 for(let i=0;i<120;i++){const a=i*2.399,r=1.2+(i%7)*.15;world.createCollider(RAPIER.ColliderDesc.ball(.05).setTranslation(Math.cos(a)*r,.3+(i%5)*.3,Math.sin(a)*r));}
 const box=world.createCollider(RAPIER.ColliderDesc.cuboid(.5,.5,.5).setTranslation(1.3,.5,0));
 const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,.85,0));
 const capsule=world.createCollider(RAPIER.ColliderDesc.capsule(.5,.3),body);
 const controller=world.createCharacterController(.01);controller.enableSnapToGround(.3);
 // Two identical cars on the flat, one for each run.
 const vehicles=[[20,20],[-20,-20]].map(([x,z])=>{
  const chassis=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,.6,z));world.createCollider(RAPIER.ColliderDesc.cuboid(.9,.3,2),chassis);
  const vehicle=world.createVehicleController(chassis);
  for(const [wx,wz] of [[-.8,1.3],[.8,1.3],[-.8,-1.3],[.8,-1.3]])vehicle.addWheel({x:wx,y:0,z:wz},{x:0,y:-1,z:0},{x:-1,y:0,z:0},.4,.35);
  return vehicle;
 });
 world.step();
 const ray=new RAPIER.Ray({x:1.3,y:3,z:0},{x:0,y:-1,z:0}),ball=new RAPIER.Ball(.2);
 const answers=(vehicle:RAPIER.DynamicRayCastVehicleController)=>{
  const hit=world.castRay(ray,10,true),normal=world.castRayAndGetNormal(ray,10,true);
  const shape=world.castShape({x:1.3,y:3,z:0},{x:0,y:0,z:0,w:1},{x:0,y:-1,z:0},ball,0,10,true);
  const point=world.projectPoint({x:1.3,y:2,z:0},true),inside=world.intersectionWithShape({x:1.3,y:.5,z:0},{x:0,y:0,z:0,w:1},ball);
  let along=0;world.intersectionsWithRay(new RAPIER.Ray({x:-5,y:.5,z:0},{x:1,y:0,z:0}),20,true,()=>{along++;return true;});
  controller.computeColliderMovement(capsule,{x:.3,y:-.05,z:.2});const moved=controller.computedMovement();
  vehicle.updateVehicle(1/60);
  return {hit:[hit?.collider.handle,hit?.timeOfImpact],normal:[normal?.collider.handle,normal?.normal],shape:[shape?.collider.handle,shape?.time_of_impact],
   point:[point?.collider.handle,point?.point],inside:inside?.handle,along,moved:{...moved},grounded:controller.computedGrounded(),
   wheels:[0,1,2,3].map(i=>[vehicle.wheelIsInContact(i),vehicle.wheelSuspensionLength(i)])};
 };
 const before=answers(vehicles[0]);
 const unfiltered=()=>{world.castRay(ray,10,true);world.castShape({x:1.3,y:3,z:0},{x:0,y:0,z:0,w:1},{x:0,y:-1,z:0},ball,0,10,true);controller.computeColliderMovement(capsule,{x:.3,y:-.05,z:.2});};
 expect(callbacks(unfiltered)).toBeGreaterThan(0);
 installRapierUnfilteredQueries(RAPIER);
 expect(answers(vehicles[1])).toEqual(before);
 expect(before.hit[0]).toBe(box.handle);expect(before.along).toBeGreaterThan(1);expect(before.wheels.every(([contact])=>contact)).toBe(true);
 expect(callbacks(unfiltered)).toBe(0);
 // A filter is still asked, and still decides.
 let asked=0;const past=world.castRay(ray,10,true,undefined,undefined,undefined,undefined,collider=>{asked++;return collider.handle!==box.handle;});
 expect(asked).toBeGreaterThan(0);expect(past?.collider.handle).not.toBe(box.handle);expect(past?.timeOfImpact).toBeCloseTo(3);
});
