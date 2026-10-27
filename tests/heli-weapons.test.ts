import {beforeAll,expect,test,vi} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import type {WorldPlane} from '../src/simulation/WorldPlane';
import capture from './fixtures/native-heli-weapons.json';
beforeAll(async()=>{await RAPIER.init();});
function setup(){
 // Align the target with the Hunter's native muzzle, 1.27 below its origin.
 const sim=new Simulation();sim.player.position={x:0,y:97.83,z:-50};sim.player.previous={...sim.player.position};sim.playerBody.setTranslation({x:0,y:98.73,z:-50},true);
 const body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,100,0));sim.world.createCollider(RAPIER.ColliderDesc.cuboid(2,1,4),body);
 const heli={body,modelId:425,occupied:false,remoteControlled:false,health:1000,armed:true,helicopter:true,frozen:false,weaponSelection:0,assets:{collision:{bounds:{radius:6}}},heliPilot:{mission:23}}as unknown as WorldPlane;
 const planes=new Set([heli]),boats:any[]=[],cars:any[]=[],crowd={damageCollider:vi.fn(()=>false),targets:()=>[],frighten(){}};
 const weapons=new WeaponSystem(sim,()=>crowd as any,()=>({cars,boats,planes}as any));(weapons as any).nowMs=1000;
 const crime=vi.fn(),shake=vi.fn(),sound=vi.fn();weapons.onCrime=crime;weapons.onPadShakeDirect=shake;weapons.onSound=sound;sim.world.step();
 return{sim,heli,planes,boats,weapons,crime,shake,sound,dispose(){weapons.dispose();sim.dispose();}};
}
for(const mission of [23,56])test(`helicopter attack mission ${mission} fires its gun at CJ on foot with enemy attribution`,()=>{
 const f=setup(),hurt=vi.spyOn(f.sim,'damagePlayer');try{
  f.heli.heliPilot!.mission=mission;f.weapons.tick(.02);
  expect(hurt).toHaveBeenCalledWith(35,false,expect.objectContaining({weapon:38}));expect(f.sim.player.health).toBeLessThan(100);expect(f.weapons.aircraftShots).toBe(1);
  expect(f.crime).not.toHaveBeenCalled();expect(f.shake).not.toHaveBeenCalled();
 }finally{f.dispose();}
});
test('helicopter rocket selection fires single unguided enemy rockets from alternating native launch points',()=>{
 const f=setup();try{
  f.heli.weaponSelection=4;(f.heli as any).armed=false;(f.heli as any).modelId=487;
  for(const [now,x]of [[250,-1.5],[500,1.5],[750,-1.5]]){
   (f.weapons as any).nowMs=now;(f.weapons as any).updateAIHelicopterWeapons(now-1);
   const p=(f.weapons as any).projectiles.at(-1);
   expect({...p.position}).toEqual({x,y:100,z:-4});expect(p.velocity).toEqual({x:0,y:0,z:-20});
   expect(p.weapon).toBe(35);expect(p.kind).toBe('rocket');expect(p.byPlayer).toBe(false);expect(p.owner).toBe(f.heli.body.handle);expect(p.target).toBeUndefined();
  }
  expect((f.weapons as any).projectiles).toHaveLength(3);expect(f.weapons.aircraftShots).toBe(3);expect(f.crime).not.toHaveBeenCalled();expect(f.shake).not.toHaveBeenCalled();
 }finally{f.dispose();}
});
for(const [index,row]of capture.targetCases.entries())test(`attack helicopter follows native player-entity target selection ${index}`,()=>{
 const f=setup();try{
  f.sim.player.position={x:40,y:99,z:0};f.sim.playerBody.setTranslation({x:40,y:100,z:0},true);
  const body=f.sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,100,-50));f.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(3,3,3),body);
  if(row.input.vehiclePointer)f.boats.push({body,occupied:row.input.inVehicle,wrecked:false,damage:vi.fn(()=>false)});
  f.sim.world.step();(f.weapons as any).nowMs=1250;(f.weapons as any).updateAIHelicopterWeapons(1249);
  expect(f.weapons.aircraftShots).toBe(row.native==='vehicle'?2:0);
 }finally{f.dispose();}
});
for(const gate of ['occupied','remote','frozen','dead','other mission','player dead','weapon disabled']as const)test(`helicopter AI weapons respect ${gate}`,()=>{
 const f=setup();try{
  if(gate==='occupied')f.heli.occupied=true;if(gate==='remote')f.heli.remoteControlled=true;if(gate==='frozen')f.heli.frozen=true;if(gate==='dead')f.heli.health=0;
  if(gate==='other mission')f.heli.heliPilot!.mission=20;if(gate==='player dead')f.sim.player.health=0;if(gate==='weapon disabled')f.heli.weaponSelection=2;
  f.weapons.tick(.25);expect(f.weapons.aircraftShots).toBe(0);expect((f.weapons as any).projectiles).toHaveLength(0);
 }finally{f.dispose();}
});
test('helicopter gun timing is shared with player fire and retained independently for another aircraft',()=>{
 const f=setup();try{
  f.heli.weaponSelection=1;f.weapons.tick(.02);expect(f.weapons.aircraftShots).toBe(1);
  f.heli.occupied=true;expect(f.weapons.fireAircraft(f.heli)).toBe(false);f.weapons.tick(.061);expect(f.weapons.fireAircraft(f.heli)).toBe(true);
  f.heli.occupied=false;const another={...f.heli}as WorldPlane;f.planes.add(another);f.weapons.tick(.001);expect(f.weapons.aircraftShots).toBe(3);
 }finally{f.dispose();}
});

test('an enemy helicopter rocket hits a vehicle and its real blast keeps enemy attribution',()=>{
 const f=setup();try{
  f.heli.weaponSelection=4;
  const body=f.sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,100,-50));f.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(3,3,3),body);
  const damage=vi.fn(()=>false);f.boats.push({body,occupied:true,wrecked:false,damage});f.sim.world.step();
  (f.weapons as any).nowMs=249;f.weapons.tick(.001);expect((f.weapons as any).projectiles).toHaveLength(1);f.heli.heliPilot!.mission=20;
  for(let i=0;i<200&&!f.weapons.explosions;i++)f.weapons.tick(.02);
  expect(f.weapons.explosions).toBeGreaterThan(0);expect(damage).toHaveBeenCalled();
  expect(damage.mock.calls.some((call:any[])=>call[0]>0&&call[4]?.byPlayer===false)).toBe(true);
  expect(f.crime).not.toHaveBeenCalled();expect(f.shake).not.toHaveBeenCalled();
 }finally{f.dispose();}
});

test('an attack helicopter targets CJ’s aircraft while he rides as a passenger',()=>{
 const f=setup();try{
  f.sim.player.position={x:40,y:99,z:0};f.sim.playerBody.setTranslation({x:40,y:100,z:0},true);
  const body=f.sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,100,-50));f.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(3,3,3),body);
  f.planes.add({body,occupied:false,playerPassengerSeat:1,health:1000,helicopter:false,damage:vi.fn(()=>false)}as unknown as WorldPlane);
  f.sim.world.step();(f.weapons as any).nowMs=1250;(f.weapons as any).updateAIHelicopterWeapons(1249);
  expect(f.weapons.aircraftShots).toBe(2);expect((f.weapons as any).projectiles[0].kind).toBe('rocket');
 }finally{f.dispose();}
});
