import {expect,test} from 'vitest';
import reference from './fixtures/driving-training-reference.json';
import {NativeDrivingTraining} from '../src/simulation/nativeDrivingTraining';

for(const [index,row] of reference.cases.entries())test(`complete native driving-training profile ${index}`,()=>{
 const i=row.input,values=[...reference.configuration];for(const [key,value] of Object.entries(i.overrides))values[+key]=value!;
 const training=new NativeDrivingTraining(values);training.counter=i.counter;
 const result=training.step(i.timeStep,{velocity:i.velocity as [number,number,number],automobile:i.vehicleType===0,contactWheels:i.wheels,skill:i.skill},i.showUpdates);
 expect({skill:result.skill,counter:training.counter,checks:result.checks,messages:result.messages}).toEqual({skill:row.skill,counter:row.counter,checks:row.external.filter(e=>e.name==='CheckForStatsMessage').length,messages:row.external.filter(e=>e.name==='DisplayScriptStatUpdateMessage').map(e=>({increase:e.increase,stat:e.stat,value:e.value,max:e.max}))});
});
