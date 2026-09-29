import {expect,test} from 'vitest';
import {WorldBike} from '../src/simulation/WorldBike';

// CQuadBike is a CAutomobile: CAutomobile::VehicleDamage takes a crash out of its health (a quarter of the loss empty,
// half of it with the player aboard), and the hit that would empty it leaves 1. Motorbikes take no such loss here.
const crash=(o:{type:string;health?:number;occupied?:boolean;change:number})=>{
  const bike=Object.assign(Object.create(WorldBike.prototype),{assets:{vehicle:{type:o.type},handling:{values:{mass:300,collisionDamageMultiplier:1}}},
    modelId:471,wrecked:false,health:o.health??1000,occupied:!!o.occupied,stepVelocity:{x:o.change,y:0,z:0},
    body:{isEnabled:()=>true,linvel:()=>({x:0,y:0,z:0}),rotation:()=>({x:0,y:0,z:0,w:1})}});
  (WorldBike.prototype as any).collisionKnockOff.call(bike);
  return bike.health;
};
test('a quad loses health in a crash; a motorbike does not',()=>{
  // Intensity 300 × 10 / 50 = 60 against the 300 / 1500 × 25 = 5 floor: (60 − 5) × 0.6 = 33, a quarter of it empty.
  expect(crash({type:'quad',change:10})).toBeCloseTo(1000-33/4,6);
  expect(crash({type:'bike',change:10})).toBe(1000);
});
test('the crash that would empty the quad leaves it at 1',()=>{
  expect(crash({type:'quad',change:10,health:5})).toBe(1);
});
