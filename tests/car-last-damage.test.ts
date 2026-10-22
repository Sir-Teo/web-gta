import {describe,expect,test} from 'vitest';
import {WorldCar} from '../src/simulation/WorldCar';
import {carDamageHost} from '../src/simulation/carDamageHost';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {checkDamagedWeaponType} from '../src/engine/ScmGameCommands';
import {scmOpcode} from '../src/engine/scmOpcodes';

const car=(extra:object={})=>({wrecked:false,canBeDamaged:true,occupied:false,health:1000,lastWeaponDamage:-1,blowUp(){this.wrecked=true;},...extra} as any);
const damage=(target:any,amount:number,explosive=false,options:object={})=>(WorldCar.prototype as any).damage.call(target,amount,undefined,explosive,undefined,options);

function ask(opcode:number,ints:number[],world:Partial<ScmWorldCommands>){
 const out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const value of ints){const bytes=new Uint8Array(4);new DataView(bytes.buffer).setInt32(0,value,true);out.push(1,...bytes);}
 const space=new Uint8Array(128);space.set(out,0);
 const host:ScmThreadHost={startScript(){},game:new ScmGameState(),world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,0,0,undefined,host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread.condition;
}

describe('who last damaged a car, and with what',()=>{
 test('InflictDamage keeps the weapon and the damager while the car has health',()=>{
  const target=car(),shooter={};
  damage(target,20,false,{weapon:22,by:{ped:shooter}});
  expect(target.lastWeaponDamage).toBe(22);expect(target.lastDamagedBy).toEqual({ped:shooter});
  // The player's harm is his own ped's; a blast is WEAPON_EXPLOSION and a fire WEAPON_FLAMETHROWER.
  damage(target,20,true,{byPlayer:true});
  expect(target.lastWeaponDamage).toBe(51);expect(target.lastDamagedBy).toEqual({player:true});
  damage(target,5,false,{kind:'fire'});
  // A native null source keeps the previous reference; a known other shooter replaces it.
  expect(target.lastWeaponDamage).toBe(37);expect(target.lastDamagedBy).toEqual({player:true});
  damage(target,5,false,{kind:'fire',byPlayer:false});expect(target.lastDamagedBy).toBeUndefined();
 });

 test('a car that refuses the damage keeps what it had',()=>{
  const proof=car({proofs:{bullet:true,explosion:false}});
  damage(proof,20,false,{weapon:31,by:{player:true}});
  expect(proof.lastWeaponDamage).toBe(-1);expect(proof.lastDamagedBy).toBeUndefined();
  // Only the player may hurt a bInvulnerable car.
  const guarded=car({onlyDamagedByPlayer:true});
  damage(guarded,20,false,{weapon:31,by:{ped:{}},byPlayer:false});
  expect(guarded.lastWeaponDamage).toBe(-1);
 });

 test('a blast that destroys a car arms the bomb timer; any other weapon blows it up at once',()=>{
  // CVehicle::InflictDamage (iOS 0x1004781b4): WEAPON_EXPLOSION sets m_wBombTimer to (rand() & 0x7FF) + 1000 and
  // m_pWhoDetonatedMe, and ProcessDelayedExplosion blows the car up when it runs out.
  for(let i=0;i<50;i++){
   const blasted=car({bombTimerMs:0,bombDetonatedByPlayer:false});
   expect(damage(blasted,1500,true,{byPlayer:true})).toBe(true);
   expect(blasted.wrecked).toBe(false);expect(blasted.health).toBe(0);
   expect(blasted.bombTimerMs).toBeGreaterThanOrEqual(1000);expect(blasted.bombTimerMs).toBeLessThanOrEqual(3047);
   expect(blasted.bombDetonatedByPlayer).toBe(true);
  }
  const shot=car();
  expect(damage(shot,1000,false,{weapon:31})).toBe(true);expect(shot.wrecked).toBe(true);
  // Health left survives: InflictDamage subtracts only while old health exceeds the damage.
  const scraped=car();expect(damage(scraped,999.5,false,{weapon:31})).toBe(false);expect(scraped.health).toBeCloseTo(.5,6);
  // A car already at 0, burning or counting down, takes nothing more and is not blown up early.
  const waiting=car({health:0,bombTimerMs:1500});
  expect(damage(waiting,100,false,{weapon:31})).toBe(false);
  expect(waiting.wrecked).toBe(false);expect(waiting.bombTimerMs).toBe(1500);
 });

 test('the player car takes 0.95 of the damage, and a quarter of that while strap3 heads the script list',()=>{
  const was=carDamageHost.headScriptName;
  try{
   const mine=car({occupied:true});damage(mine,100,false,{weapon:22});expect(mine.health).toBeCloseTo(905,6);
   // SCRIPT_NAME lowercases on iOS; the port keeps the label as written and compares case-blind.
   carDamageHost.headScriptName=()=>'STRAP3';
   const strap=car({occupied:true});damage(strap,100,false,{weapon:22});expect(strap.health).toBeCloseTo(1000-23.75,6);
   // Only the player's own car, and only while strap3 is the head.
   const other=car();damage(other,100,false,{weapon:22});expect(other.health).toBe(900);
   carDamageHost.headScriptName=()=>'strap3x';
   const notStrap=car({occupied:true});damage(notStrap,100,false,{weapon:22});expect(notStrap.health).toBeCloseTo(905,6);
  }finally{carDamageHost.headScriptName=was;}
 });

 test('the player harming a law enforcer gives him a star, his own stolen cop car aside',()=>{
  const was=WorldCar.onPlayerDamagedLaw;let stars=0;WorldCar.onPlayerDamagedLaw=()=>{stars++;};
  try{
   damage(car({modelId:596,abandoned:false}),20,false,{weapon:22,byPlayer:true});expect(stars).toBe(1);
   // Even with no health left to take, and from a blast.
   damage(car({modelId:596,abandoned:false,health:0}),20,true,{byPlayer:true});expect(stars).toBe(2);
   // Not another shooter's round, not a civilian car, not an empty or player-driven cop car.
   damage(car({modelId:596,abandoned:false}),20,false,{weapon:22,by:{ped:{}}});
   damage(car({modelId:400,abandoned:false}),20,false,{weapon:22,byPlayer:true});
   damage(car({modelId:596,abandoned:true}),20,false,{weapon:22,byPlayer:true});
   damage(car({modelId:596,abandoned:false,occupied:true}),20,false,{weapon:22,byPlayer:true});
   expect(stars).toBe(2);
  }finally{WorldCar.onPlayerDamagedLaw=was;}
 });

 test('more than 10 of the player\'s harm adds 5 to 24 dollars of property damage',()=>{
  const was=carDamageHost.addPropertyDamage;const added:number[]=[];carDamageHost.addPropertyDamage=d=>{added.push(d);};
  try{
   for(let i=0;i<40;i++)damage(car(),11,false,{weapon:22,byPlayer:true});
   expect(added.length).toBe(40);expect(Math.min(...added)).toBeGreaterThanOrEqual(5);expect(Math.max(...added)).toBeLessThanOrEqual(24);
   // 10 or less, another shooter's, or 0.95 of 10.5 in the player's own car: nothing.
   damage(car(),10,false,{weapon:22,byPlayer:true});damage(car(),50,false,{weapon:22,by:{ped:{}}});
   damage(car({occupied:true}),10.5,false,{weapon:22,byPlayer:true});
   expect(added.length).toBe(40);
  }finally{carDamageHost.addPropertyDamage=was;}
 });

 test('CDarkel::CheckDamagedWeaponType sorts the two wildcards',()=>{
  expect(checkDamagedWeaponType(-1,57)).toBe(false);
  expect(checkDamagedWeaponType(15,56)).toBe(true);expect(checkDamagedWeaponType(16,56)).toBe(false);
  for(const weapon of [0,16,22,38,45,51,52])expect(checkDamagedWeaponType(weapon,57)).toBe(true);
  // The parachute, a ram, a run over, drowning and a fall are no weapon.
  for(const weapon of [46,49,50,53,54])expect(checkDamagedWeaponType(weapon,57)).toBe(false);
  expect(checkDamagedWeaponType(22,22)).toBe(false);
 });

 test('HAS_CAR_BEEN_DAMAGED_BY_WEAPON takes a wildcard through the check and any other type as it is',()=>{
  const op=scmOpcode('HAS_CAR_BEEN_DAMAGED_BY_WEAPON');
  const world=(last:number)=>({vehicleLastWeaponDamage:()=>last});
  expect(ask(op,[5,49],world(49))).toBe(true);
  expect(ask(op,[5,57],world(49))).toBe(false);
  expect(ask(op,[5,56],world(8))).toBe(true);
  expect(ask(op,[5,57],world(31))).toBe(true);
  // A car nothing has hurt matches no type.
  expect(ask(op,[5,-1],world(-1))).toBe(false);
 });
});

describe('CEventVehicleDamageWeapon from InflictDamage',()=>{
 test('a ped\'s weapon harm the car survives tells its driver; a kill, another cause or an empty car does not',()=>{
  const was=WorldCar.prototype.onWeaponDamage;const heard:string[]=[];
  const driven=(extra:object={})=>car({autopilot:{},driverOut:false,onWeaponDamage:(s:string)=>heard.push(s),...extra});
  damage(driven(),20,false,{weapon:22,byPlayer:true});
  damage(driven(),20,false,{weapon:31,by:{ped:{}}});
  expect(heard).toEqual(['player','ped']);
  damage(driven(),2000,false,{weapon:31,byPlayer:true});
  damage(driven(),20,false,{kind:'fire'});
  damage(driven({autopilot:undefined}),20,false,{weapon:22,byPlayer:true});
  damage(driven({driverOut:true}),20,false,{weapon:22,byPlayer:true});
  expect(heard).toEqual(['player','ped']);
  expect(was).toBeUndefined();
 });
});
