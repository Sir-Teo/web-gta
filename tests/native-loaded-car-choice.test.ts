import {test,expect} from 'vitest';
import {pickNativeLoadedCar,type LoadedCarChoice} from '../src/simulation/nativeLoadedCarChoice';
const car=(modelId:number,frequency:number,overrides:Partial<LoadedCarChoice>={}):LoadedCarChoice=>({modelId,frequency,vehicleClass:'normal',references:0,suppressed:false,scriptBlocked:false,phasingOut:false,...overrides});
const policy={normalOnly:true,notTooMany:true};
test('native weighted boundaries preserve >= and ordering rather than uniform choice',()=>{
 const choices=[car(400,2),car(401,3),car(402,5)],results=Array.from({length:10},(_,weight)=>pickNativeLoadedCar(choices,policy,upper=>{expect(upper).toBe(10);return weight;}));
 expect(results).toEqual([400,400,400,401,401,401,402,402,402,402]);
 expect(pickNativeLoadedCar([car(400,0),car(401,5)],policy,()=>0)).toBe(400);
});
test('class filtering happens before weighting, while suppression/refcount cause retries',()=>{
 const choices=[car(400,100,{vehicleClass:'executive'}),car(401,2,{suppressed:true}),car(402,3,{references:3}),car(403,5,{vehicleClass:'motorbike'})];
 let calls=0;expect(pickNativeLoadedCar(choices,policy,max=>{expect(max).toBe(10);return [0,3,6][calls++];})).toBe(403);expect(calls).toBe(3);
 expect(pickNativeLoadedCar([car(402,3,{references:3})],{normalOnly:false,notTooMany:false},()=>0)).toBe(402);
});
test.each(['suppressed','scriptBlocked','phasingOut'] as const)('blocked flag %s consumes exactly ten attempts',flag=>{
 let calls=0;expect(pickNativeLoadedCar([car(400,1,{[flag]:true})],policy,()=>{calls++;return 0;})).toBe(-1);expect(calls).toBe(10);
});
test('empty or class-excluded groups do not consume RNG; invalid states are rejected',()=>{
 const draw=()=>{throw Error('RNG unexpectedly consumed');};expect(pickNativeLoadedCar([],policy,draw)).toBe(-1);expect(pickNativeLoadedCar([car(400,10,{vehicleClass:'worker'})],policy,draw)).toBe(-1);
 expect(()=>pickNativeLoadedCar([car(400,0)],policy,draw)).toThrow('positive frequency');expect(()=>pickNativeLoadedCar([car(400,1)],policy,()=>1)).toThrow('range');expect(()=>pickNativeLoadedCar(Array(24).fill(car(400,1)),policy,draw)).toThrow('23 slots');
});
