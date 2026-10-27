import {beforeAll,expect,test,vi} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import {planeWeaponRequests} from '../src/simulation/nativePlaneWeapons';
import type {WorldPlane} from '../src/simulation/WorldPlane';

beforeAll(async()=>{await RAPIER.init();});
const at={x:0,y:100,z:0},forward={x:0,y:0,z:-1};
const requests=(distance:number,selection=0,now=2000,previous=1999)=>planeWeaponRequests(at,forward,{...at,z:-distance},selection,now,previous);

test('native gun and missile distances are strict and missiles cross a two-second clock boundary',()=>{
 expect(requests(30)).toEqual({guns:true,missile:false});
 expect(requests(30.01)).toEqual({guns:true,missile:true});
 expect(requests(149.99)).toEqual({guns:true,missile:true});
 expect(requests(150)).toEqual({guns:false,missile:true});
 expect(requests(160)).toEqual({guns:false,missile:false});
 expect(requests(100,0,1999,1998)).toEqual({guns:true,missile:false});
 expect(requests(100,0,4001,3999).missile).toBe(true);
 expect(requests(100,0,3000,2999).missile).toBe(false);
});

test('both checks require a forward dot greater than 0.8; weapon selection gates only the guns',()=>{
 expect(planeWeaponRequests(at,forward,{x:60,y:100,z:-80},0,2000,1999)).toEqual({guns:false,missile:false});
 expect(planeWeaponRequests(at,forward,{x:59,y:100,z:-80},0,2000,1999)).toEqual({guns:true,missile:true});
 expect(requests(-100)).toEqual({guns:false,missile:false});
 expect(requests(0)).toEqual({guns:false,missile:false});
 expect(planeWeaponRequests(at,forward,undefined,0,2000,1999)).toEqual({guns:false,missile:false});
 for(const selection of [0,1,2,3])expect(requests(100,selection)).toEqual({guns:selection<2,missile:true});
});

function setup(){
 const sim=new Simulation();
 // The Rustler's first native gun hard point is on its right wing, not the fuselage centreline.
 sim.player.position={x:2.19,y:99.1,z:-100};sim.player.previous={...sim.player.position};
 sim.playerBody.setTranslation({x:2.19,y:100,z:-100},true);
 const body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,100,0));
 sim.world.createCollider(RAPIER.ColliderDesc.cuboid(2,1,4),body);
 const plane={body,modelId:476,occupied:false,health:1000,armed:true,helicopter:false,frozen:false,weaponSelection:0,
  assets:{collision:{bounds:{radius:6}}},planePilot:{mission:63}} as unknown as WorldPlane;
 const planes=new Set([plane]),boats:any[]=[],cars:any[]=[],crowd={damageCollider:vi.fn((_handle:number)=>false as any),targets:()=>[],frighten(){}};
 const weapons=new WeaponSystem(sim,()=>crowd,()=>({cars,boats,planes} as any));
 // Start past the native initial gun gate; each vehicle's timestamp still starts at zero.
 (weapons as any).nowMs=1000;
 const crime=vi.fn(),shake=vi.fn();weapons.onCrime=crime;weapons.onPadShakeDirect=shake;
 sim.world.step();
 return {sim,plane,planes,cars,boats,crowd,weapons,crime,shake,dispose(){weapons.dispose();sim.dispose();}};
}

test('a dogfight gun hits CJ on foot, applies his damage event, and reports no player crimes or controller shake',()=>{
 const f=setup(),hurt=vi.spyOn(f.sim,'damagePlayer');
 try{
  const health=f.sim.player.health;f.weapons.tick(.02);
  expect(hurt).toHaveBeenCalledWith(35,false,expect.objectContaining({weapon:31}));
  expect(f.sim.player.health).toBeLessThan(health);expect(f.weapons.aircraftShots).toBe(1);
  expect(f.crime).not.toHaveBeenCalled();expect(f.shake).not.toHaveBeenCalled();
 }finally{f.dispose();}
});

test('guns hit the first obstacle, with per-vehicle clocks retained when control changes to the player',()=>{
 const f=setup(),hurt=vi.spyOn(f.sim,'damagePlayer'),objectShot=vi.fn();f.weapons.onObjectShot=objectShot;
 try{
  f.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(20,20,1).setTranslation(0,100,-50));f.sim.world.step();
  // A second plane must get its own shot on the same frame.
  const second={...f.plane} as WorldPlane;f.planes.add(second);
  f.weapons.tick(.02);expect(f.weapons.aircraftShots).toBe(2);expect(hurt).not.toHaveBeenCalled();
  expect(objectShot.mock.calls.every(call=>call[5]===false)).toBe(true);
  f.weapons.tick(.02);expect(f.weapons.aircraftShots).toBe(2);
  f.weapons.tick(.06);expect(f.weapons.aircraftShots).toBe(2); // equality at 80 ms is still blocked
  f.weapons.tick(.001);expect(f.weapons.aircraftShots).toBe(4);
  f.plane.occupied=true;expect(f.weapons.fireAircraft(f.plane)).toBe(false);
  f.weapons.tick(.081);expect(f.weapons.fireAircraft(f.plane)).toBe(true);
  expect(objectShot.mock.calls.at(-1)?.[5]).toBe(true);
 }finally{f.dispose();}
});

for(const victim of ['ped','boat'] as const)test(`enemy gun damage to a ${victim} preserves attribution`,()=>{
 const f=setup();
 try{
  const b=f.sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(2.19,100,-50));
  const c=f.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(2,2,2),b);
  const damage=vi.fn(()=>true);
  if(victim==='ped')f.crowd.damageCollider.mockImplementation(h=>h===c.handle?{id:7,officer:true}:false);
  else f.boats.push({body:b,wrecked:false,damage});
  f.sim.world.step();f.weapons.tick(.02);
  const call=victim==='ped'?f.crowd.damageCollider.mock.calls[0]:damage.mock.calls[0];
  expect((call as any[])[4]).toEqual(expect.objectContaining({byPlayer:false,weapon:31}));
  expect(f.crime).not.toHaveBeenCalled();
 }finally{f.dispose();}
});

test('dogfight missiles launch from four forward and three below, inherit speed, track CJ, and keep enemy attribution through the blast',()=>{
 const f=setup(),explosion=vi.fn(),sound=vi.fn();
 try{
  f.plane.weaponSelection=2; // Does not suppress TestWhetherToFirePlaneMissiles.
  vi.spyOn(f.plane.body,'linvel').mockReturnValue({x:0,y:0,z:-40});
  (f.weapons as any).nowMs=1990;f.weapons.onExplosion=explosion;f.weapons.onSound=sound;
  f.weapons.tick(.02);
  expect(f.weapons.projectiles).toHaveLength(1);
  const p=f.weapons.projectiles[0];
  expect(p).toMatchObject({weapon:36,target:f.sim.playerBody.handle,owner:f.plane.body.handle,byPlayer:false,kind:'guided'});
  expect(sound.mock.calls[0][2]).toMatchObject({x:0,y:97,z:-4});
  expect(Math.hypot(p.velocity.x,p.velocity.y,p.velocity.z)).toBeGreaterThan(49);
  expect(p.position.z).toBeLessThan(-4);expect(p.position.z).toBeGreaterThan(-5.1);
  // Chase a player who moved across its nose: the target must resolve to the player's body.
  f.sim.playerBody.setTranslation({x:10,y:100,z:-100},true);f.weapons.tick(.02);expect(p.velocity.x).toBeGreaterThan(0);
  p.position={x:0,y:100,z:-98};p.stuck=true;p.fuse=0;f.weapons.tick(.02);
  expect(f.weapons.projectiles).toHaveLength(0);expect(explosion).toHaveBeenCalled();
  expect(explosion.mock.calls[0][2]).toBe(false);expect(f.crime).not.toHaveBeenCalled();
 }finally{f.dispose();}
});

test('attack missions require a vehicle target, and follow, crashed, frozen, destroyed and occupied planes do not attack',()=>{
 const f=setup();
 try{
  for(const mission of [35,59,37,57,58,0]){f.plane.planePilot!.mission=mission;f.weapons.tick(.02);}
  expect(f.weapons.aircraftShots).toBe(0);
  const b=f.sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(2.19,100,-100));
  const damage=vi.fn(()=>false);f.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(2,2,2),b);
  f.boats.push({body:b,occupied:true,wrecked:false,damage});f.sim.playerCollider.setEnabled(false);f.sim.world.step();
  for(const mission of [35,59]){f.plane.planePilot!.mission=mission;f.weapons.tick(.1);}
  expect(damage).toHaveBeenCalledTimes(2);
  f.plane.planePilot!.mission=63;const shots=f.weapons.aircraftShots;
  f.plane.frozen=true;f.weapons.tick(.1);f.plane.frozen=false;
  f.plane.health=0;f.weapons.tick(.1);f.plane.health=1000;
  f.plane.occupied=true;f.weapons.tick(.1);
  expect(f.weapons.aircraftShots).toBe(shots);
 }finally{f.dispose();}
});

test('attack-player plane weapons select the player’s passenger aircraft',()=>{
 const f=setup();try{
  f.sim.player.position={x:40,y:99.1,z:0};f.sim.playerBody.setTranslation({x:40,y:100,z:0},true);
  const body=f.sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,100,-100));f.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(3,3,3),body);
  f.planes.add({body,occupied:false,playerPassengerSeat:1,health:1000,helicopter:false,damage:vi.fn(()=>false)}as unknown as WorldPlane);
  f.plane.planePilot!.mission=35;f.sim.world.step();(f.weapons as any).nowMs=2000;(f.weapons as any).updateAIPlaneWeapons(1999);
  expect(f.weapons.aircraftShots).toBe(2);expect((f.weapons as any).projectiles[0].target).toBe(body.handle);
 }finally{f.dispose();}
});
