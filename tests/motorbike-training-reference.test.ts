import {expect,test} from 'vitest';
import reference from './fixtures/motorbike-training-reference.json';
import dispatch from './fixtures/vehicle-training-dispatch-reference.json';
import {NativeMotorbikeTraining,motorbikeTrainingMoving} from '../src/simulation/nativeMotorbikeTraining';

for(const [index,row] of reference.cases.entries())test(`complete native motorbike training profile ${index}`,()=>{
 const i=row.input,values=[...reference.configuration];for(const [key,value] of Object.entries(i.overrides))values[+key]=value!;
 const training=new NativeMotorbikeTraining(values);training.counter=i.counter;
 const result=training.step(i.timeStep,{velocity:i.velocity as [number,number,number],contactWheels:i.wheels,skill:i.skill},i.showUpdates);
 expect({counter:training.counter,skill:result.skill,checks:result.checks,messages:result.messages}).toEqual({counter:row.counter,skill:row.skill,checks:row.external.filter(e=>e.name==='CheckForStatsMessage').length,messages:row.external.flatMap(e=>e.name==='DisplayScriptStatUpdateMessage'&&'stat' in e?[{increase:e.increase,stat:e.stat,value:e.value,max:e.max}]:[])});
});

for(const [index,row] of dispatch.cases.filter(row=>row.input.model===461).entries())test(`native motorbike dispatch speed gate ${index}`,()=>{
 expect(motorbikeTrainingMoving(row.input.velocity as [number,number,number])).toBe(row.calls.some(call=>call.name==='motorbike'));
});
