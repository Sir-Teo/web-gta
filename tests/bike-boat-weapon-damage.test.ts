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
 test(`a ${name} carried out of range still goes up on its bomb timer`,()=>{
  let blown=0;
  const far=vehicle({bombTimerMs:32,frozen:false,distance:()=>400,collisionLoaded:()=>true,body:{setEnabled(){}},root:{visible:true},blowUp(this:any){blown++;this.wrecked=true;}});
  const step=()=>(Vehicle.prototype as any).beforeStep.call(far,1/50);
  step();expect(blown).toBe(0);expect(far.bombTimerMs).toBe(16);
  step();expect(blown).toBe(1);
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

// CBoat::ProcessControl's collision power, mass × Δv × fCollisionDamageMultiplier: over 25 it hurts a hull at 250 or
// more; the player's own takes iOS ScalePlayerVehicleDamage (0.95, 0.42 at 100%, a quarter in strap3) before the half.
test('a boat\'s collision power: the player\'s own scaled by 0.95 before the half',()=>{
 const was={full:carDamageHost.fullCompletion,head:carDamageHost.headScriptName};
 const hull=(occupied:boolean)=>({wrecked:false,occupied,health:1000,stepVelocity:{x:0,y:0,z:0},
  body:{isEnabled:()=>true,linvel:()=>({x:0,y:0,z:-50}),numColliders:()=>0},handling:{values:{mass:100,collisionDamageMultiplier:1}},sim:{world:{}}} as any);
 const hit=(target:any)=>{(WorldBoat.prototype as any).collisionDamage.call(target);return target.health;};
 try{
  // Power 100 × 1 × 1 = 100.
  expect(hit(hull(false))).toBeCloseTo(1000-(100-25)/4,6);
  expect(hit(hull(true))).toBeCloseTo(1000-(95-25)/2,6);
  carDamageHost.fullCompletion=()=>true;expect(hit(hull(true))).toBeCloseTo(1000-(42-25)/2,6);
  carDamageHost.fullCompletion=()=>false;carDamageHost.headScriptName=()=>'strap3';
  // A quarter of 0.95: 23.75, under the 25 the power is tested against before scaling, so the hull gains health.
  expect(hit(hull(true))).toBeCloseTo(1000-(23.75-25)/2,6);
 }finally{carDamageHost.fullCompletion=was.full;carDamageHost.headScriptName=was.head;}
});
