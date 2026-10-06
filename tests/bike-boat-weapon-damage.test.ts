import {expect,test} from 'vitest';
import {WorldBike} from '../src/simulation/WorldBike';
import {WorldBoat} from '../src/simulation/WorldBoat';
import {carDamageHost} from '../src/simulation/carDamageHost';
import {stepBombTimer} from '../src/vehicle/nativeCarBomb';

// CVehicle::InflictDamage (iOS 0x1004781b4) is every vehicle's: bikes and boats take weapon damage as cars do.
for(const [name,Vehicle] of [['bike',WorldBike],['boat',WorldBoat]] as const){
 const vehicle=(extra:object={})=>({wrecked:false,occupied:false,health:1000,bombTimerMs:0,blowUp(){this.wrecked=true;},...extra} as any);
 const damage=(target:any,amount:number,explosive=false,options:object={})=>(Vehicle.prototype as any).damage.call(target,amount,undefined,explosive,undefined,options);
 test(`a ${name}: health left only, a blast's victim on the bomb timer, anything else at once`,()=>{
  const shot=vehicle();expect(damage(shot,400,false,{weapon:31})).toBe(false);expect(shot.health).toBe(600);
  expect(damage(shot,600,false,{weapon:31})).toBe(true);expect(shot.wrecked).toBe(true);
  const blasted=vehicle();expect(damage(blasted,1100,true)).toBe(true);
  expect(blasted.wrecked).toBe(false);expect(blasted.bombTimerMs).toBeGreaterThanOrEqual(1000);expect(blasted.bombTimerMs).toBeLessThanOrEqual(3047);
  // ProcessDelayedExplosion counts it down at 16 ms a 50 Hz frame.
  const timer={bombTimerMs:1600};let frames=1;while(!stepBombTimer(timer,1))frames++;expect(frames).toBe(100);
  const waiting=vehicle({health:0,bombTimerMs:1200});expect(damage(waiting,50,false,{weapon:31})).toBe(false);expect(waiting.wrecked).toBe(false);
 });
 test(`the player's own ${name}: 0.95 of it, and no blasts or rounds once burning`,()=>{
  const was=carDamageHost.addPropertyDamage;let stat=0;carDamageHost.addPropertyDamage=d=>{stat+=d;};
  try{
   const mine=vehicle({occupied:true});damage(mine,100,false,{weapon:22,byPlayer:true});expect(mine.health).toBeCloseTo(905,6);
   expect(stat).toBeGreaterThanOrEqual(5);
   const burning=vehicle({occupied:true,health:200});
   expect(damage(burning,100,true)).toBe(false);damage(burning,100,false,{weapon:22});damage(burning,100,false,{kind:'fire',weapon:18});
   expect(burning.health).toBe(200);
   // The flamethrower is not flagged as fire, explosion or bullet.
   damage(burning,100,false,{kind:'fire',weapon:37});expect(burning.health).toBeCloseTo(105,6);
  }finally{carDamageHost.addPropertyDamage=was;}
 });
}
