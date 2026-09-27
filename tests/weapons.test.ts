import {beforeAll,expect,test,vi} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {WEAPONS} from '../src/weapons/catalog';
import {WeaponInventory} from '../src/weapons/Inventory';
import {WeaponSystem,criminalEventCrime} from '../src/weapons/WeaponSystem';
import {CRIME} from '../src/simulation/nativeWanted';
import {Simulation} from '../src/simulation/Simulation';
beforeAll(async()=>{await RAPIER.init();});
const camera={origin:{x:0,y:1.3,z:3},direction:{x:0,y:0,z:-1}};
function setup(){const sim=new Simulation();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(100,.5,100).setTranslation(0,-.5,0));const body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,1,-10));const target=sim.world.createCollider(RAPIER.ColliderDesc.capsule(.6,.4),body);sim.world.step();let damage=0;
 const weapons=new WeaponSystem(sim,()=>({damageCollider:(handle,amount)=>{if(handle!==target.handle)return false;damage+=amount;return true;},targets:()=>[{handle:target.handle,position:{...body.translation()},officer:false,armed:false,attacking:false,down:false,noCriticalHits:false}],frighten:()=>{}}),()=>undefined);
 return {sim,weapons,target,damage:()=>damage,tick:(seconds:number)=>{for(let t=0;t<seconds;t+=1/60){weapons.tick(1/60);sim.world.step();}},dispose:()=>{weapons.dispose();sim.dispose();}};
}
test('all 44 handheld IDs are selectable and ammo is isolated by weapon',()=>{
 expect(WEAPONS).toHaveLength(44);expect(new Set(WEAPONS.map(w=>w.id)).size).toBe(44);
 const inv=new WeaponInventory();for(const w of WEAPONS){expect(inv.select(w.id)).toBe(true);expect(inv.weapon).toBe(w);}expect(inv.select(19)).toBe(false);
 inv.select(22);expect(inv.fire()).toBe(true);expect(inv.fire()).toBe(false);expect(inv.ammo.get(22)!.clip).toBe(16);inv.select(31);expect(inv.ammo.get(31)!.clip).toBe(50);
});
test('reload transfers only missing rounds, a reload put away finishes when its weapon comes back, and empty reserves stay empty',()=>{
 const inv=new WeaponInventory();inv.select(24);inv.fire();inv.reload();inv.tick(.5);inv.select(22);inv.tick(4);expect(inv.ammo.get(24)!.clip).toBe(6);
 inv.select(24);inv.reload();inv.tick(2);expect(inv.ammo.get(24)).toEqual({clip:7,reserve:55});inv.ammo.set(24,{clip:0,reserve:0});expect(inv.fire()).toBe(false);expect(inv.reload()).toBe(false);
});
test('bullets hit the nearest collider; muzzle obstructions block a clear camera sightline',()=>{
 const f=setup();try{f.weapons.inventory.select(22);f.weapons.aiming=true;expect(f.weapons.fire(camera)).toBe(true);expect(f.damage()).toBe(25);
 const wall=f.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(3,3,.2).setTranslation(0,1,-2));f.sim.world.step();f.tick(1);f.weapons.fire({origin:{x:0,y:1.3,z:-3},direction:{x:0,y:0,z:-1}});expect(f.damage()).toBe(25);f.sim.world.removeCollider(wall,true);
 }finally{f.dispose();}
});
test('shotguns emit separate pellets and consume one shell',()=>{const f=setup();try{f.weapons.inventory.select(25);f.weapons.fire(camera);expect(f.weapons.effects.filter(e=>e.kind==='tracer')).toHaveLength(8);expect(f.weapons.inventory.ammo.get(25)!.clip).toBe(0);expect(f.damage()).toBeGreaterThan(0);}finally{f.dispose();}});
test('grenades have a fuse, rockets explode on collision, and remote charges wait for the detonator',()=>{
 for(const id of [16,35,39]){const f=setup();try{f.weapons.inventory.select(id);f.weapons.fire(camera);
  // A throwable leaves at WEAPON_throw's fire frame, 0.2 s of WEAPON_start_throw plus the anim loop 2 fire time.
  if(id!==35){expect(f.weapons.projectiles).toHaveLength(0);f.tick(.6);}expect(f.weapons.projectiles).toHaveLength(1);expect(f.weapons.explosions).toBe(0);f.tick(4);if(id===39){expect(f.weapons.explosions).toBe(0);expect(f.weapons.projectiles).toHaveLength(1);f.weapons.inventory.select(40);f.weapons.fire(camera);}expect(f.weapons.explosions).toBeGreaterThan(0);expect(f.weapons.projectiles).toHaveLength(0);}finally{f.dispose();}}
});
test('gas leaves a hazard, molotovs light native fires, and extinguishers put fire out without removing gas',()=>{
 const f=setup();try{for(const id of [17,18]){f.weapons.inventory.select(id);f.weapons.fire({origin:camera.origin,direction:{x:0,y:-.7,z:-1}});f.tick(4.2);}
 expect(f.weapons.hazards.some(h=>h.kind==='gas')).toBe(true);
 // The molotov's explosion window sets the world on fire where it landed (CWorld::SetWorldOnFire).
 expect(f.weapons.fires.active.length).toBeGreaterThan(0);
 const fire=f.weapons.fires.active[0].position,at={x:fire.x,y:fire.z,z:-fire.y};
 f.sim.player.position={x:at.x,y:at.y,z:at.z+2};f.sim.playerBody.setTranslation({...f.sim.player.position,y:f.sim.player.position.y+.9},true);f.sim.world.step();
 // Water strength 2 per second: every fire in reach goes out after about half a second of spraying.
 f.weapons.inventory.select(42);
 for(let i=0;i<90&&f.weapons.fires.active.length;i++){f.weapons.fire({origin:{...f.sim.player.position,y:at.y+.1},direction:{x:0,y:-.3,z:-1}});f.tick(1/60);}
 expect(f.weapons.fires.active.filter(x=>Math.hypot(x.position.x-fire.x,x.position.y-fire.y)<1).length).toBe(0);expect(f.weapons.hazards.some(h=>h.kind==='gas')).toBe(true);
 }finally{f.dispose();}
});
test('vision toggles, camera captures and parachute deployment do not consume ammunition',()=>{const f=setup();try{for(const id of [44,45]){f.weapons.inventory.select(id);f.weapons.fire(camera);expect(f.weapons.vision).toBeNull();f.tick(1);expect(f.weapons.vision).not.toBeNull();f.weapons.fire(camera);f.tick(1);expect(f.weapons.vision).toBeNull();}f.weapons.inventory.select(43);f.weapons.fire(camera);expect(f.weapons.photoRequested).toBe(true);f.tick(1);f.weapons.inventory.select(46);f.sim.player.grounded=true;expect(f.weapons.fire(camera)).toBe(false);f.sim.player.grounded=false;f.weapons.fire(camera);expect(f.weapons.parachute).toBe(true);f.sim.player.grounded=true;f.tick(.1);expect(f.weapons.parachute).toBe(false);}finally{f.dispose();}});
test('dead and seated players cannot spend ammunition or fire',()=>{const f=setup();try{f.weapons.inventory.select(22);f.sim.player.health=0;expect(f.weapons.fire(camera)).toBe(false);f.sim.player.health=100;f.sim.playerBody.setEnabled(false);expect(f.weapons.fire(camera)).toBe(false);expect(f.weapons.inventory.ammo.get(22)!.clip).toBe(17);}finally{f.dispose();}});
import {readFileSync} from 'node:fs';
import {readWeaponData} from '../src/weapons/weaponData';
const nativeData=readWeaponData(new TextDecoder('windows-1252').decode(readFileSync('public/play/world/files/data/weapon.dat')));
test('native WEAPON.DAT skill levels select clips, fire loops, twin pistols and automatic reloads',()=>{
 const inv=new WeaponInventory();inv.installNative(nativeData);inv.select(22);
 expect(inv.snapshot()).toMatchObject({skill:'poor',magazine:17,clip:17,twin:false,animGroup:'colt45'});expect(inv.interval).toBeCloseTo(.354,4);
 for(let i=0;i<16;i++){expect(inv.fire()).toBe(true);inv.tick(inv.interval);}
 expect(inv.fire()).toBe(true);expect(inv.ammo.get(22)!.clip).toBe(0);expect(inv.reloading).toBe(1);expect(inv.fire()).toBe(false);inv.tick(1.01);expect(inv.ammo.get(22)!.clip).toBe(17);
 inv.practice.set(22,500);expect(inv.snapshot().skill).toBe('standard');expect(inv.interval).toBeCloseTo(.294,4);
 inv.practice.set(22,999);expect(inv.snapshot()).toMatchObject({skill:'hitman',magazine:34,twin:true,animGroup:'colt45pro'});expect(inv.reloadDuration).toBe(2);
 inv.practice.set(28,999);inv.select(32);expect(inv.snapshot()).toMatchObject({skill:'hitman',twin:true,magazine:100});
 inv.select(25);expect(inv.magazine()).toBe(1);inv.fire();expect(inv.reloading).toBeCloseTo(inv.interval,5);expect(inv.interval).toBeGreaterThan(1);
 inv.select(37);expect(inv.interval).toBeCloseTo(1/30,6);inv.select(33);expect(inv.reloadDuration).toBe(1);
});
test('native instant hits apply WEAPON.DAT damage, point-blank shots and accumulated shotgun pellets',()=>{
 const f=setup();try{f.weapons.installNative(nativeData);f.weapons.inventory.practice.set(30,500);f.weapons.inventory.select(30);f.weapons.aiming=true;
  expect(f.weapons.fire(camera)).toBe(true);expect(f.damage()).toBe(30);
  f.tick(1);f.weapons.inventory.select(25);f.weapons.inventory.practice.set(25,500);const before=f.damage();f.weapons.fire(camera);const pellets=f.damage()-before;expect(pellets%10).toBe(0);expect(pellets).toBeGreaterThanOrEqual(30);
  f.tick(2);f.sim.playerBody.setTranslation({x:0,y:1,z:-9.3},true);f.sim.player.position={x:0,y:.1,z:-9.3};f.sim.world.step();f.weapons.inventory.select(24);const close=f.damage();
  // Turned 45° away the victim is outside RequirePistolWhip's 30° cone, so the shot goes off point-blank.
  f.sim.player.heading=Math.PI*1.25;f.weapons.fire({origin:{x:0,y:1.3,z:-8.2},direction:{x:0,y:0,z:-1}});expect(f.damage()-close).toBe(150);
 }finally{f.dispose();}
});
test('twin pistols alternate hands and native reload sounds follow aim offset timings',()=>{
 const f=setup();try{f.weapons.installNative(nativeData);const sounds:string[]=[];f.weapons.onSound=event=>sounds.push(event);f.weapons.inventory.practice.set(22,999);f.weapons.inventory.select(22);
  const hands:string[]=[];for(let i=0;i<4;i++){f.weapons.fire(camera);hands.push(f.weapons.snapshot().hand);f.tick(.4);}expect(hands).toEqual(['right','left','right','left']);
  const a=f.weapons.inventory.ammo.get(22)!;a.clip=1;f.weapons.fire(camera);expect(f.weapons.inventory.reloading).toBe(2);sounds.length=0;
  f.tick(.2);expect(sounds).toEqual([]);f.tick(.1);expect(sounds).toEqual(['reloadA']);f.tick(.4);expect(sounds).toEqual(['reloadA','reloadB']);
 }finally{f.dispose();}
});
test('CShotInfo flames ignite targets for native burn damage and the extinguisher puts them out',()=>{
 const f=setup();try{f.weapons.installNative(nativeData);f.weapons.inventory.select(37);
  for(let i=0;i<10;i++){f.weapons.fire({origin:{x:0,y:1.3,z:-4},direction:{x:0,y:-.05,z:-1}});f.tick(1/15);}
  f.sim.playerBody.setTranslation({x:0,y:1,z:-6},true);f.sim.player.position={x:0,y:.1,z:-6};f.sim.world.step();
  for(let i=0;i<20;i++){f.weapons.fire({origin:{x:0,y:1.3,z:-6},direction:{x:0,y:0,z:-1}});f.tick(1/30);}
  expect(f.weapons.burning.size).toBe(1);const burning=f.damage();f.tick(1);expect(f.damage()-burning).toBeCloseTo(25,0);
  f.weapons.inventory.select(42);for(let i=0;i<30&&f.weapons.burning.size;i++){f.weapons.fire({origin:{x:0,y:1.3,z:-6},direction:{x:0,y:0,z:-1}});f.tick(1/30);}expect(f.weapons.burning.size).toBe(0);
 }finally{f.dispose();}
});
test('first-person weapons fire only in their camera mode; FireSniper sends a 400 m/s CBulletInfo bullet for a second',()=>{
 const f=setup();try{f.weapons.installNative(nativeData);f.weapons.aiming=true;
  // A wall between the camera and the target: CBulletInfo::Update flies on through what it hits.
  f.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(3,3,.1).setTranslation(0,1,-4));f.sim.world.step();
  f.weapons.inventory.select(34);
  expect(f.weapons.fire(camera)).toBe(false);expect(f.weapons.inventory.ammo.get(34)!.clip).toBe(1);
  f.weapons.firstPerson='sniper';
  expect(f.weapons.fire(camera)).toBe(true);expect(f.damage()).toBe(0);expect(f.weapons.snapshot().bullets).toBe(1);
  // 6.7 a frame at 60 fps: the second frame's stretch meets the wall first, the third the target.
  f.weapons.tick(1/60);f.sim.world.step();expect(f.damage()).toBe(0);
  f.weapons.tick(1/60);f.sim.world.step();expect(f.damage()).toBe(0);
  f.weapons.tick(1/60);f.sim.world.step();expect(f.damage()).toBe(125);
  // The ped it hit is not hit again, and the bullet is gone after its second.
  f.tick(.5);expect(f.damage()).toBe(125);expect(f.weapons.snapshot().bullets).toBe(1);
  f.tick(.6);expect(f.weapons.snapshot().bullets).toBe(0);
  f.weapons.firstPerson=undefined;f.weapons.inventory.select(35);
  expect(f.weapons.fire(camera)).toBe(false);expect(f.weapons.projectiles).toHaveLength(0);
  // CWeapon::FireProjectile starts the rocket one unit along the camera's front.
  f.weapons.firstPerson='rocket';expect(f.weapons.fire(camera)).toBe(true);
  const rocket=f.weapons.projectiles[0],p=f.sim.player.position;
  expect(rocket.position.z).toBeCloseTo(p.z-1,6);expect(rocket.velocity.z).toBeLessThan(0);expect(Math.abs(rocket.velocity.x)).toBeLessThan(1e-9);
  f.weapons.firstPerson=undefined;f.weapons.inventory.select(43);
  expect(f.weapons.fire(camera)).toBe(false);expect(f.weapons.photoRequested).toBe(false);
  f.weapons.firstPerson='camera';expect(f.weapons.fire(camera)).toBe(true);expect(f.weapons.photoRequested).toBe(true);
 }finally{f.dispose();}
});
test('the knife offers a stealth kill only below move blend 1.9, not sprinting and between attacks, aimed through the crosshair',()=>{
 const sim=new Simulation();const calls:unknown[]=[];
 const weapons=new WeaponSystem(sim,()=>({damageCollider:()=>false,targets:()=>[],frighten:()=>{},stealthTarget:(_origin,aim)=>{calls.push(aim);return {id:1,officer:false,handle:0,position:{x:0,y:0,z:1},heading:0};}}),()=>undefined);
 try{
  weapons.installNative(nativeData);weapons.inventory.select(4);sim.player.grounded=true;
  let move={blendRatio:1,sprinting:false};weapons.playerMove=()=>move;
  expect(weapons.stealthTarget()).toBeUndefined();
  weapons.aiming=true;weapons.tick(1/60,{origin:{x:0,y:2,z:-2},direction:{x:0,y:0,z:1}});
  expect(weapons.stealthTarget()?.id).toBe(1);expect(calls.at(-1)).toEqual({origin:{x:0,y:2,z:-2},direction:{x:0,y:0,z:1}});
  move={blendRatio:1.9,sprinting:false};expect(weapons.stealthTarget()).toBeUndefined();
  move={blendRatio:1,sprinting:true};expect(weapons.stealthTarget()).toBeUndefined();
  move={blendRatio:1,sprinting:false};weapons.inventory.cooldown=.2;expect(weapons.stealthTarget()).toBeUndefined();
  weapons.inventory.cooldown=0;weapons.inventory.select(5);expect(weapons.stealthTarget()).toBeUndefined();
 }finally{weapons.dispose();sim.dispose();}
});
test('a grenade press winds up 0.2 s, throws at anim loop 2 fire and counts the held button into m_fAttackButtonCounter',()=>{
 const f=setup();try{
  f.weapons.inventory.select(16);f.weapons.throwHeld=true;
  expect(f.weapons.fire(camera)).toBe(true);expect(f.weapons.fire(camera)).toBe(false);expect(f.weapons.throwing?.clip).toBe('weapon_start_throw');
  expect(f.weapons.inventory.ammo.get(16)!.clip).toBe(f.weapons.inventory.magazine()||f.weapons.inventory.ammo.get(16)!.clip);
  f.tick(.15);expect(f.weapons.throwing?.clip).toBe('weapon_start_throw');expect(f.weapons.projectiles).toHaveLength(0);
  f.tick(.1);expect(f.weapons.throwing?.clip).toBe('weapon_throw');expect(f.weapons.throwing?.fired).toBe(false);
  // Anim loop 2 fire is frame 8 (0.2667 s) into WEAPON_throw.
  let fired=-1;for(let i=0;i<40&&fired<0;i++){f.tick(1/60);if(f.weapons.throwing?.fired)fired=i;}
  expect(fired).toBeGreaterThanOrEqual(0);expect(f.weapons.projectiles).toHaveLength(1);
  const held=f.weapons.throwing!.heldMs;expect(held).toBeGreaterThan(400);expect(held).toBeLessThan(533);
  expect(f.weapons.attackButtonCounter).toBeCloseTo(held/20,1);expect(f.weapons.lastThrowForce).toBeCloseTo(held/20*.0375,3);
  // The task ends with WEAPON_throw (0.87 s) and the counter clears; a tap counts nothing.
  f.tick(1);expect(f.weapons.throwing).toBeNull();expect(f.weapons.attackButtonCounter).toBe(0);
  f.weapons.throwHeld=false;f.weapons.inventory.cooldown=0;expect(f.weapons.fire(camera)).toBe(true);f.tick(.6);
  expect(f.weapons.projectiles.length).toBeGreaterThanOrEqual(1);expect(f.weapons.throwing?.heldMs).toBe(0);expect(f.weapons.lastThrowForce).toBe(0);
 }finally{f.dispose();}
});

test('a throw ends with nothing thrown once the weapon is switched away or CJ is knocked down (CTaskSimpleThrowProjectile)',()=>{
 const f=setup();try{
  f.weapons.inventory.select(16);const grenades=f.weapons.inventory.ammo.get(16)!.clip;
  expect(f.weapons.fire(camera)).toBe(true);f.tick(.1);f.weapons.inventory.select(0);f.tick(1);
  expect(f.weapons.throwing).toBeNull();expect(f.weapons.projectiles).toHaveLength(0);expect(f.weapons.inventory.ammo.get(16)!.clip).toBe(grenades);
  f.weapons.inventory.select(16);f.weapons.inventory.cooldown=0;expect(f.weapons.fire(camera)).toBe(true);f.tick(.1);f.sim.knockdown=1;f.tick(.5);
  expect(f.weapons.throwing).toBeNull();expect(f.weapons.projectiles).toHaveLength(0);expect(f.weapons.inventory.ammo.get(16)!.clip).toBe(grenades);
 }finally{f.dispose();}
});
test('a thrown satchel gives the detonator one charge, the last one hands it over, and the detonator spends it (CWeapon::Fire)',()=>{
 const f=setup();try{
  const inv=f.weapons.inventory;inv.ammo.set(39,{clip:1,reserve:0});inv.ammo.set(40,{clip:0,reserve:0});
  inv.select(39);f.weapons.fire(camera);f.tick(.6);
  expect(f.weapons.projectiles).toHaveLength(1);
  // The last satchel is gone, so the hand is on the detonator with its charge.
  expect(inv.selected).toBe(40);expect(inv.ammo.get(40)!.clip).toBe(1);
  f.weapons.fire(camera);expect(f.weapons.explosions).toBeGreaterThan(0);
  expect(inv.ammo.get(40)!.clip).toBe(0);
  f.tick(1);expect(f.weapons.fire(camera)).toBe(false);
 }finally{f.dispose();}
});

test('a wrecked aircraft keeps throwing rockets at itself for its 3000 ms (CExplosion::Update)',()=>{
 const f=setup();const spy=vi.spyOn(Math,'random').mockReturnValue(0);
 try{
  f.weapons.vehicleExplosion({x:0,y:5,z:-20},'aircraft',()=>({x:0,y:5,z:-20}));
  expect(f.weapons.explosions).toBe(1);
  f.tick(1);const afterSecond=f.weapons.explosions;expect(afterSecond).toBeGreaterThan(20);
  f.tick(3);const done=f.weapons.explosions;f.tick(1);expect(f.weapons.explosions).toBe(done);
  // A boat's EXPLOSION_BOAT has no follow-ups.
  f.weapons.vehicleExplosion({x:0,y:5,z:-20},'boat');f.tick(1);expect(f.weapons.explosions).toBe(done+1);
 }finally{spy.mockRestore();f.dispose();}
});

test('CEventDamage::ReportCriminalEvent queues a crime by the weapon that did the damage',()=>{
 expect(criminalEventCrime(0,false)).toBe(CRIME.damagedPed);expect(criminalEventCrime(9,true)).toBe(CRIME.damagedCop);
 // The dildos, vibrators, flowers and cane count as damage to a car, as the guns do.
 expect(criminalEventCrime(10,false)).toBe(CRIME.damageCar);expect(criminalEventCrime(15,true)).toBe(CRIME.damageCopCar);
 expect(criminalEventCrime(22,false)).toBe(CRIME.damageCar);expect(criminalEventCrime(41,false)).toBe(CRIME.damageCar);
 // The extinguisher and the parachute queue nothing.
 expect(criminalEventCrime(42,false)).toBe(CRIME.none);expect(criminalEventCrime(46,false)).toBe(CRIME.none);
});
