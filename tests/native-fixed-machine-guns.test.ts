import {expect,test} from 'vitest';
import fixed from './fixtures/predator-fixed-guns-reference.json';
import aiming from './fixtures/predator-aim-reference.json';
import {NativeFixedMachineGuns,aimFixedMachineGun} from '../src/simulation/nativeFixedMachineGuns';
for(const [i,row] of fixed.cases.entries())test(`native fixed machine-gun capture ${i}`,()=>{
 const gun=new NativeFixedMachineGuns(),r=row.input;gun.lastShotMs=r.lastShotMs;gun.clip=r.clip;let index=0;
 const shots=gun.step(r.nowMs,r.pressed,r.forward,r.gunOff,r.matrix,()=>r.random[index++]);
 expect(shots).toEqual(row.calls.filter(c=>c.call==='shot').map(c=>({start:c.start,end:c.end,intensity:c.intensity})));expect(index).toBe(row.calls.filter(c=>c.call==='random').length);expect(gun.lastShotMs).toBe(row.lastShotMs);expect(gun.clip).toBe(row.clip);
});
for(const [i,row] of aiming.cases.entries())test(`native fixed machine-gun aim capture ${i}`,()=>{
 const r=row.input,tuple=(v:number[]):[number,number,number]=>[v[0],v[1],v[2]];expect(aimFixedMachineGun(tuple(r.vehicle),tuple(r.start),tuple(r.end),r.candidates.map(c=>({...c,position:tuple(c.position)})))).toEqual(row.end);
 expect(row.query).toEqual({max:15,twoD:1,buildings:0,vehicles:1,peds:0});
});
test('the native query caps 15 vehicles before testing scorch and self filters',()=>{
 const start:[number,number,number]=[2,2.5,1],end:[number,number,number]=[2,62.5,1],ignored=Array.from({length:15},()=>({position:[2,10,0] as [number,number,number],radius:2,scorched:true}));
 expect(aimFixedMachineGun([0,0,0],start,end,[...ignored,{position:[2,30,2],radius:2}])).toEqual(end);
});
test('each round resolves before the following barrel draws its spread, matching native call order',()=>{
 const row=fixed.cases[0],gun=new NativeFixedMachineGuns(),calls:string[]=[];
 gun.step(151,true,true,false,row.input.matrix,()=>{calls.push('random');return 128;},()=>calls.push('shot'));
 expect(calls).toEqual(row.calls.filter(c=>c.call==='random'||c.call==='shot').map(c=>c.call));
});
