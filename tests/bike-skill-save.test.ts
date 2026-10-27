import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Progression} from '../src/simulation/Progression';
import {Simulation} from '../src/simulation/Simulation';
import {ScmStats} from '../src/engine/ScmGameState';
import {WeaponInventory} from '../src/weapons/Inventory';
import {NativeMotorbikeTraining} from '../src/simulation/nativeMotorbikeTraining';
import reference from './fixtures/motorbike-training-reference.json';
beforeAll(async()=>RAPIER.init());
for(const [saved,expected] of [[0,0],[25,25],[16777217,16777217],[-2147483648,-2147483648],[2147483647,2147483647],[-1,-1],[25.5,0],['25',0],[2147483648,0],[null,0]] as const)test(`motorbike skill saves only raw signed integers ${saved}`,()=>{
 const sim=new Simulation();let raw=JSON.stringify({version:1,bikeSkill:saved});try{
  const p=new Progression(new WeaponInventory(),sim,{getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}});expect(p.bikeSkill).toBe(expected);p.save();expect(JSON.parse(raw).bikeSkill).toBe(expected);
  const stats=new ScmStats();p.bindBikeStats(stats);expect(stats.get(229)).toBe(Math.fround(expected));
 }finally{sim.dispose();}
});
test('native motorbike training updates saved stat ownership, independently of cycling and driving',()=>{
 const sim=new Simulation();let raw='';const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}};try{
  const p=new Progression(new WeaponInventory(),sim,storage),stats=new ScmStats();p.bindBikeStats(stats);p.bindCyclingStats(stats);p.bindDrivingStats(stats);
  const training=new NativeMotorbikeTraining(reference.configuration);training.counter=180001;
  const result=training.step(50/30,{velocity:[.3,0,0],contactWheels:4,skill:p.bikeSkill});stats.set(229,result.skill);
  expect([stats.get(229),p.bikeSkill,p.cyclingSkill,p.drivingSkill]).toEqual([25,25,0,0]);p.save();
  const restored=new Progression(new WeaponInventory(),sim,storage),next=new ScmStats();restored.bindBikeStats(next);expect(next.get(229)).toBe(25);expect(new NativeMotorbikeTraining(reference.configuration).counter).toBe(0);
 }finally{sim.dispose();}
});
test('early bike-skill binding preserves raw saved ownership without healing and New Game restores zero',()=>{
 const sim=new Simulation();let raw=JSON.stringify({version:1,bikeSkill:16777217});const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}};try{
  const p=new Progression(new WeaponInventory(),sim,storage);sim.player.health=25;sim.player.stamina=-100;p.save();expect(JSON.parse(raw).bikeSkill).toBe(16777217);
  const stats=new ScmStats(),messages:any[]=[];stats.onUpdateMessage=(...a)=>messages.push(a);p.bindBikeStats(stats);expect(p.bikeSkill).toBe(16777217);expect([sim.player.health,sim.player.stamina]).toEqual([25,-100]);expect(messages).toEqual([]);
  stats.increment(229,25);p.save();expect(JSON.parse(raw).bikeSkill).toBe(1000);
  expect(new Progression(new WeaponInventory(),sim,storage,true).bikeSkill).toBe(0);
  expect(new Progression(new WeaponInventory(),sim,{getItem:()=>JSON.stringify({version:1,money:100}),setItem(){}}).bikeSkill).toBe(0);
 }finally{sim.dispose();}
});
