import {expect,test} from 'vitest';
import {NativeBodyExercise} from '../src/simulation/nativeBodyExercise';
import reference from './fixtures/body-exercise-reference.json';
for(const [i,row] of reference.cases.entries())test(`captured body exercise ${i}`,()=>{
 const v=row.input,values=[...reference.configuration];for(const [key,value] of Object.entries(v.overrides))values[Number(key)]=value as number;
 const exercise=new NativeBodyExercise(values),stats={fat:v.fat,muscle:v.muscle,maxHealth:v.maxHealth};
 Object.assign(exercise,{fatCounter:v.fatCounter,healthCounter:v.healthCounter,messageState:v.messageState});
 const result=exercise.step(v.timeStep,v.exerciseRate,stats,v.showUpdates);
 expect({...stats,fatCounter:exercise.fatCounter,healthCounter:exercise.healthCounter,messageState:exercise.messageState}).toEqual({fat:row.fat,muscle:row.muscle,maxHealth:row.maxHealth,fatCounter:row.fatCounter,healthCounter:row.healthCounter,messageState:row.messageState});
 expect(result.checks).toBe(row.external.filter(e=>e.name==='CheckForStatsMessage').length);
 expect(result.messages).toEqual(row.external.filter(e=>e.name==='DisplayScriptStatUpdateMessage').map(e=>({increase:e.increase!,stat:e.stat!,value:e.value!,max:e.max!})));
});
