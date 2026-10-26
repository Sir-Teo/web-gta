import {beforeAll,expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {readSurfaceAudio} from '../src/assets/surfaceAudio';
import {NativeCollisionAudio,SURFACE} from '../src/audio/native/NativeCollisionAudio';
import {NativeAudioEnvironment} from '../src/audio/native/NativeSound';
import {NativeSoundManager} from '../src/audio/native/NativeSoundManager';
import {SLOT,type NativeBankLoader} from '../src/audio/native/NativeBankLoader';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
beforeAll(async()=>RAPIER.init());
function fixture(){
 const sim=new Simulation();sim.playerCollider.setEnabled(false);const body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,-5)),collider=sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.5,.5,.5),body);
 let hit:any={collider,timeOfImpact:4.5,normal:{x:0,y:0,z:1},featureType:RAPIER.FeatureType.Face,featureId:0};
 const crowd:any={damageCollider:vi.fn(()=>false),targets:()=>[],frighten(){},bulletLine:vi.fn(()=>hit)},fleet:any={cars:[],boats:new Set(),bikes:new Set(),planes:new Set()},weapons=new WeaponSystem(sim,()=>crowd,()=>fleet),physical=vi.fn(),ped=vi.fn(),water=vi.fn(),gunshot=vi.fn(),blood=vi.fn();
 weapons.onBulletHit=physical;weapons.onPedBulletHit=ped;weapons.onWaterBulletHit=water;weapons.fx={ready:true,gunshot,bulletHit:blood,explosion:vi.fn(),areaEffect:vi.fn()};sim.world.step();
 return {sim,body,collider,crowd,fleet,weapons,physical,ped,water,gunshot,blood,hit:(value:any)=>{hit=value;},normal:(n:any)=>{hit.normal=n;},fire:()=>weapons.fireInstantHitRound({x:0,y:1,z:0},{x:0,y:1,z:-10},15),dispose(){weapons.dispose();sim.dispose();}};
}
test('a front-facing anonymous round reports the original physical surface contact without impact particles',()=>{
 const f=fixture();try{f.fire();expect(f.physical).toHaveBeenCalledWith(expect.objectContaining({collider:f.collider}),{x:0,y:1,z:-4.5},90,false);expect(f.ped).not.toHaveBeenCalled();expect(f.gunshot).not.toHaveBeenCalled();expect(f.blood).not.toHaveBeenCalled();}finally{f.dispose();}
});
for(const normal of [{x:1,y:0,z:0},{x:0,y:0,z:-1}])test(`tangent/back-face contacts remain silent: ${JSON.stringify(normal)}`,()=>{
 const f=fixture();try{f.normal(normal);f.fire();expect(f.physical).not.toHaveBeenCalled();expect(f.ped).not.toHaveBeenCalled();}finally{f.dispose();}
});
for(const health of [100,0])test(`recognized pedestrian contact reports flesh even with no accepted wound (health ${health})`,()=>{
 const f=fixture(),victim={health,collider:f.collider},apply=vi.fn(()=>false);try{
  f.crowd.instantHitRound=(...args:any[])=>WorldPedestrians.prototype.instantHitRound.apply({people:[victim],applyNpcBullet:apply} as any,args as any);f.fire();expect(f.ped).toHaveBeenCalledWith({x:0,y:1,z:-4.5},90);expect(f.physical).not.toHaveBeenCalled();expect(apply).toHaveBeenCalledTimes(health?1:0);
 }finally{f.dispose();}
});
test('CJ bullet proofing rejects the wound but keeps the flesh contact sound',()=>{
 const f=fixture();try{f.hit({collider:f.sim.playerCollider,timeOfImpact:4.5,normal:{x:0,y:0,z:1},featureType:RAPIER.FeatureType.Face});f.sim.playerProofs={bullet:true,fire:false,explosion:false,collision:false,melee:false};f.fire();expect(f.sim.player.health).toBe(100);expect(f.ped).toHaveBeenCalledWith({x:0,y:1,z:-4.5},90);}finally{f.dispose();}
});
test('vehicle contact snapshots its material kind before damage can retire its Rapier body',()=>{
 const f=fixture(),order:string[]=[];try{f.fleet.cars.push({car:{body:f.body},damage:vi.fn(()=>{order.push('damage');f.sim.world.removeRigidBody(f.body);return false;})});f.weapons.onBulletHit=(...args:any[])=>{order.push('audio');f.physical(...args);};f.fire();expect(order).toEqual(['damage','audio']);expect(f.physical.mock.calls[0][3]).toBe(true);}finally{f.dispose();}
});
for(const level of [0,2,undefined])test(`a miss uses the original endpoint water probe (level ${level})`,()=>{
 const f=fixture(),query=vi.fn(()=>level);try{f.hit(null);f.weapons.waterLevel=query;f.fire();expect(query).toHaveBeenCalledWith(0,10,11,true);if(level===undefined)expect(f.water).not.toHaveBeenCalled();else expect(f.water).toHaveBeenCalledWith({x:0,y:level,z:-10});expect(f.physical).not.toHaveBeenCalled();expect(f.blood).not.toHaveBeenCalled();}finally{f.dispose();}
});
test('a solid hit does not also probe water at its original endpoint',()=>{
 const f=fixture(),query=vi.fn(()=>0);try{f.weapons.waterLevel=query;f.fire();expect(query).not.toHaveBeenCalled();expect(f.water).not.toHaveBeenCalled();}finally{f.dispose();}
});

function collisionAudio(){
 const flags=readSurfaceAudio(readFileSync('public/play/world/files/surfaud.dat','utf8')).byId,slots={isSoundBankLoaded:()=>true,sound:()=>({samples:new Float32Array(8000),sampleRate:8000,headroom:0,loopStart:-1})},manager=new NativeSoundManager(new NativeAudioEnvironment(),slots,()=>.25),audio=new NativeCollisionAudio(manager,slots as unknown as NativeBankLoader,()=>.25,()=>-10,surface=>flags.get(surface));
 return {manager,audio,sounds:()=>manager.sounds.filter(s=>s.inUse&&s.slot===SLOT.bulletHits)};
}
test('the original water surface flags select native water samples, volume and rolloff for a missed round',()=>{
 const f=fixture(),a=collisionAudio();try{f.hit(null);f.weapons.waterLevel=()=>0;f.weapons.onWaterBulletHit=p=>a.audio.reportBulletHit(SURFACE.waterShallow,{x:p.x,y:-p.z,z:p.y},0);f.fire();expect(a.sounds()).toHaveLength(1);const sound=a.sounds()[0];expect(sound.sound).toBeGreaterThanOrEqual(16);expect(sound.sound).toBeLessThanOrEqual(18);expect(sound.currPos).toEqual({x:0,y:10,z:0});expect(sound.volume).toBe(-4);expect(sound.rollOff).toBe(2);
 }finally{f.dispose();}
});
test('the native collision backend plays its flesh sample even when CJ rejects anonymous bullet damage',()=>{
 const f=fixture(),a=collisionAudio();try{f.hit({collider:f.sim.playerCollider,timeOfImpact:4.5,normal:{x:0,y:0,z:1},featureType:RAPIER.FeatureType.Face});f.sim.playerProofs={bullet:true,fire:false,explosion:false,collision:false,melee:false};f.weapons.onPedBulletHit=(p,angle)=>a.audio.reportBulletHit(SURFACE.ped,{x:p.x,y:-p.z,z:p.y},angle);f.fire();expect(f.sim.player.health).toBe(100);expect(a.sounds()).toHaveLength(1);expect(a.sounds()[0].sound).toBeGreaterThanOrEqual(7);expect(a.sounds()[0].sound).toBeLessThanOrEqual(9);expect(a.sounds()[0].volume).toBe(-10);
 }finally{f.dispose();}
});
