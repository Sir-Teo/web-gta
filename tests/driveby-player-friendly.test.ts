import {beforeAll,expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {NATIVE_PLAYER_DAMAGE_MULT,Simulation} from '../src/simulation/Simulation';
import {GangDriveBy} from '../src/simulation/GangDriveBy';
import {newScriptDriveBy,stepScriptDriveBy,type ScriptDriveByWorld} from '../src/simulation/scriptDriveBy';
import {nativeWeaponInfo,readWeaponData} from '../src/weapons/weaponData';

beforeAll(async()=>RAPIER.init());const info=nativeWeaponInfo(readWeaponData(readFileSync('public/play/world/files/data/weapon.dat','utf8')),28,1)!;
for(const emitter of ['script','gang'])for(const friendly of [false,true])for(const allowed of [false,true])test(`${emitter} allowed=${allowed} player hit carries friendly=${friendly} after acceptance`,()=>{
 const sim=new Simulation(),body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,.5,0));sim.player.health=100;sim.player.armour=0;sim.player.position={x:0,y:0,z:-10};sim.playerBody.setTranslation({x:0,y:.9,z:-10},true);sim.playerBody.setNextKinematicTranslation({x:0,y:.9,z:-10});sim.world.step();
 const source={pedType:'GANG1'},friendlyWithPlayer=vi.fn((_source:any)=>friendly),finish=vi.fn(),bulletLine=()=>({collider:sim.playerCollider,pedPiece:3,timeOfImpact:5,normal:{x:0,y:0,z:1},featureType:RAPIER.FeatureType.Face,featureId:0}),world:ScriptDriveByWorld&{friendlyWithPlayer:(source:any)=>boolean}={sim,cars:()=>[],targetPosition:()=>sim.player.position,hitPed:()=>false,bulletLine,prepareBulletImpact:()=>finish,random:()=>.5,canDamagePlayer:()=>allowed,friendlyWithPlayer},d=newScriptDriveBy({kind:'point',x:0,y:1,z:-10},100,100,true),unit={gang:0,car:{car:{body}},shooter:{gunState:{time:0,rounds:info.clip,reload:0,active:false},side:'right',shots:0}};
 try{for(let i=0;i<90&&!(emitter==='script'?d.shots:unit.shooter.shots);i++){if(emitter==='script')stepScriptDriveBy(d,unit.car as any,info,1,1/30,world,source);else (GangDriveBy.prototype as any).stepShooter.call({...world,fleet:{cars:[]},gunCache:{info,reloadSeconds:1}},unit,1/30,sim.player.position);}
  if(!allowed){expect(friendlyWithPlayer).not.toHaveBeenCalled();expect(sim.player.health).toBe(100);expect(sim.damageEvents).toHaveLength(0);expect(finish).toHaveBeenCalledExactlyOnceWith(false);return;}
  const scaled=Math.fround(Math.fround(info.damage)*NATIVE_PLAYER_DAMAGE_MULT),damage=friendly?Math.min(Math.fround(scaled*Math.fround(.1)),12.5):scaled;expect(friendlyWithPlayer).toHaveBeenCalledOnce();expect(friendlyWithPlayer.mock.calls[0][0]).toMatchObject(source);expect(sim.player.health).toBe(Math.fround(100-damage));expect(sim.damageEvents.at(-1)).toMatchObject({health:damage,died:false});expect(finish).toHaveBeenCalledExactlyOnceWith(true);
 }finally{sim.dispose();}
});
