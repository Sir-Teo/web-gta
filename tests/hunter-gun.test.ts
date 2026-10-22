import {beforeAll,expect,test,vi} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import {hunterGunOrigin,vehicleGunReady,type HunterGunMatrix} from '../src/simulation/nativeHunterGun';
import type {WorldPlane} from '../src/simulation/WorldPlane';
beforeAll(async()=>{await RAPIER.init();});
const matrix:HunterGunMatrix={right:{x:1,y:0,z:0},forward:{x:0,y:1,z:0},up:{x:0,y:0,z:1},position:{x:0,y:0,z:101.3}};

test('the script’s native 150 ms comparison is strict, unsigned, and uses uint32 addition before comparing',()=>{
 expect(vehicleGunReady(150,0,150)).toBe(false);expect(vehicleGunReady(151,0,150)).toBe(true);
 expect(vehicleGunReady(301,151,150)).toBe(false);expect(vehicleGunReady(302,151,150)).toBe(true);
 expect(vehicleGunReady(0xfffffff0,0xfffffff0,150)).toBe(true); // native addition wraps before the comparison
 expect(vehicleGunReady(134,0xfffffff0,150)).toBe(false);expect(vehicleGunReady(135,0xfffffff0,150)).toBe(true);
});

test('the Hunter offset follows the current native matrix and includes a full timestep of move speed',()=>{
 const p=hunterGunOrigin({...matrix,position:{x:10,y:20,z:30}},{x:.2,y:.4,z:-.1},1.5);
 expect(p.x).toBeCloseTo(10.3,5);expect(p.y).toBeCloseTo(25.4,5);expect(p.z).toBeCloseTo(28.55,5);
 const r=hunterGunOrigin({...matrix,right:{x:0,y:1,z:0},forward:{x:-1,y:0,z:0}},{x:0,y:0,z:0},1);
 expect(r.x).toBe(Math.fround(-4.8));expect(r.y).toBe(0);expect(r.z).toBeCloseTo(100,5);
});

function setup(){
 const sim=new Simulation();sim.player.position={x:0,y:99.1,z:-100};sim.player.previous={...sim.player.position};
 sim.playerBody.setTranslation({x:0,y:100,z:-100},true);sim.playerBody.setNextKinematicTranslation({x:0,y:100,z:-100});
 const body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,101.3,0));sim.world.createCollider(RAPIER.ColliderDesc.cuboid(2,1,4),body);
 const plane={body,modelId:425,occupied:false,remoteControlled:false,health:1000,armed:true,rocketsArmed:true,helicopter:true,assets:{collision:{bounds:{radius:6}}},ordnancePosition:()=>[2.17,1,-.8]} as unknown as WorldPlane;
 const weapons=new WeaponSystem(sim,()=>undefined,()=>({cars:[],boats:[],planes:new Set([plane])}) as any),sound=vi.fn(),crime=vi.fn(),shake=vi.fn(),gunshot=vi.fn();
 weapons.onSound=sound;weapons.onCrime=crime;weapons.onPadShakeDirect=shake;weapons.fx={ready:true,gunshot,explosion:vi.fn(),bulletHit:vi.fn(),areaEffect:vi.fn()};sim.world.step();
 return {sim,body,plane,weapons,sound,crime,shake,gunshot,dispose(){weapons.dispose();sim.dispose();}};
}

test('script fire hits CJ with enemy attribution, emits native shell parameters, and has no model/health/input gate',()=>{
 const f=setup(),hurt=vi.spyOn(f.sim,'damagePlayer'),vehicle={modelId:492,health:0};
 try{
  expect(f.weapons.fireHunterGun(vehicle,f.body,matrix,150,1,false)).toBe(false);
  expect(f.weapons.fireHunterGun(vehicle,f.body,matrix,151,1,false,{center:[0,0,0],radius:6})).toBe(true);
  expect(hurt).toHaveBeenCalledWith(expect.any(Number),false,expect.objectContaining({weapon:38}));expect(f.weapons.aircraftShots).toBe(1);
  expect(f.gunshot.mock.calls[0][4]).toMatchObject({shell:{direction:[0,Math.fround(.1)],size:Math.fround(.025),creator:{radius:6}}});
  expect(f.sound).toHaveBeenCalledWith('fire',38,expect.anything(),'aircraft');expect(f.crime).not.toHaveBeenCalled();expect(f.shake).not.toHaveBeenCalled();
  expect(f.weapons.fireHunterGun(vehicle,f.body,matrix,301,1,false)).toBe(false);expect(f.weapons.fireHunterGun(vehicle,f.body,matrix,302,1,false)).toBe(true);
 }finally{f.dispose();}
});

test('script and ordinary aircraft guns share the vehicle timestamp while separate vehicles can fire independently',()=>{
 const f=setup(),playerImpact=vi.fn();f.weapons.onPlayerBulletImpact=playerImpact;
 try{
  f.plane.occupied=true;f.weapons.tick(1);const ammo=JSON.stringify([...f.weapons.inventory.ammo]);
  expect(f.weapons.fireAircraft(f.plane)).toBe(true);
  expect(f.weapons.fireHunterGun(f.plane,f.body,matrix,1100,1,true)).toBe(false);
  expect(f.weapons.fireHunterGun({},f.body,matrix,1100,1,false)).toBe(true);
  expect(f.weapons.fireHunterGun(f.plane,f.body,matrix,1151,1,true)).toBe(true);
  (f.weapons as any).nowMs=1211;expect(f.weapons.fireAircraft(f.plane)).toBe(false);
  (f.weapons as any).nowMs=1212;expect(f.weapons.fireAircraft(f.plane)).toBe(true);
  expect(JSON.stringify([...f.weapons.inventory.ammo])).toBe(ammo);
  expect(playerImpact).not.toHaveBeenCalled(); // A vehicle creator is not a player ped, even when player-owned.
 }finally{f.dispose();}
});
