import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {readFileSync} from 'node:fs';
import {Progression} from '../src/simulation/Progression';
import {Simulation} from '../src/simulation/Simulation';
import {ScmStats} from '../src/engine/ScmGameState';
import {WeaponInventory} from '../src/weapons/Inventory';
import {nativeLungCapacity} from '../src/simulation/nativeLungCapacity';
import {NativeStatReactions,readActionReactionStats} from '../src/simulation/nativeStatReactions';
beforeAll(async()=>{await RAPIER.init();});
const values=readActionReactionStats(readFileSync('public/play/world/files/data/ar_stats.dat','utf8'));
function fixture(raw=''){
 const sim=new Simulation(),storage={getItem:()=>raw,setItem:(_:string,value:string)=>{raw=value;}};
 const load=(fresh=false)=>{const progression=new Progression(new WeaponInventory(),sim,storage,fresh),stats=new ScmStats();progression.bindTrainingStats(stats);return {progression,stats};};
 return {sim,load,read:()=>JSON.parse(raw)};
}
test('actual native swimming gains survive the versioned browser save and a new stat store',()=>{
 const f=fixture();try{
  const {progression,stats}=f.load(),training=new NativeStatReactions(values,(stat,value)=>stats.increment(stat,value));
  training.swimStaminaCounter=180001;training.underwaterCounter=60001;training.swimming(1,true,false);
  expect([stats.get(22),stats.get(225)]).toEqual([150,50]);expect(progression.save()).toBe(true);
  const restored=f.load();expect([restored.stats.get(22),restored.stats.get(225)]).toEqual([150,50]);expect(nativeLungCapacity(restored.stats.get(225),restored.stats.get(22))).toBe(1300);
  expect(f.read().trainingStats).toEqual({stamina:150,lungCapacity:50,fat:0,muscle:0});
  const newCounters=new NativeStatReactions(values,()=>{});expect([newCounters.swimStaminaCounter,newCounters.underwaterCounter]).toEqual([0,0]);
 }finally{f.sim.dispose();}
});
for(const [stamina,lung] of [[123.456789,32768],[-1,-1],[1000,1000],[999.999,16777217]])test(`training stat storage round-trips native float/int values ${stamina}/${lung}`,()=>{
 const f=fixture();try{
  const {progression,stats}=f.load();stats.set(22,stamina);stats.set(225,lung);progression.save();const restored=f.load();
  expect(restored.stats.get(22)).toBe(Math.fround(stamina));expect(restored.stats.get(225)).toBe(Math.fround(lung));
  expect(f.read().trainingStats).toEqual({stamina:Math.fround(stamina),lungCapacity:lung,fat:0,muscle:0});
 }finally{f.sim.dispose();}
});
test('old saves retain native initial stats, and fresh New Game ignores saved training',()=>{
 const f=fixture(JSON.stringify({version:1,money:321,drivingSkill:40}));try{const old=f.load();expect([old.stats.get(22),old.stats.get(225)]).toEqual([100,0]);expect(f.sim.money).toBe(321);expect(old.progression.drivingSkill).toBe(40);}finally{f.sim.dispose();}
 const saved=fixture(JSON.stringify({version:1,trainingStats:{stamina:700,lungCapacity:800}}));try{const fresh=saved.load(true);expect([fresh.stats.get(22),fresh.stats.get(225)]).toEqual([100,0]);}finally{saved.sim.dispose();}
});
for(const [trainingStats,expected] of [
 [{stamina:'350',lungCapacity:100},[100,100]],
 [{stamina:1e100,lungCapacity:75},[100,75]],
 [{stamina:350,lungCapacity:75.5},[350,0]],
 [{stamina:350,lungCapacity:2147483648},[350,0]],
 ['invalid',[100,0]],
 [null,[100,0]],
] as const)test(`invalid training-save fields retain independent valid/default values ${JSON.stringify(trainingStats)}`,()=>{
 const f=fixture(JSON.stringify({version:1,trainingStats}));try{const {stats}=f.load();expect([stats.get(22),stats.get(225)]).toEqual(expected);}finally{f.sim.dispose();}
});
test('saving before the script stat store is bound retains loaded training without notifications or breath refill',()=>{
 const f=fixture(JSON.stringify({version:1,trainingStats:{stamina:350,lungCapacity:200}}));try{
  // The menu/pagehide may save before the world/MAIN.SCM has initialized.
  let raw=JSON.stringify({version:1,trainingStats:{stamina:350,lungCapacity:200}});
  const storage={getItem:()=>raw,setItem:(_:string,value:string)=>{raw=value;}},progression=new Progression(new WeaponInventory(),f.sim,storage);
  f.sim.player.breath=573;expect(progression.save()).toBe(true);expect(JSON.parse(raw).trainingStats).toEqual({stamina:350,lungCapacity:200});
  const stats=new ScmStats(),messages:any[]=[];stats.onUpdateMessage=(...args)=>messages.push(args);progression.bindTrainingStats(stats);
  expect([stats.get(22),stats.get(225)]).toEqual([350,200]);expect(f.sim.player.breath).toBe(573);expect(messages).toEqual([]);
 }finally{f.sim.dispose();}
});
