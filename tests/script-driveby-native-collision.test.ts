import {beforeAll,expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {GangDriveBy} from '../src/simulation/GangDriveBy';
import {newScriptDriveBy,stepScriptDriveBy,type ScriptDriveByWorld} from '../src/simulation/scriptDriveBy';
import {nativeWeaponInfo,readWeaponData} from '../src/weapons/weaponData';

beforeAll(async()=>RAPIER.init());
const data=readWeaponData(readFileSync('public/play/world/files/data/weapon.dat','utf8')),info=nativeWeaponInfo(data,28,1)!;
test.each([false,true])('script drive-bys use the shared native trace and carry the piece to %s/player damage',player=>{
 const sim=new Simulation(),body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,0)),ped=sim.world.createCollider(RAPIER.ColliderDesc.ball(.2).setTranslation(0,1,-5));
 const collider=player?sim.playerCollider:ped,piece=player?7:5,hitPed=vi.fn((..._args:Parameters<ScriptDriveByWorld['hitPed']>)=>true),query=vi.fn((..._args:Parameters<NonNullable<ScriptDriveByWorld['bulletLine']>>)=>({collider,pedPiece:piece,timeOfImpact:5,normal:{x:0,y:0,z:1},featureType:RAPIER.FeatureType.Face,featureId:0}));
 const finish=vi.fn((accepted:boolean)=>{expect(accepted).toBe(true);if(player)expect(sim.damageEvents).toHaveLength(1);else expect(hitPed).toHaveBeenCalledOnce();}),prepare=vi.fn(()=>finish);
 const world:ScriptDriveByWorld={sim,cars:()=>[],targetPosition:()=>({x:0,y:1,z:-10}),hitPed,bulletLine:query,prepareBulletImpact:prepare,random:()=>.5},driveby=newScriptDriveBy({kind:'point',x:0,y:1,z:-10},100,100,true);
 try{
  for(let i=0;i<90&&!driveby.shots;i++)stepScriptDriveBy(driveby,{car:{body}} as any,info,1,1/30,world);
  expect(driveby.shots).toBe(1);expect(query).toHaveBeenCalledOnce();expect(query.mock.calls[0][3]).toBe(body);expect(prepare).toHaveBeenCalledOnce();expect(finish).toHaveBeenCalledExactlyOnceWith(true);
  if(player){expect(hitPed).not.toHaveBeenCalled();expect(sim.damageEvents.at(-1)).toMatchObject({piece:7,weapon:28});}
  else{expect(hitPed).toHaveBeenCalledOnce();expect(hitPed.mock.calls[0][5]).toBe(5);expect(sim.damageEvents).toEqual([]);}
 }finally{sim.dispose();}
});
test.each([false,true])('gang-car rounds propagate native collision pieces to an intervening ped or CJ (player=%s)',player=>{
 const sim=new Simulation(),body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,.5,0)),ped=sim.world.createCollider(RAPIER.ColliderDesc.ball(.2).setTranslation(5,1,-5));
 sim.player.position={x:0,y:0,z:-10};sim.playerBody.setTranslation({x:0,y:.9,z:-10},true);sim.playerBody.setNextKinematicTranslation({x:0,y:.9,z:-10});sim.world.step();
 const collider=player?sim.playerCollider:ped,hitPed=vi.fn((..._args:Parameters<ScriptDriveByWorld['hitPed']>)=>true),query=vi.fn((..._args:Parameters<NonNullable<ScriptDriveByWorld['bulletLine']>>)=>({collider,pedPiece:player?7:5,timeOfImpact:5,normal:{x:0,y:0,z:1},featureType:RAPIER.FeatureType.Face,featureId:0}));
 const finish=vi.fn((accepted:boolean)=>{expect(accepted).toBe(true);if(player)expect(sim.damageEvents).toHaveLength(1);else expect(hitPed).toHaveBeenCalledOnce();}),prepare=vi.fn(()=>finish);
 const host={sim,fleet:{cars:[]},gunCache:{info,reloadSeconds:1},bulletLine:query,hitPed,prepareBulletImpact:prepare},unit={car:{car:{body}},shooter:{gunState:{time:0,rounds:info.clip,reload:0,active:false},side:'right',shots:0}};
 try{
  for(let i=0;i<90&&!unit.shooter.shots;i++)(GangDriveBy.prototype as any).stepShooter.call(host,unit,1/30,sim.player.position);
  expect(unit.shooter.shots).toBe(1);expect(query).toHaveBeenCalledOnce();expect(query.mock.calls[0][3]).toBe(body);expect(prepare).toHaveBeenCalledOnce();expect(finish).toHaveBeenCalledExactlyOnceWith(true);
  if(player){expect(hitPed).not.toHaveBeenCalled();expect(sim.damageEvents.at(-1)).toMatchObject({piece:7,weapon:28});}
  else{expect(hitPed).toHaveBeenCalledOnce();expect(hitPed.mock.calls[0][5]).toBe(5);expect(sim.damageEvents).toEqual([]);}
 }finally{sim.dispose();}
});
