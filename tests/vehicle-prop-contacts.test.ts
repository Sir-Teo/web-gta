import RAPIER from '@dimforge/rapier3d-compat';
import {beforeAll,expect,test} from 'vitest';
import {resolveVehicleProps} from '../src/simulation/vehiclePropContacts';
import {newObjectState} from '../src/simulation/nativeObjectDamage';
beforeAll(async()=>{await RAPIER.init();});

/** A car at `speed` m/s into a loose prop of `mass`; the ObjectDamage calls resolveVehicleProps makes. */
function ram(speed:number,mass:number){
 const world=new RAPIER.World({x:0,y:0,z:0});
 const car=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,0,0));world.createCollider(RAPIER.ColliderDesc.cuboid(1,.5,.5).setMass(1500),car);
 const box=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(1.45,0,0));const boxCollider=world.createCollider(RAPIER.ColliderDesc.cuboid(.5,.5,.5).setMass(mass),box);
 car.setLinvel({x:speed,y:0,z:0},true);world.step();
 const hits:number[]=[],prop={effect:20,colDamageMultiplier:1,uprootLimit:0,mass,turnMass:mass,elasticity:.1,state:newObjectState(),damaged:({damage}:{damage:number})=>{hits.push(damage);},uproot:()=>true};
 resolveVehicleProps({world,body:car,playerColliderHandle:-1,pre:{x:speed,y:0,z:0},preTurn:{x:0,y:0,z:0},mass:1500,turnMass:3000,occupied:false,wrecked:false,
  propFor:c=>c.handle===boxCollider.handle?prop as any:undefined});
 return hits;
}
test('a car running into a prop already knocked loose damages it past an intensity of 20 (ProcessCollisionSectorList)',()=>{
 // 100 mass at 30 m/s (0.6 units a frame): about 60 of impulse.
 const heavy=ram(30,100);expect(heavy).toHaveLength(1);expect(heavy[0]).toBeGreaterThan(20);
 // 10 mass at 20 m/s is about 4: below the gate, no damage.
 expect(ram(20,10)).toEqual([]);
});
import {carRollsOverProp,propSizePoint,vehicleOverPoint,resolveVehicleProps as resolve} from '../src/simulation/vehiclePropContacts';
// ProcessCollisionSectorList: a smashable prop the vehicle is over (its origin above the prop's size point, or the
// point under the vehicle's plane) takes a flat 50 when the contact itself did not pass the 20 gate.
test('a car resting on a smashable prop crushes it for a flat 50 a frame',()=>{
 const world=new RAPIER.World({x:0,y:0,z:0});
 const car=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,0,0));world.createCollider(RAPIER.ColliderDesc.cuboid(1,.5,.5).setMass(1500),car);
 const cone=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,-1,0));const coneCollider=world.createCollider(RAPIER.ColliderDesc.cuboid(.3,.5,.3).setMass(25),cone);
 world.step();
 const hits:number[]=[];
 const make=(boundsSize?:readonly [number,number,number])=>({effect:20,colDamageMultiplier:1,uprootLimit:0,mass:25,turnMass:50,elasticity:.1,state:newObjectState(),damaged:({damage}:{damage:number})=>{hits.push(damage);},uproot:()=>true,boundsSize});
 // The size taken as a point: 0.6 wide, 0.6 long and 0.5 tall from the cone's origin a unit under the car lands under the car's plane.
 const prop=make([.6,.6,.5]);
 resolve({world,body:car,playerColliderHandle:-1,pre:{x:0,y:0,z:0},preTurn:{x:0,y:0,z:0},mass:1500,turnMass:3000,occupied:false,wrecked:false,propFor:c=>c.handle===coneCollider.handle?prop as any:undefined});
 expect(hits).toEqual([50]);
 // A prop whose size point rises above the car (a tall one): no crush.
 hits.length=0;const tall=make([.6,.6,3]);
 resolve({world,body:car,playerColliderHandle:-1,pre:{x:0,y:0,z:0},preTurn:{x:0,y:0,z:0},mass:1500,turnMass:3000,occupied:false,wrecked:false,propFor:c=>c.handle===coneCollider.handle?tall as any:undefined});
 expect(hits).toEqual([]);
});
test('SpecialEntityPreCollisionStuff: a car over a small loose unsmashable prop ignores it; a bike or a smashable prop does not',()=>{
 const flat={x:0,y:0,z:0,w:1};
 // Native size (0.5, 0.5, 0.8) at a prop lying a unit under the car's origin: the size point is under the car.
 const point=propSizePoint({x:0,y:-1,z:0},flat,[.5,.5,.8]);expect(point.x).toBeCloseTo(.5,9);expect(point.y).toBeCloseTo(-.2,9);expect(point.z).toBeCloseTo(-.5,9);
 expect(vehicleOverPoint({x:0,y:0,z:0},flat,{x:.5,y:-.2,z:-.5})).toBe(true);
 expect(vehicleOverPoint({x:0,y:0,z:0},flat,{x:.5,y:.4,z:-.5})).toBe(false);
 const prop={position:{x:0,y:-1,z:0},rotation:flat,effect:1,boundsMax:[.25,.25,.8] as const,boundsSize:[.5,.5,.8] as const};
 expect(carRollsOverProp({position:{x:0,y:0,z:0},rotation:flat},prop)).toBe(true);
 expect(carRollsOverProp({position:{x:0,y:0,z:0},rotation:flat,bike:true},prop)).toBe(false);
 expect(carRollsOverProp({position:{x:0,y:0,z:0},rotation:flat},{...prop,effect:20})).toBe(false);
 expect(carRollsOverProp({position:{x:0,y:0,z:0},rotation:flat},{...prop,boundsMax:[.25,1.2,.8]})).toBe(false);
});
