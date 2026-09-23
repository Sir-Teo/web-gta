import {expect,test} from 'vitest';
import {NativeVehicleForces} from '../src/simulation/NativeVehicleForces';

const car=()=>{const c:any=Object.create(NativeVehicleForces.prototype);c.handling={values:{handlingFlags:0}};c.tireTemperature=1;c.nitroBoosts=0;return c;};
const run=(c:any,pad:{fire:boolean;looking:boolean}|undefined,gas=0,physics=false)=>c.nitrousControl(0,1,gas,pad,physics);

test('CAutomobile::NitrousControl: a full tank fires on the car-gun button, burns 1000 steps, then refills',()=>{
 const c=car();c.nitrousControl(3,1,0,undefined,false);
 expect(c.nitroInstalled).toBe(true);expect(c.nitroBoosts).toBe(3);
 // Not while looking about, and not without the button.
 run(c,{fire:true,looking:true});run(c,{fire:false,looking:false});expect(c.nitroBurning).toBe(false);
 run(c,{fire:true,looking:false});expect(c.nitroBurning).toBe(true);expect(c.nitroBoosts).toBe(2);
 let steps=0;while(c.nitroBurning&&steps<2000){run(c,{fire:true,looking:false});steps++;}
 expect(steps).toBeGreaterThanOrEqual(999);expect(steps).toBeLessThanOrEqual(1001);
 // Refilling at a quarter of a hundredth a step with the gas down: about 400 steps, then it can fire again.
 steps=0;while(c.tireTemperature<1&&steps<1000){run(c,{fire:false,looking:false},1);steps++;}
 expect(steps).toBeGreaterThan(390);expect(steps).toBeLessThan(410);
});

test('the fitting goes with the last shot, endless nitro never runs out, and a car the game drives fires on its own',()=>{
 const c=car();c.nitrousControl(1,1,0,undefined,false);run(c,{fire:true,looking:false});
 for(let i=0;i<1100;i++)run(c,undefined);
 expect(c.nitroInstalled).toBe(false);expect(c.tireTemperature).toBe(1);
 const endless=car();endless.fitEndlessNitro();run(endless,{fire:true,looking:false});expect(endless.nitroBoosts).toBe(101);expect(endless.nitroBurning).toBe(true);
 const ai=car();ai.fitEndlessNitro();run(ai,undefined,0,true);expect(ai.nitroBurning).toBe(true);
 const parked=car();parked.fitEndlessNitro();run(parked,undefined,0,false);expect(parked.nitroBurning).toBe(false);
});
