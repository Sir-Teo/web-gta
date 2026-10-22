import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Group} from 'three';
import {WorldBike} from '../src/simulation/WorldBike';
import {WorldBoat} from '../src/simulation/WorldBoat';
import {NativeClumpAlpha} from '../src/simulation/nativeClumpAlpha';
let world:RAPIER.World|undefined;beforeAll(async()=>{await RAPIER.init();});afterEach(()=>{world?.free();world=undefined;});
function setup(Vehicle:typeof WorldBike|typeof WorldBoat){
 world=new RAPIER.World({x:0,y:0,z:0});const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(1000,35,1000));world.createCollider(RAPIER.ColliderDesc.cuboid(1,1,1),body);
 const sim={player:{position:{x:0,y:700,z:0}},worldFocus:{x:1000,y:35,z:1000}},v=Object.assign(Object.create(Vehicle.prototype),{body,sim,root:new Group(),clumpAlpha:new NativeClumpAlpha(()=>{}),frozen:true,bombTimerMs:0,health:1000,wrecked:false,burnTimer:0,collisionLoaded:()=>true})as WorldBike|WorldBoat;
 return{body,sim,v};
}
for(const Vehicle of[WorldBike,WorldBoat]){
 test(`${Vehicle.name}: collision and rendering follow the remote focus while boarding distance remains relative to CJ`,()=>{
  const {body,v}=setup(Vehicle);v.beforeStep(.02);expect(body.isEnabled()).toBe(true);expect(v.root.visible).toBe(true);expect(v.distance()).toBeGreaterThan(1000);
  world!.step();expect(world!.castRay(new RAPIER.Ray({x:1000,y:40,z:1000},{x:0,y:-1,z:0}),10,true)?.collider.parent()?.handle).toBe(body.handle);
 });
 test(`${Vehicle.name}: a vehicle beside CJ sleeps when the remote focus is elsewhere, then resumes on return`,()=>{
  const {body,sim,v}=setup(Vehicle);body.setTranslation(sim.player.position,true);v.beforeStep(.02);expect(body.isEnabled()).toBe(false);expect(v.root.visible).toBe(false);expect(v.distance()).toBe(0);
  sim.worldFocus={...sim.player.position};v.beforeStep(.02);expect(body.isEnabled()).toBe(true);expect(v.root.visible).toBe(true);
 });
 test(`${Vehicle.name}: ordinary focus retains the strict 250-unit activation boundary`,()=>{
  const {body,sim,v}=setup(Vehicle);sim.worldFocus={...sim.player.position};body.setTranslation({...sim.worldFocus,x:sim.worldFocus.x+250},true);v.beforeStep(.02);expect(body.isEnabled()).toBe(false);
  body.setTranslation({...sim.worldFocus,x:sim.worldFocus.x+249},true);v.beforeStep(.02);expect(body.isEnabled()).toBe(true);
 });
}
test('remote focus does not bypass a bike waiting for streamed ground collision',()=>{
 const{body,v}=setup(WorldBike);(v as any).collisionLoaded=()=>false;v.beforeStep(.02);expect(v.root.visible).toBe(true);expect(body.isEnabled()).toBe(false);
});
