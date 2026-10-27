import {expect,test,beforeAll} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import type {WorldBike} from '../src/simulation/WorldBike';
import {readFileSync} from 'node:fs';
import {readWeaponData} from '../src/weapons/weaponData';

beforeAll(async()=>{await RAPIER.init();});
// A rider's drive-by: FIXED_FWD ahead of the bike when neither look key is held, else out of the looked-to side; the
// same SMG set as a car's, and nothing from an unoccupied bike.
function setup(){
  const sim=new Simulation(),weapons=new WeaponSystem(sim,()=>undefined,()=>undefined);
  const body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,0));
  const bike={occupied:true,wrecked:false,modelId:522,body,assets:{collision:{bounds:{max:[.4,.6,1.2],min:[-.4,0,-1.2]}}}} as unknown as WorldBike;
  return {sim,weapons,bike};
}
const camera={origin:{x:0,y:2.2,z:8},direction:{x:0,y:-0.05,z:-1}};
test('the rider shoots ahead, or out of the side he looks to',()=>{
  const {sim,weapons,bike}=setup();
  try{
    weapons.inventory.give(28,50);
    expect(weapons.fireDrivebyBike(bike,camera,'forward')).toBe(true);
    let tracer=weapons.effects.filter(e=>e.kind==='tracer').at(-1)!;
    // Ahead of the bike (its forward is -z) and no way out to a side.
    expect(tracer.from.z).toBeLessThan(0);expect(Math.abs(tracer.from.x)).toBeLessThan(.05);
    weapons.tick(1);
    expect(weapons.fireDrivebyBike(bike,camera,'left')).toBe(true);
    tracer=weapons.effects.filter(e=>e.kind==='tracer').at(-1)!;
    expect(tracer.from.x).toBeLessThan(-.5);
    weapons.tick(1);
    expect(weapons.fireDrivebyBike(bike,camera,'right')).toBe(true);
    tracer=weapons.effects.filter(e=>e.kind==='tracer').at(-1)!;
    expect(tracer.from.x).toBeGreaterThan(.5);
    weapons.tick(1);
    weapons.inventory.give(22,20);weapons.inventory.select(22);
    expect(weapons.fireDrivebyBike(bike,camera,'forward')).toBe(false);
    (bike as {occupied:boolean}).occupied=false;weapons.inventory.select(28);
    expect(weapons.fireDrivebyBike(bike,camera,'forward')).toBe(false);
  }finally{sim.dispose();}
});

const native=readWeaponData(new TextDecoder('windows-1252').decode(readFileSync('public/play/world/files/data/weapon.dat')));
const handMatrix=[[1,0,0],[0,1,0],[0,0,1],[0,0,1]];
function armNative(weapons:WeaponSystem){weapons.installNative(native);weapons.inventory.give(28,50);weapons.bikeFirePose=()=>({handMatrix,owner:[0,0,1]});weapons.driveByRandom=()=>128;}
test('a loaded rider fires along the bike axes while the camera looks elsewhere, using three draws and one hand',()=>{
 const {sim,weapons,bike}=setup();try{
  armNative(weapons);let draws=0;weapons.driveByRandom=()=>{draws++;return 128;};weapons.lastHand='left';
  for(const p of [[0,1,-10],[-10,1,0],[10,1,0]])sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.5,.5,.5).setTranslation(...p as [number,number,number]));sim.world.step();
  const elsewhere={origin:{x:0,y:3,z:0},direction:{x:0,y:1,z:0}};
  for(const side of ['forward','left','right'] as const){
   weapons.tick(1);expect(weapons.fireDrivebyBike(bike,elsewhere,side)).toBe(true);const ray=weapons.effects.filter(e=>e.kind==='tracer').at(-1)!;
   expect(ray.from.y).toBeLessThan(1.2);if(side==='forward')expect(ray.to.z).toBeCloseTo(-9.5,4);else expect(ray.to.x).toBeCloseTo(side==='left'?-9.5:9.5,4);
  }
  expect(draws).toBe(9);expect(weapons.lastHand).toBe('right');expect(weapons.leftHand).toBe(false);
 }finally{sim.dispose();}
});
for(const capped of [false,true])test(`native drive-by query keeps dead candidates before its cap (${capped})`,()=>{
 const sim=new Simulation(),hit:number[]=[],target={x:.8,y:1,z:-8},candidates=[...Array.from({length:capped?16:1},()=>({position:{x:0,y:1,z:-5},state:55})),{position:target,state:0}];
 const crowd={targets:()=>[],frighten:()=>{},driveByAimCandidates:()=>candidates,damageCollider:(handle:number)=>{hit.push(handle);return true;}};
 const weapons=new WeaponSystem(sim,()=>crowd,()=>undefined),body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,0)),bike={occupied:true,wrecked:false,modelId:522,body,assets:{}} as unknown as WorldBike;
 try{
  armNative(weapons);const collider=sim.world.createCollider(RAPIER.ColliderDesc.ball(.2).setTranslation(target.x,target.y,target.z));sim.world.step();
  expect(weapons.fireDrivebyBike(bike,camera,'forward')).toBe(true);
  if(capped){expect(hit).toEqual([]);expect(weapons.effects.filter(e=>e.kind==='tracer').at(-1)!.to.z).toBeLessThan(-30);}
  else expect(hit).toContain(collider.handle);
 }finally{sim.dispose();}
});
