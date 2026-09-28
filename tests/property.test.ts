import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Scene} from 'three';
import {Simulation} from '../src/simulation/Simulation';
import {WorldPickups,linkRevenue} from '../src/simulation/WorldPickups';
import type {ScmPickup} from '../src/assets/scmPickups';

beforeAll(async()=>{await RAPIER.init();});

const disc=(over:Partial<ScmPickup>&{position:[number,number,number]}):ScmPickup=>({
 id:`test:${over.position.join(',')}`,command:'CREATE_PICKUP',section:'INITIAL',offset:0,modelId:1273,
 model:'property_fsale',dictionary:'property_fsale',type:3,category:'propertyForSale',ammo:0,...over,
});
const at=(pickup:ScmPickup)=>({x:pickup.position[0],y:pickup.position[2],z:-pickup.position[1]});

function setup(collected=new Set<string>(),onMission=()=>false){
 const sim=new Simulation(),scene=new Scene(),messages:string[]=[];
 const pickups=new WorldPickups(sim,scene,'property-test:',{
  weaponForModel:()=>undefined,giveWeapon:()=>false,wantedLevel:()=>0,setWantedLevel:()=>{},
  armour:()=>0,setArmour:()=>{},onSave:()=>{},onCollect:(_p,message)=>{if(message)messages.push(message);},onNotice:(_p,text)=>messages.push(text),onMission,
 },collected);
 return {sim,pickups,messages};
}

test('asset revenue links to its nearest for-sale property',()=>{
 const revenue:ScmPickup=disc({category:'revenue',model:'bigdollar',dictionary:'bigdollar',position:[0,0,0],revenueLimit:10000,revenueRate:60});
 const near=disc({position:[100,0,0],price:10000}),far=disc({position:[300,0,0],price:30000});
 expect(linkRevenue(revenue,[near,far])?.position).toEqual(near.position);
 expect(linkRevenue(revenue,[disc({position:[900,0,0],price:1})])).toBeUndefined();
});

test('properties buy with cash, refuse without, and persist as owned',()=>{
 const sale=disc({position:[10,20,5],price:30000});
 const {sim,pickups,messages}=setup();
 try{
  pickups.setPickups([sale]);
  sim.money=1000;sim.player.position=at(sale);sim.player.health=100;
  pickups.step(1/60);
  expect(sim.money).toBe(1000);expect(messages).toEqual(['Not enough cash · $30000']);
  sim.money=50000;pickups.step(1/60);
  expect(sim.money).toBe(20000);expect(messages.at(-1)).toBe('Property purchased · -$30000');
  expect(pickups.snapshot().active).toBe(0);
  // Owned properties stay collected across sessions.
  const second=setup(pickups.collected);
  try{
   second.pickups.setPickups([sale]);
   expect(second.pickups.snapshot().active).toBe(0);
  }finally{second.pickups.dispose();second.sim.dispose();}
 }finally{pickups.dispose();sim.dispose();}
});

// CPickup::Update's PICKUP_PROPERTY_FORSALE: on a mission the player is told PROP_2 and nothing is bought, however
// much cash he has.
test('a property is not for sale during a mission',()=>{
 const sale=disc({position:[10,20,5],price:30000});
 let onMission=true;
 const {sim,pickups,messages}=setup(new Set(),()=>onMission);
 try{
  pickups.setPickups([sale]);
  sim.money=50000;sim.player.position=at(sale);sim.player.health=100;
  pickups.step(1/60);
  expect(sim.money).toBe(50000);expect(messages).toHaveLength(1);expect(messages[0]).not.toContain('purchased');
  expect(pickups.snapshot().active).toBe(1);
  onMission=false;pickups.passTime(4);pickups.step(1/60);
  expect(sim.money).toBe(20000);
 }finally{pickups.dispose();sim.dispose();}
});

test('revenue accrues only for owned assets and pays out on touch',()=>{
 const sale=disc({id:'test:prop',position:[10,20,5],price:10000});
 const till:ScmPickup=disc({id:'test:till',category:'revenue',model:'bigdollar',dictionary:'bigdollar',position:[11,21,5],revenueLimit:500,revenueRate:100});
 const {sim,pickups,messages}=setup();
 try{
  pickups.setPickups([sale,till]);
  sim.player.position=at(till);sim.player.health=100;
  sim.timeMinutes=600;pickups.step(1/60);pickups.step(1/60);
  expect(messages).toEqual([]);
  // Buying starts the accrual clock without backpay.
  sim.money=50000;sim.player.position=at(sale);pickups.step(1/60);
  expect(pickups.collected.has('test:prop')).toBe(true);
  // CPickup::Update: a day's takings (100) every 1,440,000 ms of play, only while the player is over 10 units off.
  sim.player.position={x:sim.player.position.x+40,y:sim.player.position.y,z:sim.player.position.z};pickups.step(720);
  // Standing by the till earns nothing.
  sim.player.position=at(till);sim.timeMinutes=900;
  pickups.step(1/60);
  // Collecting pays with no text, and a touch under the $10 minimum is refused silently.
  const shown=messages.length;
  expect(sim.money).toBe(40000+50);
  pickups.step(1/60);pickups.step(1/60);pickups.step(1/60);
  expect(sim.money).toBe(40000+50);expect(messages.slice(shown).filter(m=>/revenue/i.test(m))).toEqual([]);
 }finally{pickups.dispose();sim.dispose();}
});

// CREATE_PROTECTION_PICKUP makes its PICKUP_ASSET_REVENUE once the script has sold the asset, and CPickup::Update
// accrues and pays every such pickup, whatever for-sale discs are about. UPDATE_PICKUP_MONEY_PER_DAY takes effect.
test('a script revenue pickup earns without a new-game property beside it',()=>{
 const {sim,pickups}=setup();
 try{
  pickups.setPickups([]);
  const till:ScmPickup=disc({id:'script:7',section:'script',category:'revenue',model:'bigdollar',dictionary:'bigdollar',position:[11,21,5],revenueLimit:500,revenueRate:100});
  pickups.generate(till,Number.POSITIVE_INFINITY);
  pickups.patchGenerated('script:7',{revenueRate:200});
  sim.money=0;sim.player.health=100;sim.player.position={x:at(till).x+40,y:at(till).y,z:at(till).z};pickups.step(720);
  sim.player.position=at(till);pickups.step(1/60);
  expect(sim.money).toBe(100);
 }finally{pickups.dispose();sim.dispose();}
});

test('a money pickup pays its amount, a keycard is simply taken, and health fills to the raised maximum (CPickup::Update)',()=>{
 const cash=disc({id:'test:cash',category:'money',model:'money',dictionary:'money',type:3,ammo:250,position:[50,0,5]});
 const card=disc({id:'test:card',category:'keycard',model:'keycard',dictionary:'keycard',type:3,position:[80,0,5]});
 const heart=disc({id:'test:heart',category:'health',model:'health',dictionary:'health',type:3,position:[110,0,5]});
 const {sim,pickups}=setup();
 try{
  (pickups as any).host.maxHealth=()=>150;
  pickups.setPickups([cash,card,heart]);
  sim.money=0;sim.player.health=100;
  sim.player.position=at(cash);pickups.step(1/60);expect(sim.money).toBe(250);
  sim.player.position=at(card);pickups.step(1/60);expect(pickups.collected.has('test:card')).toBe(true);
  sim.player.position=at(heart);pickups.step(1/60);expect(sim.player.health).toBe(150);
 }finally{pickups.dispose();sim.dispose();}
});
