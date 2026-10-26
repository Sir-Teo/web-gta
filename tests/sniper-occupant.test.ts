import {beforeAll,expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem,type SeatedTarget} from '../src/weapons/WeaponSystem';
import {readWeaponData} from '../src/weapons/weaponData';
import {CRIME} from '../src/simulation/nativeWanted';

beforeAll(async()=>RAPIER.init());
const data=readWeaponData(readFileSync('public/play/world/files/data/weapon.dat','utf8'));
function fixture(){
 const sim=new Simulation(),body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,-5));
 sim.world.createCollider(RAPIER.ColliderDesc.cuboid(1,.8,1),body);sim.world.step();
 const damage=vi.fn(()=>false),car={car:{body},health:1000,wrecked:false,canBeDamaged:true,tyresDontBurst:true,damage};
 const weapons=new WeaponSystem(sim,()=>undefined,()=>({cars:[car],boats:[]} as any));weapons.installNative(data);weapons.inventory.select(34);weapons.firstPerson='sniper';weapons.aiming=true;
 const target:SeatedTarget<any>={car,seat:0,local:{x:0,y:0,z:0},kind:'traffic',head:{x:0,y:1,z:-5},noCriticalHits:true},seated=vi.fn((_target:SeatedTarget<any>,_damage:number,_weapon:number)=> 'hit' as const),crime=vi.fn(),practice=vi.fn();
 weapons.seatedPeds=()=>[target];weapons.onSeatedShot=seated;weapons.onCrime=crime;weapons.onHit=practice;
 const fire=()=>weapons.fire({origin:{x:0,y:1.1,z:0},direction:{x:0,y:0,z:-1}});
 return {sim,weapons,car,target,seated,damage,crime,practice,fire,dispose:()=>{weapons.dispose();sim.dispose();}};
}

test('a flying sniper bullet transfers the vehicle hit to its occupant before applying body damage',()=>{
 const f=fixture();try{
  expect(f.fire()).toBe(true);expect(f.seated).not.toHaveBeenCalled();f.weapons.tick(1/60);
  expect(f.seated).toHaveBeenCalledExactlyOnceWith(f.target,125,34,9,'ped');expect(f.damage).not.toHaveBeenCalled();expect(f.practice).toHaveBeenCalledExactlyOnceWith(34);
  expect(f.crime).toHaveBeenCalledWith(CRIME.damageCar,expect.stringMatching(/^seat:-\d+$/),false,false);
  expect((f.weapons as any).bullets[0].position.z).toBeCloseTo(-4.8,5);
  // The browser's existing once-per-bullet pedestrian rule includes a live, noncritical occupant too.
  f.weapons.tick(1/60);f.weapons.tick(1/60);expect(f.seated).toHaveBeenCalledOnce();
 }finally{f.dispose();}
});

test('critical sniper occupant hits force death, and cop targets use CBulletInfo’s cop-car crime',()=>{
 const f=fixture();try{
  f.target.noCriticalHits=false;f.target.kind='police';expect(f.fire()).toBe(true);f.weapons.tick(1/60);
  expect(f.seated).toHaveBeenCalledExactlyOnceWith(f.target,1000,34,9,'ped');expect(f.crime).toHaveBeenCalledWith(CRIME.damageCopCar,expect.stringMatching(/^seat:-\d+$/),false,false);
 }finally{f.dispose();}
});

test('the same sniper bullet can reach a second seat without hitting the first occupant twice',()=>{
 const f=fixture();try{
  f.target.head={x:0,y:1,z:-4.5};const passenger={...f.target,seat:1,head:{x:0,y:1,z:-5.5}};f.weapons.seatedPeds=()=>[f.target,passenger];
  f.fire();f.weapons.tick(1/60);f.weapons.tick(1/60);f.weapons.tick(1/60);
  expect(f.seated.mock.calls.map(([t])=>t)).toEqual([f.target,passenger]);
 }finally{f.dispose();}
});

test('shot-proof occupants, a nearer building and a nearer tyre keep their existing first-hit rules',()=>{
 for(const kind of ['proof','wall','tyre']){
  const f=fixture();try{
   const burst=vi.fn(()=>true);
   if(kind==='proof')f.target.canBeShot=false;
   if(kind==='wall'){f.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(2,2,.2).setTranslation(0,1,-2));f.sim.world.step();}
   if(kind==='tyre')(f.weapons as any).tyreHit=()=>({t:2,wheel:0,car:{burstTyre:burst}});
   f.fire();f.weapons.tick(1/60);expect(f.seated,kind).not.toHaveBeenCalled();
   if(kind==='tyre')expect(burst).toHaveBeenCalledExactlyOnceWith(0,true,'player');
   if(kind==='proof')expect(f.damage).toHaveBeenCalledOnce();
  }finally{f.dispose();}
 }
});

test('shooting the player’s seated group does not train weapon skill with either instant-hit or sniper fire',()=>{
 for(const weapon of [22,34]){
  const f=fixture();try{
   f.target.crew=true;f.weapons.inventory.select(weapon);if(weapon===22)f.weapons.firstPerson=undefined;
   f.fire();if(weapon===34)f.weapons.tick(1/60);
   expect(f.seated).toHaveBeenCalledOnce();expect(f.practice).not.toHaveBeenCalled();
  }finally{f.dispose();}
 }
});
