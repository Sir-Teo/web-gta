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

function setup(collected=new Set<string>()){
 const sim=new Simulation(),scene=new Scene(),messages:string[]=[];
 const pickups=new WorldPickups(sim,scene,'property-test:',{
  weaponForModel:()=>undefined,giveWeapon:()=>false,wantedLevel:()=>0,setWantedLevel:()=>{},
  armour:()=>0,setArmour:()=>{},onSave:()=>{},onCollect:(_p,message)=>{if(message)messages.push(message);},
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
  sim.timeMinutes=720;pickups.step(1/60);
  sim.player.position=at(till);pickups.step(1/60);
  expect(sim.money).toBe(40000+200);expect(messages.at(-1)).toBe('Asset revenue · +$200');
  // A second touch with nothing accrued stays quiet after one notice.
  pickups.step(1/60);pickups.step(1/60);pickups.step(1/60);
  expect(messages.filter(m=>m==='No revenue yet.')).toHaveLength(1);
 }finally{pickups.dispose();sim.dispose();}
});
