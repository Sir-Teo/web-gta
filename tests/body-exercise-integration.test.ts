import {expect,test} from 'vitest';
import {NativeBodyExercise,applyBodyExercise} from '../src/simulation/nativeBodyExercise';
import {NativeStatReactions} from '../src/simulation/nativeStatReactions';
import {ScmStats} from '../src/engine/ScmGameState';
import reference from './fixtures/body-exercise-reference.json';

for(const mode of ['running','sprinting','swimming'] as const)test(`${mode} invokes native body exercise before its own stat awards`,()=>{
 const stats=new ScmStats(),exercise=new NativeBodyExercise(reference.configuration),calls:any[]=[];
 stats.set(21,10);stats.set(23,50);stats.set(165,-1);exercise.fatCounter=150001;exercise.healthCounter=600001;
 const reactions=new NativeStatReactions(reference.configuration,(stat,value)=>{calls.push({kind:'award',stat,fat:stats.get(21),muscle:stats.get(23)});stats.increment(stat,value);});
 reactions.onExercise=(ts,rate)=>{calls.push({kind:'exercise',rate});applyBodyExercise(exercise,ts,rate,stats);};
 if(mode==='swimming'){reactions.swimStaminaCounter=180001;reactions.swimming(50/30,true,false);}
 else if(mode==='sprinting'){reactions.sprintStaminaCounter=300001;reactions.sprinting(1000/30);}
 else{reactions.runningCounter=300001;reactions.running(1000/30);}
 expect(calls[0]).toEqual({kind:'exercise',rate:mode==='running'?5:mode==='sprinting'?10:15});
 expect(calls[1]).toMatchObject({kind:'award',fat:0,muscle:60});expect(stats.get(23)).toBe(60);expect(stats.get(24)).toBe(589);
});
test('exercise mutates bound body values without replacing their owner, and counters retain partial work',()=>{
 const saved={fat:200,muscle:50},stats=new ScmStats(),exercise=new NativeBodyExercise(reference.configuration);
 stats.bind(21,{get:()=>saved.fat,set:v=>{saved.fat=v;}});stats.bind(23,{get:()=>saved.muscle,set:v=>{saved.muscle=v;}});
 exercise.fatCounter=149999;applyBodyExercise(exercise,50/30,5,stats);expect(exercise.fatCounter).toBe(150015);expect(saved).toEqual({fat:200,muscle:50});
 // Time without a represented exercising task makes no call and retains that counter.
 const result=applyBodyExercise(exercise,50/30,10,stats);expect(exercise.fatCounter).toBe(0);expect(saved).toEqual({fat:185,muscle:60});expect(result.messages).toEqual([{increase:false,stat:21,value:15,max:1000}]);
 exercise.fatCounter=150001;const hidden=applyBodyExercise(exercise,50/30,15,stats,false);expect(saved).toEqual({fat:170,muscle:70});expect(hidden.messages).toEqual([]);expect(exercise.messageState).toBe(2);
});
