import {expect,test} from 'vitest';
import {restoreStoredParts,storedPlacement,storeVehicle} from '../src/simulation/storedVehicles';
import {STORED_CAR} from '../src/engine/ScmGarages';
// CStoredCar::StoreCar and RestoreCar for the port's vehicles: what a garage keeps and how the car comes back.
const vehicle=(heading:number,extra:object={})=>({modelId:400,car:{body:{translation:()=>({x:10,y:13,z:-20}),rotation:()=>({x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)})},nitro:{installed:true,boosts:7}},
 assets:{colourIndices:[3,1,0,0]},proofs:{bullet:true,fire:false,explosion:true,collision:false,melee:false},bombOnBoard:2,...extra});
test('StoreCar: native position, the forward times 100 cut, colours, proofs and nitro as flags, boosts and the bomb',()=>{
 // Turned a quarter left in the renderer (+y up): the model's forward (-z) goes to -x, native west.
 const stored=storeVehicle(vehicle(Math.PI/2));
 expect(stored).toEqual({model:400,position:[10,20,13],forward:[-100,0,0],colours:[3,1,0,0],flags:STORED_CAR.bulletProof|STORED_CAR.explosionProof|STORED_CAR.nitro,nitroBoosts:7,bomb:2});
 // A bike keeps no colours, proofs, nitro or bomb.
 expect(storeVehicle({modelId:581,car:{body:vehicle(0).car.body},assets:{}})).toEqual({model:581,position:[10,20,13],forward:[0,100,0],colours:[-1,-1,-1,-1],flags:0,nitroBoosts:0});
});
test('RestoreCar: the same place and turn back (to the hundredths the forward is kept to), level and upright',()=>{
 for(const heading of [0,.3,Math.PI/2,2.5,-1.2]){
  const {position,rotation}=storedPlacement(storeVehicle(vehicle(heading)));
  expect(position).toEqual({x:10,y:13,z:-20});
  const dot=Math.abs(rotation.y*Math.sin(heading/2)+rotation.w*Math.cos(heading/2));
  expect(dot).toBeGreaterThan(.9999);expect(Math.abs(rotation.x)+Math.abs(rotation.z)).toBeLessThan(1e-6);
 }
});
test('RestoreCar gives an automobile its proofs, nitro and bomb back; a bike none',()=>{
 const calls:number[]=[];const car={proofs:undefined as unknown,bombOnBoard:0,car:{nitrousControl:(boost:number)=>calls.push(boost)}};
 restoreStoredParts(car as never,{model:400,position:[0,0,0],forward:[0,100,0],colours:[0,0,0,0],flags:STORED_CAR.fireProof|STORED_CAR.nitro,nitroBoosts:4,bomb:3});
 expect(car.proofs).toEqual({bullet:false,fire:true,explosion:false,collision:false,melee:false});expect(calls).toEqual([4]);expect(car.bombOnBoard).toBe(3);
 const bike={car:{}} as {car:object;proofs?:unknown};restoreStoredParts(bike as never,{model:581,position:[0,0,0],forward:[0,100,0],colours:[0,0,0,0],flags:STORED_CAR.bulletProof,nitroBoosts:0,bomb:1});
 expect(bike.proofs).toBeUndefined();expect('bombOnBoard' in bike).toBe(false);
});
