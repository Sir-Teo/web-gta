import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
beforeAll(async()=>{await RAPIER.init();});

test.each([{down:0,radius:.3,centre:.9},{down:Infinity,radius:.3,centre:.3}])('arriving floor collision places a ped using its current body centre ($centre)',({down,radius,centre})=>{
 const world=new RAPIER.World({x:0,y:0,z:0});try{
  world.createCollider(RAPIER.ColliderDesc.cuboid(10,.5,10).setTranslation(0,-.5,0));
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,centre-.2,0)),collider=world.createCollider(RAPIER.ColliderDesc.ball(radius),body);world.step();
  const p={down,body,collider,actor:{player:{position:{x:0,y:-.2,z:0}}},collisionWait:{seconds:0,reground:false}} as any,host={sim:{world,collisionLoaded:()=>true}};
  expect((WorldPedestrians.prototype as any).collisionArrived.call(host,p,1/30)).toBe(true);expect(p.actor.player.position.y).toBeCloseTo(0,5);expect(body.translation().y).toBeCloseTo(centre,5);expect(collider.translation().y).toBeCloseTo(centre,5);
 }finally{world.free();}
});
