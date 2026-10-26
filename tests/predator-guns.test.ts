import {beforeAll,expect,test,vi} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
import {WorldBoat} from '../src/simulation/WorldBoat';
beforeAll(async()=>{await RAPIER.init();});
function setup(){
 const sim=new Simulation();sim.playerCollider.setEnabled(false);
 const body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());sim.world.createCollider(RAPIER.ColliderDesc.cuboid(1,.4,4),body);
 const boat={modelId:430,occupied:true,wrecked:false,gunSwitchedOff:false,body,assets:{collision:{bounds:{radius:4}}}} as unknown as WorldBoat;
 const fleet:any={cars:[],boats:new Set([boat]),planes:new Set(),bikes:new Set()},weapons=new WeaponSystem(sim,()=>undefined,()=>fleet),sound=vi.fn(),crime=vi.fn(),shake=vi.fn(),trace=vi.fn(),gunshot=vi.fn(),blood=vi.fn(),use=vi.fn();
 weapons.onSound=sound;weapons.onCrime=crime;weapons.onPadShakeDirect=shake;weapons.onTrace=trace;weapons.onUse=use;weapons.fx={ready:true,gunshot,bulletHit:blood,explosion:vi.fn(),areaEffect:vi.fn()};
 sim.world.step();return {sim,body,boat,fleet,weapons,sound,crime,shake,trace,gunshot,blood,use,dispose(){weapons.dispose();sim.dispose();}};
}
test('Predator twin guns use their own clock/clip and do not consume the held weapon or add gunshot FX/crime',()=>{
 const f=setup(),random=vi.spyOn(Math,'random').mockReturnValue(128/32768);try{
  const ammo=JSON.stringify([...f.weapons.inventory.ammo]);expect(f.weapons.fireBoatFixedGuns(f.boat,true,true,false,150)).toBe(false);expect(f.weapons.fireBoatFixedGuns(f.boat,true,true,false,151)).toBe(true);
  expect(f.trace).toHaveBeenCalledTimes(2);expect(f.trace.mock.calls[0]).toEqual([{x:2,y:1,z:-2.5},expect.objectContaining({x:2,y:1,z:-62.5}),'aircraft']);expect(f.trace.mock.calls[1][0]).toEqual({x:-2,y:1,z:-2.5});expect(f.sound).toHaveBeenCalledWith('fire',31,expect.anything(),'aircraft');
  expect(JSON.stringify([...f.weapons.inventory.ammo])).toBe(ammo);expect(f.use).not.toHaveBeenCalled();expect(f.crime).not.toHaveBeenCalled();expect(f.shake).not.toHaveBeenCalled();expect(f.gunshot).not.toHaveBeenCalled();expect(f.blood).not.toHaveBeenCalled();expect(f.weapons.snapshot().fixedGunVolleys).toBe(1);
 }finally{random.mockRestore();f.dispose();}
});
test('model, occupancy, wrecking, camera look and gun switch retain their control gates',()=>{
 const f=setup();try{
  f.boat.occupied=false;expect(f.weapons.fireBoatFixedGuns(f.boat,true,true,false,2000)).toBe(false);f.boat.occupied=true;
  (f.boat as any).modelId=452;expect(f.weapons.fireBoatFixedGuns(f.boat,true,true,false,2000)).toBe(false);(f.boat as any).modelId=430;
  f.boat.wrecked=true;expect(f.weapons.fireBoatFixedGuns(f.boat,true,true,false,2000)).toBe(false);f.boat.wrecked=false;
  expect(f.weapons.fireBoatFixedGuns(f.boat,true,false,false,2000)).toBe(false);expect(f.weapons.fireBoatFixedGuns(f.boat,true,true,true,2000)).toBe(false);f.boat.gunSwitchedOff=true;expect(f.weapons.fireBoatFixedGuns(f.boat,true,true,false,2000)).toBe(false);expect(f.trace).not.toHaveBeenCalled();
 }finally{f.dispose();}
});
test('twenty twin volleys exhaust one clip and impose the original strict future timestamp delay',()=>{
 const f=setup();try{for(let i=1;i<=20;i++)expect(f.weapons.fireBoatFixedGuns(f.boat,true,true,false,i*151)).toBe(true);expect(f.trace).toHaveBeenCalledTimes(40);
  expect(f.weapons.fireBoatFixedGuns(f.boat,true,true,false,20*151+1550)).toBe(false);expect(f.weapons.fireBoatFixedGuns(f.boat,true,true,false,20*151+1551)).toBe(true);
 }finally{f.dispose();}
});
test('fixed rounds damage a vehicle anonymously with MICRO_UZI and no per-ped gun attack metadata',()=>{
 const f=setup(),random=vi.spyOn(Math,'random').mockReturnValue(128/32768),damage=vi.fn(()=>false);try{
  const target=f.sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(2,1,-20));f.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.5,.5,1),target);f.fleet.cars.push({car:{body:target},health:1000,wrecked:false,assets:{collision:{bounds:{radius:2}}},damage});f.sim.world.step();
  f.weapons.fireBoatFixedGuns(f.boat,true,true,false,151);expect(damage).toHaveBeenCalledTimes(1);expect(damage).toHaveBeenCalledWith(15,undefined,false,undefined,{weapon:28,byPlayer:false,by:null});expect(f.crime).not.toHaveBeenCalled();
 }finally{random.mockRestore();f.dispose();}
});
test('anonymous rounds reach CJ with the native drive-by damage type and trace the actual stopping point',()=>{
 const f=setup(),hurt=vi.spyOn(f.sim,'damagePlayer');try{
  f.sim.playerCollider.setEnabled(true);f.sim.playerBody.setTranslation({x:2,y:1,z:-20},true);f.sim.world.step();f.weapons.fireInstantHitRound({x:2,y:1,z:-2.5},{x:2,y:1,z:-62.5},15);
  expect(hurt).toHaveBeenCalledWith(15,false,{weapon:52,from:{x:2,y:1,z:-2.5}});expect(f.sim.player.health).toBeLessThan(100);expect(f.trace.mock.calls[0][1].z).toBeGreaterThan(-20);expect(f.blood).not.toHaveBeenCalled();
 }finally{f.dispose();}
});
test('the pedestrian bridge only applies anonymous rounds to living victims, without treating corpses',()=>{
 const apply=vi.fn(),alive={collider:{handle:1},health:100},dead={collider:{handle:2},health:0},host={people:[alive,dead],applyNpcBullet:apply},end=new Vector3(0,1,0);
 expect(WorldPedestrians.prototype.instantHitRound.call(host as any,1,15,{x:0,z:-1},end,3)).toBe(true);expect(apply).toHaveBeenCalledWith(alive,15,52,{x:0,z:-1},end,3);
 expect(WorldPedestrians.prototype.instantHitRound.call(host as any,2,15,{x:0,z:-1},end,3)).toBe(true);expect(apply).toHaveBeenCalledTimes(1);expect(WorldPedestrians.prototype.instantHitRound.call(host as any,3,15,{x:0,z:-1},end,3)).toBe(false);
});
function footVictim(over:Record<string,unknown>={}){
 const ped:any={id:3,health:100,armour:0,defendMult:1,pedType:'GANG1',follow:true,collider:{handle:12},actor:{player:{position:{x:2,y:0,z:-20},heading:0}},view:{reactionPlayedOut:false,reactionName:'shot_partial',hasReaction:()=>false},...over};
 const crowd=Object.assign(Object.create(WorldPedestrians.prototype),{people:[ped],hitPiece:()=>3,applyReaction:vi.fn(),damageReaction:vi.fn(()=>({})),onKill:vi.fn(),inPlayerGroup:()=>true});
 return {ped,crowd,fire:(piece=3)=>crowd.instantHitRound(12,15,{x:0,z:-1},new Vector3(2,1,-20),piece)};
}
test('anonymous fixed rounds preserve defend/armour floats without applying friendly player scaling',()=>{
 const f=footVictim({defendMult:1.1,armour:10,lastDamagedBy:{player:true}});f.fire();expect(f.ped.health).toBe(93.5);expect(f.ped.armour).toBe(0);expect(f.ped.lastDamagedBy).toEqual({});expect(f.ped.lastWeaponDamage).toBe(52);expect(f.crowd.onKill).not.toHaveBeenCalled();
});
for(const protection of [{onlyDamagedByPlayer:true},{proofs:{bullet:true}}])test(`fixed rounds respect native pedestrian protection ${JSON.stringify(protection)}`,()=>{
 const f=footVictim(protection);f.fire();expect(f.ped.health).toBe(100);expect(f.crowd.applyReaction).not.toHaveBeenCalled();
});
test('drive-by damage type 52 keeps the vest/head distinction and cannot create an ordinary gun head critical',()=>{
 const f=footVictim({bulletProofVest:true});f.fire(9);expect(f.ped.health).toBe(85);expect(f.crowd.onKill).not.toHaveBeenCalled();
});
test('a fatal anonymous fixed round reports an uncredited kill once and leaves a corpse alone afterward',()=>{
 const f=footVictim({health:15});f.fire();expect(f.ped.health).toBe(0);expect(f.crowd.onKill).toHaveBeenCalledTimes(1);expect(f.crowd.onKill.mock.calls[0][0]).toMatchObject({byPlayer:false,recruit:true});f.fire();expect(f.crowd.onKill).toHaveBeenCalledTimes(1);expect(f.crowd.applyReaction).toHaveBeenCalledTimes(1);
});

for(const protection of [{},{onlyDamagedByPlayer:true},{proofs:{bullet:true}}])test(`anonymous rounds retain actual boat damage/proof behavior ${JSON.stringify(protection)}`,()=>{
 const f=setup();try{
  const body=f.sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(2,1,-20));f.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.5,.5,1),body);const victim=Object.assign(Object.create(WorldBoat.prototype),{body,modelId:452,health:1000,wrecked:false,occupied:false,canBeDamaged:true,lastWeaponDamage:-1,...protection});f.fleet.boats.add(victim);f.sim.world.step();
  f.weapons.fireInstantHitRound({x:2,y:1,z:-2.5},{x:2,y:1,z:-62.5},15);const blocked=Object.keys(protection).length>0;expect(victim.health).toBe(blocked?1000:985);expect(victim.lastWeaponDamage).toBe(blocked?-1:28);expect(f.crime).not.toHaveBeenCalled();
 }finally{f.dispose();}
});
test('the second barrel queries targets after the first round can retire a vehicle',()=>{
 const f=setup(),random=vi.spyOn(Math,'random').mockReturnValue(128/32768);try{
  const body=f.sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,2,-20));f.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(3,2,1),body);
  const car={car:{body},health:1000,wrecked:false,assets:{collision:{bounds:{radius:4}}},damage:vi.fn(()=>{f.fleet.cars.length=0;f.sim.world.removeRigidBody(body);return false;})};f.fleet.cars.push(car);f.sim.world.step();
  expect(f.weapons.fireBoatFixedGuns(f.boat,true,true,false,151)).toBe(true);expect(car.damage).toHaveBeenCalledTimes(1);expect(f.trace).toHaveBeenCalledTimes(2);expect(f.trace.mock.calls[1][1]).toEqual({x:-2,y:1,z:-62.5});
 }finally{random.mockRestore();f.dispose();}
});
