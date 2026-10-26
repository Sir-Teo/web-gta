import {beforeAll,expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem,type SeatedTarget} from '../src/weapons/WeaponSystem';
import {readWeaponData} from '../src/weapons/weaponData';
import {CRIME} from '../src/simulation/nativeWanted';
import type {HunterGunMatrix} from '../src/simulation/nativeHunterGun';

beforeAll(async()=>RAPIER.init());
const data=readWeaponData(readFileSync('public/play/world/files/data/weapon.dat','utf8'));
const matrix:HunterGunMatrix={right:{x:1,y:0,z:0},forward:{x:0,y:1,z:0},up:{x:0,y:0,z:1},position:{x:0,y:-4.8,z:3.3}};
function fixture(piece=3,remote=false){
 const sim=new Simulation();sim.playerCollider.setEnabled(false);
 const shooter=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed()),body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,-8));
 sim.world.createCollider(RAPIER.ColliderDesc.cuboid(1,piece===9?1.2:.3,1),body);sim.world.step();
 const damage=vi.fn(()=>false),burstTyre=vi.fn(()=>true),wheels:unknown[]=[],car={car:{body},health:1000,modelId:492,wrecked:false,damage,burstTyre,wheelSpheres:()=>wheels};
 const weapons=new WeaponSystem(sim,()=>undefined,()=>({cars:[car]}) as any);weapons.installNative(data);
 const target:SeatedTarget<any>={car,bike:piece!==9,seat:0,local:{x:0,y:0,z:0},head:{x:0,y:1.9,z:-8},kind:'script',pedType:'CIVMALE',crimeVictim:'script-ped:7',hitSpheres:()=>[{center:{x:0,y:2,z:-8},radius:.2,piece}]};
 const seated=vi.fn(()=>piece===9?'killed' as const:'hit' as const),crime=vi.fn(),practice=vi.fn(),bulletHit=vi.fn(),incoming=vi.fn();
 weapons.seatedPeds=()=>[target];weapons.onSeatedShot=seated;weapons.npcSeatedShot=incoming;weapons.onCrime=crime;weapons.onHit=practice;
 weapons.fx={ready:true,bulletHit,gunshot:vi.fn(),explosion:vi.fn(),areaEffect:vi.fn()};
 const vehicle={occupied:!remote,remoteControlled:remote},fire=()=>weapons.fireHunterGun(vehicle,shooter,matrix,151,1,true);
 return {sim,weapons,target,shooter,body,car,damage,burstTyre,wheels,seated,crime,practice,bulletHit,incoming,fire,dispose(){weapons.dispose();sim.dispose();}};
}
test.each([3,5,9])('a player-driven mounted gun hits occupant piece %s with vehicle crime attribution and no practice',piece=>{
 const f=fixture(piece);try{
  const base=f.weapons.inventory.info(38)!.damage;expect(f.fire()).toBe(true);
  expect(f.seated).toHaveBeenCalledExactlyOnceWith(f.target,piece===9?Math.max(1000,base):base,38,piece,'vehicle');
  expect(f.crime.mock.calls).toEqual([[CRIME.damageCar,'script-ped:7',true,false]]);
  expect(f.practice).not.toHaveBeenCalled();expect(f.incoming).not.toHaveBeenCalled();expect(f.damage).not.toHaveBeenCalled();
  expect(f.bulletHit.mock.calls[0][0]).toMatchObject({ped:{head:piece===9,dead:piece===9}});expect(f.bulletHit.mock.calls[0][1]).toBe(8);
  expect(f.weapons.effects.find(e=>e.kind==='tracer')?.to?.z).toBeCloseTo(-7.8,5);
 }finally{f.dispose();}
});
test('a mounted hit on a cop queues the cop crime without the immediate pedestrian reports',()=>{
 const f=fixture();try{f.target.pedType='COP';f.fire();expect(f.crime.mock.calls).toEqual([[CRIME.damageCopCar,'script-ped:7',true,false]]);}finally{f.dispose();}
});
test('an RC-mounted gun still hits but a vehicle without CJ as its driver is not a criminal event source',()=>{
 const f=fixture(3,true);try{f.fire();expect(f.seated).toHaveBeenCalledExactlyOnceWith(f.target,f.weapons.inventory.info(38)!.damage,38,3,'remote');expect(f.crime).not.toHaveBeenCalled();expect(f.practice).not.toHaveBeenCalled();}finally{f.dispose();}
});
test.each([false,true])('an active drive-by occupant queues a mounted crime only when killed=%s',killed=>{
 const f=fixture();try{f.target.activeDriveBy=true;f.seated.mockReturnValue(killed?'killed':'hit');f.fire();expect(f.crime).toHaveBeenCalledTimes(killed?1:0);}finally{f.dispose();}
});
test.each(['wall','protected','own','tyre'])('player mounted fire preserves %s exclusion before occupant damage',kind=>{
 const f=fixture();try{
  if(kind==='wall')f.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.5,.5,.2).setTranslation(0,2,-4));
  if(kind==='protected')f.target.canBeShot=false;
  if(kind==='own')f.target.car={car:{body:f.shooter}} as any;
  if(kind==='tyre')f.wheels.push({center:{x:0,y:2,z:-4},radius:.3,wheel:0});
  f.sim.world.step();f.fire();expect(f.seated).not.toHaveBeenCalled();expect(f.practice).not.toHaveBeenCalled();
  if(kind==='tyre')expect(f.burstTyre).toHaveBeenCalledExactlyOnceWith(0,true,'player');
 }finally{f.dispose();}
});
