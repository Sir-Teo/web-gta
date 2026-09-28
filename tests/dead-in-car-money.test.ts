import {expect,test} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

// CPed::CreateDeadPedMoney returns at once for a ped that died bInVehicle: a body set down from a car leaves no cash.
test('a ped killed in its car carries no cash to drop',()=>{
  const ped={money:400,collider:{handle:1}} as any;
  const self={spawnFromCar:(_m:unknown,_p:unknown,_h:unknown,_g:unknown,_s:unknown,made:(p:any)=>void)=>{made(ped);return ped;},damageCollider:()=>undefined};
  (WorldPedestrians.prototype as any).spawnDead.call(self,0,{x:0,y:0,z:0},0);
  expect(ped.money).toBe(0);
});
