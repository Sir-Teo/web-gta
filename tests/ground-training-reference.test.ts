import {expect,test} from 'vitest';
import reference from './fixtures/ground-training-reference.json';
import {NativeStatReactions} from '../src/simulation/nativeStatReactions';
import {NativeBodyExercise,applyBodyExercise} from '../src/simulation/nativeBodyExercise';
import {ScmStats} from '../src/engine/ScmGameState';

for(const [index,row] of reference.cases.entries())test(`complete native ${row.input.mode} and body training profile ${index}`,()=>{
 const i=row.input,values=[...reference.configuration];for(const [key,value] of Object.entries(i.overrides))values[+key]=value!;
 const stats=new ScmStats();for(const [id,value] of [[21,i.fat],[22,i.stamina],[23,i.muscle],[24,i.maxHealth],[165,i.energy]])stats.set(id,value);
 const exercise=new NativeBodyExercise(values);exercise.fatCounter=i.fatCounter;exercise.healthCounter=i.healthCounter;
 const awards:number[][]=[],rates:number[]=[],order:string[]=[];
 const reactions=new NativeStatReactions(values,(stat,value)=>{order.push('award');awards.push([stat,value]);stats.increment(stat,value);});
 reactions.onExercise=(timeStep,rate)=>{order.push('body');rates.push(rate);applyBodyExercise(exercise,timeStep,rate,stats,i.showUpdates);};
 const key=i.mode==='running'?'runningCounter':'sprintStaminaCounter';reactions[key]=i.counter;
 if(i.mode==='running')reactions.running(i.timeStep*20);else reactions.sprinting(i.timeStep*20);
 expect({counter:reactions[key],fat:stats.get(21),stamina:stats.get(22),muscle:stats.get(23),maxHealth:stats.get(24),fatCounter:exercise.fatCounter,healthCounter:exercise.healthCounter,messageState:exercise.messageState}).toEqual({counter:row.counter,fat:row.fat,stamina:row.stamina,muscle:row.muscle,maxHealth:row.maxHealth,fatCounter:row.fatCounter,healthCounter:row.healthCounter,messageState:row.messageState});
 expect(rates).toEqual(row.external.filter(e=>e.name==='BodyExercise').map(e=>e.rate));
 expect(awards).toEqual(row.external.flatMap(e=>e.name==='StaminaWrite'&&'amount' in e?[[22,e.amount]]:[]));
 expect(order[0]).toBe('body');
});
