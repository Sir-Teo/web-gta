import {expect,test} from 'vitest';
import {stepNativeBicycleHop,type BicycleHopState} from '../src/simulation/nativeBicycleHop';
import {stepBicycleCrank} from '../src/simulation/bicycleCrank';
const input={pressed:false,held:false,ridden:true,duration:1};

test('a native press charges on both the press and held branches; the association controls gas cutoff',()=>{
 let state:BicycleHopState={charge:0};
 let result=stepNativeBicycleHop(state,{...input,pressed:true,held:true},.02);state=result.state;
 expect(state.charge).toBe(2);expect(state.animation?.seconds).toBeCloseTo(.016);expect(state.animation?.amount).toBeCloseTo(.16);expect(result.cutGas).toBe(false);
 for(let i=0;i<3;i++)state=stepNativeBicycleHop(state,{...input,held:true},.02).state;
 expect(state.animation?.amount).toBeCloseTo(.64);
 result=stepNativeBicycleHop(state,{...input,held:true},.02);expect(result.cutGas).toBe(true);
 const atHalf={charge:3,animation:{...state.animation!,amount:.5}};expect(stepNativeBicycleHop(atHalf,{...input,held:true},0).cutGas).toBe(false);
});
test('partial release skips unused time, advances at 1.5x and launches once at the clip finish',()=>{
 let state=stepNativeBicycleHop({charge:0},{...input,pressed:true,held:true},.02).state;
 state=stepNativeBicycleHop(state,{...input,held:true},.02).state;expect(state.charge).toBe(3);
 let result=stepNativeBicycleHop(state,input,.02);state=result.state;
 expect(state.animation?.seconds).toBeCloseTo(.2+(1-3/25)*.8+.03);expect(state.animation?.speed).toBe(1.5);
 const launches:number[]=[];
 for(let i=0;i<25;i++){result=stepNativeBicycleHop(state,input,.02);state=result.state;if(result.launchCharge!==undefined)launches.push(result.launchCharge);}
 expect(launches).toEqual([3]);expect(state.animation).toBeUndefined();expect(state.charge).toBe(0);
});
test('finish fade retains charge until association removal, with no extra or shared cooldown',()=>{
 let a=stepNativeBicycleHop({charge:0},{...input,pressed:true,held:true},.02).state;
 for(let i=0;i<30;i++)a=stepNativeBicycleHop(a,{...input,held:true},.02).state;
 expect(a.charge).toBe(25);expect(a.animation?.seconds).toBe(.2);expect(a.animation?.amount).toBe(1);
 let launch:ReturnType<typeof stepNativeBicycleHop>;
 do{launch=stepNativeBicycleHop(a,input,.02);a=launch.state;}while(launch.launchCharge===undefined);
 expect(launch.launchCharge).toBe(25);expect(a.charge).toBe(25);expect(a.animation?.blendDelta).toBe(-4);
 const b=stepNativeBicycleHop({charge:0},{...input,pressed:true,held:true},.02).state;expect(b.charge).toBe(2);
 for(let i=0;i<14;i++)a=stepNativeBicycleHop(a,input,.02).state;
 expect(a.animation).toBeUndefined();expect(a.charge).toBe(0);
 expect(stepNativeBicycleHop(a,{...input,pressed:true,held:true},.02).state.charge).toBe(2);
});
test('missing clips cannot create a timed fallback hop; cancellation removes the secondary pose without launching',()=>{
 expect(stepNativeBicycleHop({charge:0},{...input,pressed:true,held:true,duration:undefined},.02).state).toEqual({charge:0,animation:undefined});
 let state=stepNativeBicycleHop({charge:0},{...input,pressed:true,held:true},.1).state;
 const cancelled=stepNativeBicycleHop(state,{...input,disabled:true},.1);expect(cancelled.state.charge).toBe(0);expect(cancelled.launchCharge).toBeUndefined();expect(cancelled.state.animation).toBeUndefined();
 const frozen=stepNativeBicycleHop(state,{...input,held:true},0);expect(frozen.state).toEqual(state);expect(frozen.launchCharge).toBeUndefined();
 expect(stepNativeBicycleHop(state,{...input,ridden:false},.1).state.animation).toBeUndefined();
});
test('the jump association owns the crank through its finish fade',()=>{
 expect(stepBicycleCrank(-2,1,{seconds:.2,duration:1},0)).toBe(-2);
 expect(stepBicycleCrank(-2,1,{seconds:.2,duration:1},.5)).toBeCloseTo((-2+Math.PI/2)/2,6);
 expect(stepBicycleCrank(-2,1,{seconds:.2,duration:1},1)).toBe(Math.fround(Math.PI/2));
});
