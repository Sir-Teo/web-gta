import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Progression} from '../src/simulation/Progression';
import {Simulation} from '../src/simulation/Simulation';
import {ScmStats} from '../src/engine/ScmGameState';
import {WeaponInventory} from '../src/weapons/Inventory';
import {NativeCyclingTraining} from '../src/simulation/nativeCyclingTraining';
import {NativeBodyExercise,applyBodyExercise} from '../src/simulation/nativeBodyExercise';
import reference from './fixtures/cycling-training-reference.json';
beforeAll(async()=>RAPIER.init());

for(const [saved,expected] of [[0,0],[50,50],[16777217,16777217],[-2147483648,-2147483648],[2147483647,2147483647],[-1,-1],[50.5,0],['50',0],[2147483648,0],[null,0]] as const)test(`cycling save preserves only raw signed integers ${saved}`,()=>{
 const sim=new Simulation();let raw=JSON.stringify({version:1,cyclingSkill:saved});try{
  const p=new Progression(new WeaponInventory(),sim,{getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}});
  expect(p.cyclingSkill).toBe(expected);p.save();expect(JSON.parse(raw).cyclingSkill).toBe(expected);
  const stats=new ScmStats();p.bindCyclingStats(stats);expect(stats.get(230)).toBe(Math.fround(expected));
 }finally{sim.dispose();}
});
test('native cycling/body/stamina awards share saved ownership and survive a fresh stat store',()=>{
 const sim=new Simulation();let raw='';const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}};
 try{
  const p=new Progression(new WeaponInventory(),sim,storage),stats=new ScmStats();p.bindTrainingStats(stats);p.bindCyclingStats(stats);
  stats.set(21,200);stats.set(23,50);stats.set(165,-1);
  const body=new NativeBodyExercise(reference.configuration);body.fatCounter=150001;body.healthCounter=600001;
  const training=new NativeCyclingTraining(reference.configuration);training.staminaCounter=300001;training.skillCounter=120001;
  training.onExercise=(ts,rate)=>{applyBodyExercise(body,ts,rate,stats);};
  training.step(50/30,{gas:1,boost:true,contactWheels:2,velocity:[.3,0,0],skill:p.cyclingSkill},stats);
  expect([stats.get(21),stats.get(22),stats.get(23),stats.get(24),stats.get(230)]).toEqual([162,150,60,589,50]);
  expect(p.cyclingSkill).toBe(50);p.save();
  const restored=new Progression(new WeaponInventory(),sim,storage),next=new ScmStats();restored.bindTrainingStats(next);restored.bindCyclingStats(next);
  expect([next.get(21),next.get(22),next.get(23),next.get(24),next.get(230)]).toEqual([162,150,60,589,50]);
  expect([new NativeCyclingTraining(reference.configuration).staminaCounter,new NativeCyclingTraining(reference.configuration).skillCounter]).toEqual([0,0]);
 }finally{sim.dispose();}
});
test('early saves preserve loaded cycling before binding, and fresh games use native zero',()=>{
 const sim=new Simulation();let raw=JSON.stringify({version:1,cyclingSkill:16777217});const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}};
 try{
  const p=new Progression(new WeaponInventory(),sim,storage);sim.player.health=25;sim.player.stamina=-100;p.save();expect(JSON.parse(raw).cyclingSkill).toBe(16777217);
  const stats=new ScmStats(),messages:any[]=[];stats.onUpdateMessage=(...a)=>messages.push(a);p.bindCyclingStats(stats);
  expect(p.cyclingSkill).toBe(16777217);expect([sim.player.health,sim.player.stamina]).toEqual([25,-100]);expect(messages).toEqual([]);
  stats.increment(230,50);p.save();expect(JSON.parse(raw).cyclingSkill).toBe(1000);
  expect(new Progression(new WeaponInventory(),sim,storage,true).cyclingSkill).toBe(0);
  expect(new Progression(new WeaponInventory(),sim,{getItem:()=>JSON.stringify({version:1,money:500}),setItem(){}}).cyclingSkill).toBe(0);
 }finally{sim.dispose();}
});
