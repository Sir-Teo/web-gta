import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Scene} from 'three';
import {Simulation} from '../src/simulation/Simulation';
import {STAT,WorldPickups} from '../src/simulation/WorldPickups';
import type {ScmPickup} from '../src/assets/scmPickups';

// CPickup::Update's weapon branch: a weapon whose slot holds another one (with ammo, or a shotgun, SMG or rifle slot)
// waits for the collect press (CollectPickupBuffer, six frames of CPad::CollectPickupJustDown), showing PU_CF1 once; an
// exchangeable slot's weapon takes the pickup's ammo at once (ExtractAmmoFromPickup) and the pickup is left empty.
const gun=(over:Partial<ScmPickup>):ScmPickup=>({id:`test:${over.model}`,command:'CREATE_PICKUP',section:'INITIAL',offset:0,modelId:346,
 model:'colt45',dictionary:'colt45',type:2,category:'weapon',ammo:0,position:[10,20,5],...over});
const at=(p:ScmPickup)=>({x:p.position[0],y:p.position[2],z:-p.position[1]});
beforeAll(async()=>{await RAPIER.init();});
const WEAPON:Record<string,{id:number;slot:number}>={colt45:{id:22,slot:2},sawnoff:{id:26,slot:3}};
function setup(held:{weapon:number;ammo:number}){
 const sim=new Simulation(),scene=new Scene(),given:[number,number][]=[],granted:[number,number][]=[],notices:string[]=[];let targeting=false;
 const pickups=new WorldPickups(sim,scene,'collect-test:',{
  weaponForModel:model=>WEAPON[model]?.id,giveWeapon:(w,a)=>{given.push([w,a]);return true;},wantedLevel:()=>0,setWantedLevel(){},armour:()=>0,setArmour(){},
  heldInSlot:w=>({...held,slot:w===26?3:2}),grantAmmo:(w,a)=>{granted.push([w,a]);},targeting:()=>targeting,onNotice:(_p,text)=>notices.push(text),
 });
 return {sim,pickups,given,granted,notices,aim:(on:boolean)=>{targeting=on;}};
}
test('unarmed, a weapon is taken at once',()=>{
 const pistol=gun({});const {sim,pickups,given}=setup({weapon:0,ammo:0});
 try{pickups.setPickups([pistol]);sim.player.position=at(pistol);sim.player.health=100;pickups.step(1/60);
  expect(given).toEqual([[22,AMMO(22)]]);}finally{pickups.dispose();sim.dispose();}
});
test('over another loaded weapon of the slot the pickup waits for the collect press, which lasts six frames',()=>{
 const pistol=gun({});const {sim,pickups,given,notices}=setup({weapon:24,ammo:7});
 try{pickups.setPickups([pistol]);sim.player.position=at(pistol);sim.player.health=100;
  for(let i=0;i<5;i++)pickups.step(1/60);
  expect(given).toEqual([]);expect(notices).toEqual(['Press TAB to collect the weapon.']);
  expect(pickups.playerOnWeaponPickup).toBe(6);
  // The press taken while standing on it.
  pickups.collectJustDown();pickups.step(1/60);
  expect(given).toEqual([[22,AMMO(22)]]);
 }finally{pickups.dispose();sim.dispose();}
});
test('the collect press runs out after six frames, and aiming clears it and hides the help',()=>{
 const pistol=gun({position:[30,20,5]});const {sim,pickups,given,notices,aim}=setup({weapon:24,ammo:7});
 try{pickups.setPickups([pistol]);sim.player.health=100;sim.player.position={x:0,y:5,z:0};
  pickups.collectJustDown();for(let i=0;i<7;i++)pickups.step(1/60);
  // Aiming from here: no help (GetTarget), and the press is cleared before it can take the weapon.
  aim(true);sim.player.position=at(pistol);pickups.step(1/60);
  expect(given).toEqual([]);
  pickups.collectJustDown();pickups.step(1/60);
  expect(given).toEqual([]);expect(notices).toEqual([]);
 }finally{pickups.dispose();sim.dispose();}
});
test('an exchangeable slot takes the ammo out of the pickup at once and the weapon comes empty on the press',()=>{
 const sawnoff=gun({model:'sawnoff',dictionary:'sawnoff',modelId:350,ammo:10,type:3});const {sim,pickups,given,granted}=setup({weapon:25,ammo:0});
 try{pickups.setPickups([sawnoff]);sim.player.position=at(sawnoff);sim.player.health=100;
  pickups.step(1/60);pickups.step(1/60);
  expect(granted).toEqual([[26,10]]);expect(given).toEqual([]);
  pickups.collectJustDown();pickups.step(1/60);
  expect(given).toEqual([[26,0]]);
 }finally{pickups.dispose();sim.dispose();}
});
function AMMO(weapon:number){return [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,8,8,8,8,4,4,30,10,10,15,10,10,60,60,80,80,60,20,10,4,3,100,500,5,1,500,500,36,0,0,1][weapon];}
// CPickups::PickedUpHorseShoe and GivePlayerGoodiesWithPickUpMI's bribe: the stats they count.
test('a horseshoe counts STAT_HORSESHOES_COLLECTED and 1000 over the total as luck; a bribe counts STAT_NUMBER_OF_POLICE_BRIBES',()=>{
 const sim=new Simulation(),scene=new Scene(),stats:[number,number][]=[];let wanted=2;
 const pickups=new WorldPickups(sim,scene,'stat-test:',{
  weaponForModel:()=>undefined,giveWeapon:()=>true,wantedLevel:()=>wanted,setWantedLevel(level){wanted=level;},armour:()=>0,setArmour(){},
  incrementStat:(stat,value)=>{stats.push([stat,+value.toFixed(4)]);},statValue:stat=>stat===STAT.totalHorseshoes?50:0,
 });
 const shoe=gun({id:'shoe',model:'horseshoe',dictionary:'horseshoe',modelId:954,category:'horseshoe',type:1,position:[10,20,5]});
 const bribe=gun({id:'bribe',model:'bribe',dictionary:'bribe',modelId:1240,category:'bribe',type:1,position:[40,20,5]});
 try{pickups.setPickups([shoe,bribe]);sim.player.health=100;
  sim.player.position=at(shoe);pickups.step(1/60);
  expect(stats).toEqual([[STAT.horseshoesCollected,1],[STAT.luck,20]]);expect(sim.money).toBe(100100);// the lone shoe is the whole set
  sim.player.position=at(bribe);pickups.step(1/60);
  expect(stats[2]).toEqual([STAT.policeBribes,1]);expect(wanted).toBe(1);
 }finally{pickups.dispose();sim.dispose();}
});
