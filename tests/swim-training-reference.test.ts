import {expect,test} from 'vitest';
import {ScmStats} from '../src/engine/ScmGameState';
import {NativeStatReactions,swimTrainingActive} from '../src/simulation/nativeStatReactions';
import reference from './fixtures/swim-training-reference.json';
for(const [i,row] of reference.cases.entries())test(`captured native swimming training ${i}`,()=>{
 const stats=new ScmStats(),r=row.input;
 for(const [stat,value] of [[22,r.stamina],[225,r.lung],[165,r.energy],[21,r.fat]])stats.set(stat,value);
 const reactions=new NativeStatReactions(reference.configuration,(stat,value)=>stats.increment(stat,value));
 reactions.swimStaminaCounter=r.swimCounter;reactions.underwaterCounter=r.breathCounter;
 const exercise=reactions.swimming(r.timeStep,r.underwater,r.sprinting);
 expect({swimCounter:reactions.swimStaminaCounter,breathCounter:reactions.underwaterCounter,stamina:stats.get(22),lung:stats.get(225),fat:stats.get(21)}).toEqual({swimCounter:row.swimCounter,breathCounter:row.breathCounter,stamina:row.stamina,lung:row.lung,fat:row.fat});
 expect(exercise).toBe(row.external.find(e=>e.address==='0x100265280')!.w0);
});
test('swim training keeps the native strict movement gate and underwater exception',()=>{
 expect(swimTrainingActive(true,.5,1)).toBe(false);expect(swimTrainingActive(true,.500001,1)).toBe(true);
 expect(swimTrainingActive(true,0,4)).toBe(true);expect(swimTrainingActive(false,1,4)).toBe(false);
 expect(swimTrainingActive(true,0,0)).toBe(false);expect(swimTrainingActive(true,0,3)).toBe(false);expect(swimTrainingActive(true,0,5)).toBe(false);
});
test('swimming and underwater time accumulate independently across separate visits to the water',()=>{
 const stats=new ScmStats(),reactions=new NativeStatReactions(reference.configuration,(stat,value)=>stats.increment(stat,value));
 reactions.swimStaminaCounter=180000;reactions.underwaterCounter=60000;
 reactions.swimming(1,false,false);expect(stats.get(22)).toBe(100);expect(stats.get(225)).toBe(0);expect(reactions.underwaterCounter).toBe(60000);
 reactions.swimming(1,false,true);expect(stats.get(22)).toBe(150);expect(reactions.underwaterCounter).toBe(60000);
 reactions.swimming(1,true,false);expect(stats.get(225)).toBe(0);expect(reactions.underwaterCounter).toBe(60020);
 reactions.swimming(1,true,false);expect(stats.get(225)).toBe(50);expect(reactions.underwaterCounter).toBe(0);
});
