import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {readFileSync} from 'node:fs';
import {Progression} from '../src/simulation/Progression';
import {Simulation} from '../src/simulation/Simulation';
import {ScmStats} from '../src/engine/ScmGameState';
import {WeaponInventory} from '../src/weapons/Inventory';
import {NativeBodyExercise,applyBodyExercise} from '../src/simulation/nativeBodyExercise';
import {readActionReactionStats} from '../src/simulation/nativeStatReactions';
beforeAll(async()=>RAPIER.init());
const values=readActionReactionStats(readFileSync('public/play/world/files/data/ar_stats.dat','utf8'));
function fixture(saved?:unknown){
 const sim=new Simulation();let raw=saved===undefined?'':JSON.stringify({version:1,trainingStats:saved});
 const storage={getItem:()=>raw,setItem:(_:string,value:string)=>{raw=value;}};
 const load=(fresh=false)=>{const progression=new Progression(new WeaponInventory(),sim,storage,fresh),stats=new ScmStats();progression.bindTrainingStats(stats,{deferBody:true});return {progression,stats};};
 return {sim,load,read:()=>JSON.parse(raw)};
}
test('captured exercise health gain survives the normal save and a fresh script store',()=>{
 const f=fixture();try{const {progression,stats}=f.load();progression.bindBodyStats(stats);
  const exercise=new NativeBodyExercise(values);exercise.healthCounter=600001;applyBodyExercise(exercise,50/30,5,stats,false);
  expect(stats.get(24)).toBe(589);expect(progression.save()).toBe(true);expect(f.read().trainingStats.maxHealth).toBe(589);
  const restored=f.load();restored.progression.bindBodyStats(restored.stats);expect(restored.stats.get(24)).toBe(589);
  expect(new NativeBodyExercise(values).healthCounter).toBe(0);
 }finally{f.sim.dispose();}
});
for(const value of [123.456789,-1,1500])test(`raw health stat preserves script-set float ${value}`,()=>{
 const f=fixture();try{const {progression,stats}=f.load();progression.bindBodyStats(stats);stats.set(24,value);progression.save();const restored=f.load();restored.progression.bindBodyStats(restored.stats);expect(restored.stats.get(24)).toBe(Math.fround(value));}finally{f.sim.dispose();}
});
test('loaded health ownership survives early saves and temporary MAIN writes without healing',()=>{
 const f=fixture({maxHealth:789});try{const {progression,stats}=f.load();f.sim.player.health=37;stats.set(24,569);
  progression.save();expect(f.read().trainingStats.maxHealth).toBe(789);
  const messages:any[]=[];stats.onUpdateMessage=(...args)=>messages.push(args);progression.bindBodyStats(stats);
  expect(stats.get(24)).toBe(789);expect(f.sim.player.health).toBe(37);expect(messages).toEqual([]);
  stats.increment(24,20);stats.decrement(24,5);progression.save();expect(f.read().trainingStats.maxHealth).toBe(804);
 }finally{f.sim.dispose();}
});
for(const maxHealth of [undefined,null,'789',1e100])test(`missing/invalid health field adopts completed setup independently: ${maxHealth}`,()=>{
 const f=fixture({maxHealth,fat:500,muscle:600,stamina:350,lungCapacity:200});try{const {progression,stats}=f.load();
  progression.save();expect(f.read().trainingStats).not.toHaveProperty('maxHealth');
  stats.set(24,615);progression.bindBodyStats(stats);expect([stats.get(24),stats.get(21),stats.get(23),stats.get(22),stats.get(225)]).toEqual([615,500,600,350,200]);
  progression.save();expect(f.read().trainingStats.maxHealth).toBe(615);
 }finally{f.sim.dispose();}
});
test('fresh New Game and older saves retain the native initial health stat',()=>{
 const f=fixture({maxHealth:900});try{const {progression,stats}=f.load(true);progression.bindBodyStats(stats);expect(stats.get(24)).toBe(569);}finally{f.sim.dispose();}
 const old=fixture({stamina:350});try{const {progression,stats}=old.load();progression.bindBodyStats(stats);expect(stats.get(24)).toBe(569);}finally{old.sim.dispose();}
});
