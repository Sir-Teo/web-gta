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
