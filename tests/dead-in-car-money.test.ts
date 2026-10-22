import {expect,test} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

// CPed::CreateDeadPedMoney returns at once for a ped that died bInVehicle: a body set down from a car leaves no cash.
test('a ped killed in its car carries no cash to drop',()=>{
  const ped={money:400,collider:{handle:1}} as any;
  const self={spawnFromCar:(_m:unknown,_p:unknown,_h:unknown,_g:unknown,_s:unknown,made:(p:any)=>void)=>{made(ped);return ped;},damageCollider:()=>undefined};
  (WorldPedestrians.prototype as any).spawnDead.call(self,0,{x:0,y:0,z:0},0);
  expect(ped.money).toBe(0);
});

test('only a corpse spawned from a destroyed vehicle carries the scorched flag',()=>{
 for(const scorched of [false,true]){
  const ped={money:400,collider:{handle:1}} as any,self={spawnFromCar:(_m:unknown,_p:unknown,_h:unknown,_g:unknown,_s:unknown,made:(p:any)=>void)=>{made(ped);return ped;},damageCollider:()=>undefined};
  (WorldPedestrians.prototype as any).spawnDead.call(self,0,{x:0,y:0,z:0},0,undefined,false,scorched);expect(ped.renderScorched).toBe(scorched);expect(ped.money).toBe(0);
 }
});

test('a revived street ped clears scorched lighting with the native revive response',()=>{
 const ped={id:1,health:0,renderScorched:true,view:{reactionName:'ko_shot_front',reactionDuration:()=>1.37}} as any;
 expect(WorldPedestrians.prototype.revive.call({people:[ped]} as any,1)).toBe(true);expect(ped.health).toBe(100);expect(ped.renderScorched).toBe(false);
});
