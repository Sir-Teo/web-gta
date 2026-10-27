import {expect,test} from 'vitest';
import reference from './fixtures/cycling-training-reference.json';
import {NativeCyclingTraining} from '../src/simulation/nativeCyclingTraining';
import {NativeBodyExercise,applyBodyExercise} from '../src/simulation/nativeBodyExercise';
import {bikeContactPointCount} from '../src/simulation/nativeBikeControls';
import {ScmStats} from '../src/engine/ScmGameState';

for(const [index,row] of reference.cases.entries())test(`complete native cycling/body training profile ${index}`,()=>{
 const i=row.input,values=[...reference.configuration];for(const [key,value] of Object.entries(i.overrides))values[+key]=value!;
 const stats=new ScmStats();for(const [id,value] of [[21,i.fat],[22,i.stamina],[23,i.muscle],[24,i.maxHealth],[165,i.energy],[230,i.skill]])stats.set(id,value);
 const body=new NativeBodyExercise(values);body.fatCounter=i.fatCounter;body.healthCounter=i.healthCounter;body.messageState=i.messageState;
 const training=new NativeCyclingTraining(values);training.staminaCounter=i.staminaCounter;training.skillCounter=i.skillCounter;
 let bodyChecks=0;const messages:any[]=[],order:string[]=[];
 training.onExercise=(ts,rate)=>{order.push('body');const r=applyBodyExercise(body,ts,rate,stats,i.showUpdates);bodyChecks+=r.checks;messages.push(...r.messages);};
 const increment=stats.increment.bind(stats);stats.increment=(stat,value)=>{order.push(`increment:${stat}`);increment(stat,value);};
 const result=training.step(i.timeStep,{gas:i.gas,boost:i.boost,contactWheels:i.wheels,velocity:i.velocity as [number,number,number],skill:i.skill},stats,i.showUpdates);messages.push(...result.messages);
 expect({fat:stats.get(21),stamina:stats.get(22),muscle:stats.get(23),maxHealth:stats.get(24),skill:result.skill,staminaCounter:training.staminaCounter,skillCounter:training.skillCounter,fatCounter:body.fatCounter,healthCounter:body.healthCounter,messageState:body.messageState}).toEqual({fat:row.fat,stamina:row.stamina,muscle:row.muscle,maxHealth:row.maxHealth,skill:row.skill,staminaCounter:row.staminaCounter,skillCounter:row.skillCounter,fatCounter:row.fatCounter,healthCounter:row.healthCounter,messageState:row.messageState});
 expect(stats.get(230)).toBe(Math.fround(row.skill));
 expect(bodyChecks+result.checks).toBe(row.external.filter(e=>e.name==='CheckForStatsMessage').length);
 expect(messages).toEqual(row.external.flatMap(e=>e.name==='DisplayScriptStatUpdateMessage'&&'stat' in e?[{increase:e.increase,stat:e.stat,value:e.value,max:e.max}]:[]));
 if(i.gas!==0||i.boost)expect(order[0]).toBe('body');else expect(order).toEqual([]);
});

for(const front of [false,true])for(const rear of [false,true])test(`host paired bike contacts match native four-line loop ${front}/${rear}`,()=>{
 const mask=(front?3:0)|(rear?12:0),native=reference.contactCases.find(row=>row.mask===mask)!;
 expect(bikeContactPointCount(front,rear)).toBe(native.contactPoints);
});
