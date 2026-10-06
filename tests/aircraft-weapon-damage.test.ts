import {expect,test} from 'vitest';
import {WorldPlane,aircraftWeaponDamageScale} from '../src/simulation/WorldPlane';
import {firesExplodesOrShoots} from '../src/simulation/carDamageHost';

// CVehicle::InflictDamage (iOS 0x1004781b4): helis and planes take 40% from everything but heavy explosives.
test('an aircraft takes 0.4 of a weapon round and the full blast',()=>{
 const f=Math.fround(.4);
 for(const weapon of [0,18,22,24,31,37,38,52])expect(aircraftWeaponDamageScale(520,weapon)).toBe(f);
 for(const weapon of [16,19,20,51])expect(aircraftWeaponDamageScale(497,weapon)).toBe(1);
 // The RC Baron, Raider and Goblin are bIsRCVehicle.
 for(const model of [464,465,501])expect(aircraftWeaponDamageScale(model,31)).toBe(1);
});

test('WorldPlane.damage scales only weapon damage',()=>{
 const plane=(health:number,extra:object={})=>({health,modelId:497,throttle:1,occupied:false,bombTimerMs:0,gone:false,destroyed(){this.gone=true;},...extra} as any);
 const damage=(target:any,amount:number,weapon?:number,byPlayer?:boolean)=>(WorldPlane.prototype as any).damage.call(target,amount,weapon,byPlayer);
 const shot=plane(1000);expect(damage(shot,100,31)).toBe(false);expect(shot.health).toBeCloseTo(1000-100*Math.fround(.4),4);
 const blasted=plane(1000);damage(blasted,100,51);expect(blasted.health).toBe(900);
 // BlowUpCar and the pilot-seat kill come without a weapon and take what they are given.
 const wrecked=plane(500);expect(damage(wrecked,500)).toBe(true);expect(wrecked.health).toBe(0);expect(wrecked.gone).toBe(true);
 // A blast that destroys it leaves it on the bomb timer: it goes up 1 to 3 s later, with whoever is aboard.
 const blown=plane(300);expect(damage(blown,400,51)).toBe(true);expect(blown.gone).toBe(false);
 expect(blown.bombTimerMs).toBeGreaterThanOrEqual(1000);expect(blown.bombTimerMs).toBeLessThanOrEqual(3047);
 const downed=plane(10);expect(damage(downed,100,31)).toBe(true);expect(downed.gone).toBe(true);expect(downed.bombTimerMs).toBe(0);
});

test('the player\'s own aircraft: 0.95 before the 0.4, and nothing from rounds or blasts once burning',()=>{
 const plane=(health:number)=>({health,modelId:497,throttle:1,occupied:true,bombTimerMs:0,destroyed(){}} as any);
 const damage=(target:any,amount:number,weapon:number)=>(WorldPlane.prototype as any).damage.call(target,amount,weapon,false);
 const mine=plane(1000);damage(mine,100,31);expect(mine.health).toBeCloseTo(1000-100*.95*Math.fround(.4),4);
 const burning=plane(200);damage(burning,100,31);damage(burning,100,51);damage(burning,100,18);expect(burning.health).toBe(200);
 // The flamethrower is not flagged.
 damage(burning,100,37);expect(burning.health).toBeCloseTo(200-100*.95*Math.fround(.4),4);
});

test('CanPhysicalBeDamaged flags the explosives, the molotov and the guns, not the flamethrower or melee',()=>{
 const flagged=[...Array(60).keys()].filter(firesExplodesOrShoots);
 expect(flagged).toEqual([16,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,38,39,40,51,52]);
});
