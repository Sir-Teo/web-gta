import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Progression} from '../src/simulation/Progression';
import {Simulation} from '../src/simulation/Simulation';
import {ScmStats} from '../src/engine/ScmGameState';
import {WeaponInventory} from '../src/weapons/Inventory';
import {nativeBodyMovementModifier} from '../src/simulation/nativeBodyMovement';
beforeAll(async()=>RAPIER.init());
function fixture(raw=''){
 const sim=new Simulation(),storage={getItem:()=>raw,setItem:(_:string,value:string)=>{raw=value;}};
 const load=(fresh=false)=>{const progression=new Progression(new WeaponInventory(),sim,storage,fresh),stats=new ScmStats();progression.bindTrainingStats(stats);return {progression,stats};};
 return {sim,load,read:()=>JSON.parse(raw)};
}
for(const [fat,muscle] of [[500,500],[123.456789,789.123456],[-1,3000],[0,1000]])test(`body stats round-trip as native floats and keep movement modifier: ${fat}/${muscle}`,()=>{
 const f=fixture();try{
  const {progression,stats}=f.load();stats.set(21,fat);stats.set(23,muscle);expect(progression.save()).toBe(true);
  expect(f.read().trainingStats).toMatchObject({fat:Math.fround(fat),muscle:Math.fround(muscle)});
  const restored=f.load();expect([restored.stats.get(21),restored.stats.get(23)]).toEqual([Math.fround(fat),Math.fround(muscle)]);
  expect(nativeBodyMovementModifier(restored.stats.get(21),restored.stats.get(23))).toBe(nativeBodyMovementModifier(fat,muscle));
 }finally{f.sim.dispose();}
});
test('actual stat increments and decrements update the saved body values',()=>{
 const f=fixture();try{const {progression,stats}=f.load();stats.increment(21,500);stats.increment(23,600);stats.decrement(21,23);stats.decrement(23,50);progression.save();const restored=f.load();expect([restored.stats.get(21),restored.stats.get(23)]).toEqual([477,550]);}finally{f.sim.dispose();}
});
for(const [saved,expected] of [
 [{fat:'500',muscle:50},[0,50]],
 [{fat:1e100,muscle:75},[0,75]],
 [{fat:350,muscle:1e100},[350,0]],
 [{fat:350,muscle:null},[350,0]],
] as const)test(`invalid body fields keep independent valid/default values ${JSON.stringify(saved)}`,()=>{
 const f=fixture(JSON.stringify({version:1,trainingStats:{stamina:350,lungCapacity:200,...saved}}));try{const {stats}=f.load();expect([stats.get(21),stats.get(23)]).toEqual(expected);expect([stats.get(22),stats.get(225)]).toEqual([350,200]);}finally{f.sim.dispose();}
});
test('older saves default body stats, while New Game ignores a stored body',()=>{
 const f=fixture(JSON.stringify({version:1,trainingStats:{stamina:350,lungCapacity:200}}));try{const {stats}=f.load();expect([stats.get(21),stats.get(23)]).toEqual([0,0]);expect(stats.get(22)).toBe(350);}finally{f.sim.dispose();}
 const saved=fixture(JSON.stringify({version:1,trainingStats:{fat:700,muscle:800}}));try{const {stats}=saved.load(true);expect([stats.get(21),stats.get(23)]).toEqual([0,0]);}finally{saved.sim.dispose();}
});
test('saving before stat binding retains body values without changing breath, energy or notifications',()=>{
 const f=fixture(JSON.stringify({version:1,trainingStats:{fat:500,muscle:600}}));try{
  let raw=JSON.stringify({version:1,trainingStats:{fat:500,muscle:600}});
  const storage={getItem:()=>raw,setItem:(_:string,value:string)=>{raw=value;}},progression=new Progression(new WeaponInventory(),f.sim,storage);
  f.sim.player.breath=400;f.sim.player.stamina=-50;expect(progression.save()).toBe(true);
  expect(JSON.parse(raw).trainingStats).toMatchObject({fat:500,muscle:600});
  const stats=new ScmStats(),messages:any[]=[];stats.onUpdateMessage=(...args)=>messages.push(args);progression.bindTrainingStats(stats);
  expect([stats.get(21),stats.get(23)]).toEqual([500,600]);expect([f.sim.player.breath,f.sim.player.stamina]).toEqual([400,-50]);expect(messages).toEqual([]);
 }finally{f.sim.dispose();}
});
test('loaded body waits for MAIN setup and survives a save before body binding',()=>{
 const f=fixture(JSON.stringify({version:1,trainingStats:{fat:500,muscle:600}}));try{
  let raw=JSON.stringify({version:1,trainingStats:{fat:500,muscle:600}});
  const progression=new Progression(new WeaponInventory(),f.sim,{getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}}),stats=new ScmStats();
  progression.bindTrainingStats(stats,{deferBody:true});stats.set(21,200);stats.set(23,50);
  expect(progression.save()).toBe(true);expect(JSON.parse(raw).trainingStats).toMatchObject({fat:500,muscle:600});
  progression.bindBodyStats(stats);expect([stats.get(21),stats.get(23)]).toEqual([500,600]);
 }finally{f.sim.dispose();}
});
test('fresh and older saves adopt MAIN body defaults after setup without saving invented early values',()=>{
 for(const rawBefore of ['',JSON.stringify({version:1,trainingStats:{stamina:350,lungCapacity:200}})]){
  const f=fixture();try{let raw=rawBefore;const progression=new Progression(new WeaponInventory(),f.sim,{getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}}),stats=new ScmStats();
   progression.bindTrainingStats(stats,{deferBody:true});stats.set(21,200);stats.set(23,50);progression.save();
   expect(JSON.parse(raw).trainingStats).not.toHaveProperty('fat');expect(JSON.parse(raw).trainingStats).not.toHaveProperty('muscle');
   progression.bindBodyStats(stats);expect([stats.get(21),stats.get(23)]).toEqual([200,50]);progression.save();expect(JSON.parse(raw).trainingStats).toMatchObject({fat:200,muscle:50});
  }finally{f.sim.dispose();}
 }
});
for(const [saved,expected] of [[{fat:500,muscle:null},[500,50]],[{fat:'bad',muscle:600},[200,600]]] as const)test(`partial body save adopts only missing MAIN defaults ${JSON.stringify(saved)}`,()=>{
 const f=fixture(JSON.stringify({version:1,trainingStats:saved}));try{
  let raw=JSON.stringify({version:1,trainingStats:saved});const progression=new Progression(new WeaponInventory(),f.sim,{getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}}),stats=new ScmStats();
  progression.bindTrainingStats(stats,{deferBody:true});stats.set(21,200);stats.set(23,50);progression.bindBodyStats(stats);
  expect([stats.get(21),stats.get(23)]).toEqual(expected);progression.save();expect(JSON.parse(raw).trainingStats).toMatchObject({fat:expected[0],muscle:expected[1]});
 }finally{f.sim.dispose();}
});
