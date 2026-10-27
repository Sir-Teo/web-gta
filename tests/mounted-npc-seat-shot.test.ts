import {beforeAll,expect,test,vi} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation,NATIVE_PLAYER_DAMAGE_MULT} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import {playerBikeHit,playerSeatHeadHit} from '../src/vehicle/playerSeatShot';
import type {HunterGunMatrix} from '../src/simulation/nativeHunterGun';

beforeAll(async()=>RAPIER.init());
const matrix:HunterGunMatrix={right:{x:1,y:0,z:0},forward:{x:0,y:1,z:0},up:{x:0,y:0,z:1},position:{x:0,y:-4.8,z:3.3}};
function fixture(bike=false){
 const sim=new Simulation();sim.playerCollider.setEnabled(false);sim.player.health=100;sim.player.armour=50;
 const shooter=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed()),body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,-8));
 sim.world.createCollider(RAPIER.ColliderDesc.cuboid(1,bike ? .3 : 1.2,1),body);sim.world.step();
 const damage=vi.fn(()=>false),burstTyre=vi.fn(()=>true),wheels:unknown[]=[],car={car:{body},health:1000,modelId:492,wrecked:false,damage,burstTyre,wheelSpheres:()=>wheels};
 const weapons=new WeaponSystem(sim,()=>undefined,()=>({cars:[car]}) as any),crime=vi.fn(),practice=vi.fn(),hitFx=vi.fn();weapons.onCrime=crime;weapons.onHit=practice;weapons.fx={ready:true,bulletHit:hitFx,gunshot:vi.fn(),explosion:vi.fn(),areaEffect:vi.fn()};
 let protectedPlayer=false;
 weapons.npcSeatedShot=(from,direction,range,own,hitBody,first)=>{
  const target={body,canBeShot:!protectedPlayer},hit=bike?playerBikeHit({...target,spheres:()=>[{center:{x:0,y:2,z:-8},radius:.2,piece:3}]},from,direction,first?.distance??range,own):!first?.tyre?playerSeatHeadHit({...target,head:{x:0,y:1.9,z:-8}},from,direction,range,hitBody,own):undefined;
  return hit?{t:hit.t,direct:bike,victim:sim.player,hit:(amount,weapon)=>sim.damagePlayer(amount,false,{weapon,from,piece:bike?3:9})}:undefined;
 };
 const fire=(byPlayer=false)=>weapons.fireHunterGun({},shooter,matrix,151,1,byPlayer);
 return {sim,weapons,body,shooter,car,damage,burstTyre,wheels,crime,practice,hitFx,fire,protect:()=>{protectedPlayer=true;},dispose(){weapons.dispose();sim.dispose();}};
}
test.each([false,true])('enemy mounted fire reaches CJ with direct bike collision=%s and keeps NPC attribution',bike=>{
 const f=fixture(bike),query=vi.spyOn(f.weapons,'npcSeatedShot'),hurt=vi.spyOn(f.sim,'damagePlayer');
 try{
  const amount=f.weapons.inventory.info(38)?.damage??35;expect(f.fire()).toBe(true);
  expect(hurt).toHaveBeenCalledExactlyOnceWith(amount,false,expect.objectContaining({weapon:38,piece:bike?3:9}));
  expect(f.sim.player.armour).toBeCloseTo(50-amount*NATIVE_PLAYER_DAMAGE_MULT,5);expect(f.sim.player.health).toBe(100);
  expect(query.mock.calls[0][3]).toBe(f.shooter);expect((query.mock.calls[0][4] as {handle?:number}|undefined)?.handle).toBe(bike?undefined:f.body.handle);
  expect(f.damage).not.toHaveBeenCalled();expect(f.hitFx).not.toHaveBeenCalled();expect(f.crime).not.toHaveBeenCalled();expect(f.practice).not.toHaveBeenCalled();
  expect(f.weapons.effects.find(e=>e.kind==='tracer')?.to?.z).toBeCloseTo(-7.8,5);
 }finally{f.dispose();}
});
test.each(['wall','protected','tyre'])('enemy mounted fire respects %s before damaging a seated player',kind=>{
 const f=fixture();try{
  if(kind==='wall')f.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.5,.5,.2).setTranslation(0,2,-4));
  if(kind==='protected')f.protect();
  if(kind==='tyre')f.wheels.push({center:{x:0,y:2,z:-4},radius:.3,wheel:0});
  f.sim.world.step();expect(f.fire()).toBe(true);expect(f.sim.player.armour).toBe(50);expect(f.sim.player.health).toBe(100);
  if(kind==='tyre'){expect(f.burstTyre).toHaveBeenCalledExactlyOnceWith(0,true,'ped');expect(f.damage).not.toHaveBeenCalled();}
  expect(f.crime).not.toHaveBeenCalled();expect(f.practice).not.toHaveBeenCalled();
 }finally{f.dispose();}
});
test('a player-owned mounted gun keeps its vehicle-creator path and does not ask the incoming NPC query',()=>{
 const f=fixture(),query=vi.spyOn(f.weapons,'npcSeatedShot');try{expect(f.fire(true)).toBe(true);expect(query).not.toHaveBeenCalled();expect(f.sim.player.armour).toBe(50);}finally{f.dispose();}
});
