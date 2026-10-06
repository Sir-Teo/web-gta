import {expect,test} from 'vitest';
import {WorldPlane,aircraftWeaponDamageScale} from '../src/simulation/WorldPlane';

// CVehicle::InflictDamage (iOS 0x1004781b4): helis and planes take 40% from everything but heavy explosives.
test('an aircraft takes 0.4 of a weapon round and the full blast',()=>{
 const f=Math.fround(.4);
 for(const weapon of [0,18,22,24,31,37,38,52])expect(aircraftWeaponDamageScale(520,weapon)).toBe(f);
 for(const weapon of [16,19,20,51])expect(aircraftWeaponDamageScale(497,weapon)).toBe(1);
 // The RC Baron, Raider and Goblin are bIsRCVehicle.
 for(const model of [464,465,501])expect(aircraftWeaponDamageScale(model,31)).toBe(1);
});

test('WorldPlane.damage scales only weapon damage',()=>{
 const plane=(health:number)=>({health,modelId:497,throttle:1,occupied:false} as any);
 const damage=(target:any,amount:number,weapon?:number)=>(WorldPlane.prototype as any).damage.call(target,amount,weapon);
 const shot=plane(1000);expect(damage(shot,100,31)).toBe(false);expect(shot.health).toBeCloseTo(1000-100*Math.fround(.4),4);
 const blasted=plane(1000);damage(blasted,100,51);expect(blasted.health).toBe(900);
 // BlowUpCar and the pilot-seat kill come without a weapon and take what they are given.
 const wrecked=plane(500);expect(damage(wrecked,500)).toBe(true);expect(wrecked.health).toBe(0);
});
