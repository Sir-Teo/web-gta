import {beforeAll,expect,test,vi} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import type {WorldPlane} from '../src/simulation/WorldPlane';
import {CRIME} from '../src/simulation/nativeWanted';

beforeAll(async()=>{await RAPIER.init();});

for(const launcher of ['sam','removed aircraft'] as const)test(`a rocket from a ${launcher} collides with CJ before its fuse expires`,()=>{
 const sim=new Simulation(),weapons=new WeaponSystem(sim,()=>undefined,()=>undefined),explosion=vi.fn();
 try{
  sim.player.position={x:0,y:99.1,z:-2};sim.player.previous={...sim.player.position};
  sim.playerBody.setTranslation({x:0,y:100,z:-2},true);sim.world.step();
  weapons.onExplosion=explosion;
  weapons.launchHeatSeeker({x:0,y:100,z:0},{x:0,y:0,z:-1},undefined);
  // A removed launcher's handle no longer resolves to a rigid body. It must not exclude CJ's body in its place.
  if(launcher==='removed aircraft'){
   const body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());weapons.projectiles[0].owner=body.handle;
   sim.world.removeRigidBody(body);
  }
  weapons.tick(.1);
  expect(weapons.projectiles).toHaveLength(0);expect(explosion).toHaveBeenCalled();
  expect(explosion.mock.calls[0][2]).toBe(false);
 }finally{weapons.dispose();sim.dispose();}
});

// Exercise launch -> projectile update -> blast, including both ped and vehicle criminal events.
for(const source of ['sam','launcher','aircraft'] as const)test(`${source} rocket keeps its creator attribution when it explodes`,()=>{
 const sim=new Simulation();
 const at={x:0,y:100,z:0};
 const body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(1,100,0));
 const damage=vi.fn(()=>true),damageCollider=vi.fn(()=>({id:7,officer:false}));
 const boat={wrecked:false,occupied:false,body,damage};
 const crowd={targets:()=>[{handle:7,position:{x:0,y:100,z:1},down:false}],frighten(){},damageCollider};
 const weapons=new WeaponSystem(sim,()=>crowd as any,()=>({cars:[],boats:[boat]} as any));
 const crime=vi.fn(),explosion=vi.fn();weapons.onCrime=crime;weapons.onExplosion=explosion;
 try{
  if(source==='sam')expect(weapons.launchHeatSeeker(at,{x:0,y:0,z:-1},body.handle)).toBe(true);
  else if(source==='launcher'){
   weapons.inventory.give(35,5);weapons.inventory.select(35);
   expect(weapons.fire({origin:at,direction:{x:0,y:0,z:-1}})).toBe(true);
  }else{
   const plane={occupied:true,health:1000,armed:true,rocketsArmed:true,modelId:520,body,
    assets:{collision:{bounds:{radius:6}}},ordnancePosition:()=>[3.7,.98,-1.02]} as unknown as WorldPlane;
   expect(weapons.fireAircraft(plane,true)).toBe(true);
  }
  const byPlayer=source!=='sam';
  expect(weapons.projectiles.length).toBe(source==='aircraft'?2:1);
  expect(weapons.projectiles.every(p=>p.byPlayer===byPlayer)).toBe(true);
  // An aircraft rocket has an owner body as well, so owner cannot stand in for player attribution.
  if(source==='aircraft')expect(weapons.projectiles[0].owner).toBe(body.handle);
  // Expire at the victims rather than depending on a flight path or world collision.
  for(const p of weapons.projectiles){p.position={...at};p.stuck=true;p.fuse=0;}
  crime.mockClear();weapons.tick(.02);
  expect(weapons.projectiles).toEqual([]);
  expect(explosion).toHaveBeenCalled();
  expect(explosion.mock.calls.every(args=>args[2]===byPlayer)).toBe(true);
  expect(damageCollider).toHaveBeenCalled();
  expect(damageCollider.mock.calls.every(args=>(args as any[])[4].byPlayer===byPlayer)).toBe(true);
  expect(damage).toHaveBeenCalled();
  expect(damage.mock.calls.every(args=>(args as any[])[4].byPlayer===byPlayer)).toBe(true);
  if(byPlayer){
   expect(crime).toHaveBeenCalledWith(CRIME.damageCar,'ped:7');
   expect(crime).toHaveBeenCalledWith(CRIME.destroyVehicle,`boat:${body.handle}`);
  }else expect(crime).not.toHaveBeenCalled();
 }finally{sim.dispose();}
});

for(const byPlayer of [false,true])test(`rocket ground fires preserve player attribution ${byPlayer}`,()=>{
 const sim=new Simulation(),weapons=new WeaponSystem(sim,()=>undefined,()=>undefined);
 const random=vi.spyOn(Math,'random').mockReturnValue(.5);
 try{
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(20,.5,20).setTranslation(0,99.5,0));sim.world.step();
  weapons.launchHeatSeeker({x:0,y:100,z:0},{x:0,y:0,z:-1},undefined);
  const p=weapons.projectiles[0];p.byPlayer=byPlayer;p.stuck=true;p.fuse=0;
  weapons.tick(.02);
  expect(weapons.fires.active.length).toBeGreaterThan(0);
  expect(weapons.fires.active.every(f=>f.creator===(byPlayer?'player':undefined))).toBe(true);
 }finally{random.mockRestore();sim.dispose();}
});
