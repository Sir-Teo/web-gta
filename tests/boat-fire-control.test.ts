import {expect,test,vi} from 'vitest';
import reference from './fixtures/boat-fire-reference.json';
import {WorldBoat} from '../src/simulation/WorldBoat';
function hull(input=reference.cases[0].input){
 const boat:any={health:input.health,wrecked:input.wrecked,burnTimer:input.timerMs/1000,sim:{player:{position:{x:1000,y:0,z:1000}}},body:{translation:()=>({x:input.dx,y:input.dz,z:-input.dy})},blowUp:vi.fn()};
 return {boat,process:(dt=input.timeStep/50,camera={x:0,y:0,z:0})=>(WorldBoat.prototype as any).processFire.call(boat,dt,camera)};
}
for(const [i,row] of reference.cases.entries())test(`native camera/health fire-timer gate ${i}`,()=>{
 const f=hull(row.input);f.process();expect(f.boat.burnTimer*1000).toBe(row.timerMs);expect(f.boat.blowUp).toHaveBeenCalledTimes(row.calls.some(c=>c.call==='explode')?1:0);
});
test('the PC timer preserves fractional milliseconds instead of the selected mobile truncation',()=>{
 const f=hull({...reference.cases[0].input,timeStep:50/60});f.process();expect(f.boat.burnTimer*1000).toBe(16.66666603088379);
});
test('the current camera controls burning even when CJ is far away, and altitude is irrelevant',()=>{
 const f=hull();f.process(.1,{x:0,y:1000,z:0});expect(f.boat.burnTimer).toBe(.1);f.process(.1,{x:200,y:0,z:0});expect(f.boat.burnTimer).toBe(.1);
});
test('the native float camera boundary rejects a sub-float difference at 200',()=>{
 const f=hull();f.process(.1,{x:199.999999,y:0,z:0});expect(f.boat.burnTimer).toBe(0);
});
