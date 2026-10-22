import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import fixture from './fixtures/native-destroy-car-target.json';
import {destroyCarTargetActive,scriptVehicleAttackTarget} from '../src/simulation/scriptVehicleAttackTarget';
import {WorldBike} from '../src/simulation/WorldBike';
import {WorldBoat} from '../src/simulation/WorldBoat';
import {WorldPlane} from '../src/simulation/WorldPlane';
import {WorldCar} from '../src/simulation/WorldCar';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
for(const[index,row]of fixture.cases.entries())test(`captured DestroyCar target ${index}: ${JSON.stringify(row.input)}`,()=>{
 const bytes=new DataView(new ArrayBuffer(4));bytes.setUint32(0,row.input.healthBits,true);const target=row.input.exists?{health:bytes.getFloat32(0,true),wrecked:row.input.status===42,disposed:false}:undefined;expect(destroyCarTargetActive(target)).toBe(row.active);
});
test('the host compares float32 health and drops a disposed target',()=>{expect(destroyCarTargetActive({health:1e-50})).toBe(false);expect(destroyCarTargetActive({health:1e-45})).toBe(true);expect(destroyCarTargetActive({health:1000,disposed:true})).toBe(false);});
for(const Vehicle of[WorldBike,WorldBoat,WorldPlane])for(const gate of['open','protected','playerOnly','meleeProof'])test(`${Vehicle.name}: attack target translates NPC melee and honors ${gate}`,()=>{
 const body={handle:123},v=Object.assign(Object.create(Vehicle.prototype),{assets:{collision:{bounds:{radius:3}}},body,health:1000,wreckedStatus:false,disposed:false,occupied:false,modelId:487,canBeDamaged:gate!=='protected',onlyDamagedByPlayer:gate==='playerOnly',proofs:gate==='meleeProof'?{melee:true}:undefined})as any;
 const target=scriptVehicleAttackTarget(v),attacker={id:5};expect(scriptVehicleAttackTarget(v)).toBe(target);expect(target.car.body).toBe(body);expect(target.boundRadius).toBe(3);target.damage(20,undefined,false,undefined,{kind:'melee',weapon:0,byPlayer:false,by:{ped:attacker}});
 expect(target.health).toBe(gate==='open'?Vehicle===WorldPlane?1000-20*Math.fround(.4):980:1000);if(gate==='open'){expect(v.lastWeaponDamage).toBe(0);expect(v.lastDamagedBy).toEqual({ped:attacker});}v.disposed=true;expect(target.disposed).toBe(true);v.health=0;expect(destroyCarTargetActive(target)).toBe(false);
});
test('automobile combat keeps the actual object rather than wrapping its damage and body',()=>{const car=Object.create(WorldCar.prototype);expect(scriptVehicleAttackTarget(car)).toBe(car);});
let world:RAPIER.World|undefined;beforeAll(async()=>{await RAPIER.init();});afterEach(()=>{world?.free();world=undefined;});
for(const obstruction of[false,true])test(`script vehicle sight follows its body with CJ elsewhere, obstruction ${obstruction}`,()=>{
 world=new RAPIER.World({x:0,y:0,z:0});const playerBody=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(-100,1,0)),playerCollider=world.createCollider(RAPIER.ColliderDesc.ball(.4),playerBody),body=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,0)),collider=world.createCollider(RAPIER.ColliderDesc.ball(.4),body),target=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(20,1,0));world.createCollider(RAPIER.ColliderDesc.cuboid(1,1,1),target);
 if(obstruction)world.createCollider(RAPIER.ColliderDesc.cuboid(1,3,3).setTranslation(10,1,0));world.step();const owner={sim:{world,playerBody,playerCollider},people:[],playerRide:()=>({body:playerBody})},ped={actor:{player:{position:{x:0,y:0,z:0}}},body,collider},spot=(WorldPedestrians.prototype as any).spotTarget.call(owner,ped,{x:20,y:0,z:0},[],undefined,target);expect(spot.visible).toBe(!obstruction);
});

for(const Vehicle of[WorldBike,WorldBoat,WorldPlane])for(const protectedNow of[false,true])test(`${Vehicle.name}: ordinary NPC bullet impacts dispatch damage with their creator, player protection ${protectedNow}`,()=>{
 const v=Object.assign(Object.create(Vehicle.prototype),{assets:{collision:{bounds:{radius:3}}},body:{handle:123},health:1000,disposed:false,occupied:false,modelId:487,canBeDamaged:true,onlyDamagedByPlayer:protectedNow})as any,target=scriptVehicleAttackTarget(v),shooter={id:8},owner={otherVehicleForBody:(handle:number)=>handle===123?target:undefined},collider={handle:77,parent:()=>({handle:123})};
 expect((WorldPedestrians.prototype as any).damageOtherVehicle.call(owner,collider,50,22,shooter)).toBe(true);expect(v.health).toBe(protectedNow?1000:Vehicle===WorldPlane?1000-50*Math.fround(.4):950);if(!protectedNow){expect(v.lastWeaponDamage).toBe(22);expect(v.lastDamagedBy).toEqual({ped:shooter});}
});
test('an unrelated collider or disposed vehicle does not consume the NPC hit dispatch',()=>{
 const dispatch=(WorldPedestrians.prototype as any).damageOtherVehicle,collider={handle:1,parent:()=>({handle:2})};expect(dispatch.call({},collider,10,22,{})).toBe(false);expect(dispatch.call({otherVehicleForBody:()=>({disposed:true})},collider,10,22,{})).toBe(false);expect(dispatch.call({}, {parent:()=>null},10,22,{})).toBe(false);
});
