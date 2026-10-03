import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Scene} from 'three';
import {Simulation} from '../src/simulation/Simulation';
import {WorldPickups,PICKUP_SLOTS} from '../src/simulation/WorldPickups';
import type {ScmPickup} from '../src/assets/scmPickups';

beforeAll(async()=>{await RAPIER.init();});
const money=(slot:number,position:[number,number,number]):ScmPickup=>({id:`money:${slot}`,command:'CREATE_PICKUP',section:'INITIAL',offset:slot,modelId:1212,
 model:'money',dictionary:'money',type:3,category:'money',ammo:10,position});
const at=(pickup:ScmPickup)=>({x:pickup.position[0],y:pickup.position[2],z:-pickup.position[1]});

test('CPickups::Update streams a thirty-second of the slots and collects a sixth of them each game frame, visible ones only',()=>{
 const sim=new Simulation(),pickups=new WorldPickups(sim,new Scene(),'slices-test:',{weaponForModel:()=>undefined,giveWeapon:()=>false,wantedLevel:()=>0,setWantedLevel:()=>{},armour:()=>0,setArmour:()=>{}});
 try{
  // Slot 0 by the player, slot 300 far from the camera.
  const near=money(0,[5,5,0]),far=money(300,[500,0,0]);
  pickups.setPickups([near,...Array.from({length:299},(_,i)=>money(i+1,[2000+i,2000,0])),far]);
  sim.player.position=at(near);sim.player.health=100;sim.money=0;
  pickups.render({x:5,y:1,z:-5},0);
  // Frame 1 streams slots 19-37 and collects slots 103-205: slot 0 is neither seen nor reached.
  pickups.step(1/60,undefined,1);expect(sim.money).toBe(0);
  // Frames up to 31 never stream slot 0 again, so nothing is visible to collect there.
  for(let f=2;f<32;f++)pickups.step(1/60,undefined,f);expect(sim.money).toBe(0);
  // Frame 32 streams it (32 % 32 = 0) but collects the frame-2 sixth; frame 36 collects slot 0.
  pickups.step(1/60,undefined,32);expect(sim.money).toBe(0);
  for(let f=33;f<36;f++)pickups.step(1/60,undefined,f);expect(sim.money).toBe(0);
  pickups.step(1/60,undefined,36);expect(sim.money).toBe(10);
  // A pickup beyond 100 units of the camera is never collected, even with the player on it.
  sim.player.position=at(far);for(let f=37;f<37+64;f++)pickups.step(1/60,undefined,f);expect(sim.money).toBe(10);
  expect(PICKUP_SLOTS).toBe(620);
 }finally{pickups.dispose();sim.dispose();}
});

test('CPickups::GenerateNewOne takes the first free slot, a removed pickup\'s slot again, however many there are',()=>{
 const sim=new Simulation(),pickups=new WorldPickups(sim,new Scene(),'slices-generate:',{weaponForModel:()=>undefined,giveWeapon:()=>false,wantedLevel:()=>0,setWantedLevel:()=>{},armour:()=>0,setArmour:()=>{}});
 const slots=()=>new Map((pickups as unknown as {states:{pickup:ScmPickup;slot:number}[]}).states.map(s=>[s.pickup.id,s.slot]));
 const made=(n:number)=>({...money(0,[0,0,0]),id:`made:${n}`,command:'GENERATED'});
 try{
  pickups.setPickups([money(0,[0,0,0]),money(1,[1,0,0]),money(2,[2,0,0])]);
  for(let i=0;i<600;i++)pickups.generate(made(i));
  expect(slots().get('made:0')).toBe(3);expect(slots().get('made:599')).toBe(602);
  pickups.removeGenerated('made:10');pickups.removeGenerated('made:4');
  pickups.generate(made(600));pickups.generate(made(601));pickups.generate(made(602));
  expect([slots().get('made:600'),slots().get('made:601'),slots().get('made:602')]).toEqual([7,13,603]);
  // A new script's list starts the slots again.
  pickups.setPickups([money(0,[0,0,0])]);pickups.generate(made(700));expect(slots().get('made:700')).toBe(1);
 }finally{pickups.dispose();sim.dispose();}
});
