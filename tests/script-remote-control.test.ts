import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';

const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
type Car={health:number;disposed:boolean;position:{x:number;y:number;z:number}};
function pending(){let resolve!:(car:Car|undefined)=>void;const promise=new Promise<Car|undefined>(r=>resolve=r);return {promise,resolve};}
const car=():Car=>({health:1000,disposed:false,position:{x:10,y:20,z:12}});
function setup(spawn:()=>Promise<Car|undefined>){
 const control=vi.fn(),remove=vi.fn((v:Car)=>{v.disposed=true;}),explode=vi.fn((v:Car)=>{v.health=0;});
 const host={controlRemoteVehicle:control,explodeRemoteVehicle:explode,groundLevel:vi.fn(()=>12),
  spawnScriptVehicle:vi.fn(spawn),scriptVehiclePosition:(v:Car)=>v.position,scriptVehicleHeading:()=>0,
  scriptVehicleAlive:(v:Car)=>!v.disposed,scriptVehicleHealth:(v:Car)=>v.health,removeScriptVehicle:remove,
  playerCameraState:()=>({inVehicle:false,enteringCar:false,exitingCar:false}),playerState:()=> 'playing',
  playerPed:()=>({health:100,position:{x:0,y:0,z:12}})};
 const mission=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,host as any),world=mission.runtime.world!;
 const process=(now:number,previous=0)=>{(mission as any).clockMs=now;(mission as any).processRemote(now,previous);};
 return {mission,world,host,control,remove,explode,process};
}

test('GIVE reserves a stable remote handle while loading, uses the native ground query, then activates that entity',async()=>{
 const loading=pending(),f=setup(()=>loading.promise);
 f.world.giveRemoteControlledModelToPlayer!(0,10,20,30,90,464);
 const handle=f.world.getRemoteControlledCar!(0);
 expect(handle).toBeGreaterThan(0);expect(f.world.isPlayerInRemoteMode!(0)).toBe(true);
 expect(f.host.groundLevel).toHaveBeenCalledWith(10,20,32);
 expect(f.host.spawnScriptVehicle).toHaveBeenCalledExactlyOnceWith(464,{x:10,y:20,z:12},90);
 expect(f.mission.runtime.game.camera.targetEntity).toEqual({kind:'vehicle',handle});
 const entity=car();loading.resolve(entity);await f.mission.vehicles.whenSettled(handle);await Promise.resolve();
 expect(f.control).toHaveBeenLastCalledWith(entity);expect(f.world.getRemoteControlledCar!(0)).toBe(handle);
});

test('REMOVE while loading cancels the eventual entity and never activates it after the hand-back',async()=>{
 const loading=pending(),f=setup(()=>loading.promise);
 f.world.giveRemoteControlledModelToPlayer!(0,10,20,30,0,441);const handle=f.world.getRemoteControlledCar!(0);
 f.world.removeRCBuggy!();expect(f.world.getRemoteControlledCar!(0)).toBe(handle);
 f.process(1000,999);expect(f.mission.remote.inRemoteMode).toBe(true);
 f.process(2001,2000);expect(f.world.getRemoteControlledCar!(0)).toBe(-1);
 expect(f.world.isPlayerInRemoteMode!(0)).toBe(false);
 const entity=car();loading.resolve(entity);await f.mission.vehicles.whenSettled(handle);await Promise.resolve();
 expect(entity.disposed).toBe(true);expect(f.remove).toHaveBeenCalledOnce();
 expect(f.control.mock.calls.every(([v])=>v===undefined)).toBe(true);expect(f.explode).not.toHaveBeenCalled();
});

test('late completion of an earlier GIVE cannot steal the replacement vehicle control or camera',async()=>{
 const a=pending(),b=pending();let request=0;const f=setup(()=>request++?b.promise:a.promise);
 f.world.giveRemoteControlledModelToPlayer!(0,1,2,3,0,441);const first=f.world.getRemoteControlledCar!(0);
 f.world.giveRemoteControlledModelToPlayer!(0,4,5,6,0,464);const second=f.world.getRemoteControlledCar!(0);
 const current=car();b.resolve(current);await f.mission.vehicles.whenSettled(second);await Promise.resolve();
 a.resolve(car());await f.mission.vehicles.whenSettled(first);await Promise.resolve();
 expect(f.control).toHaveBeenLastCalledWith(current);expect(f.world.getRemoteControlledCar!(0)).toBe(second);
 expect(f.mission.runtime.game.camera.targetEntity).toEqual({kind:'vehicle',handle:second});
});

test('failed loading returns the camera and remote mode to CJ',async()=>{
 const f=setup(async()=>undefined);f.world.giveRemoteControlledModelToPlayer!(0,1,2,3,0,441);
 await f.mission.vehicles.whenSettled(f.world.getRemoteControlledCar!(0));await Promise.resolve();
 expect(f.world.isPlayerInRemoteMode!(0)).toBe(false);expect(f.world.getRemoteControlledCar!(0)).toBe(-1);
 expect(f.mission.runtime.game.camera.lookingAtPlayer).toBe(true);expect(f.control).toHaveBeenLastCalledWith(undefined);
});

test('TAKE waits for a pending vehicle without side effects, then adopts it without another spawn',async()=>{
 const loading=pending(),f=setup(()=>loading.promise),handle=f.mission.vehicles.create(441,{x:1,y:2,z:3});
 expect(()=>f.world.takeRemoteControlOfCar!(0,handle)).toThrow(/vehicle/);
 expect(f.control).not.toHaveBeenCalled();expect(f.world.isPlayerInRemoteMode!(0)).toBe(false);
 const entity=car();loading.resolve(entity);await f.mission.vehicles.whenSettled(handle);
 f.world.takeRemoteControlOfCar!(0,handle);await Promise.resolve();await Promise.resolve();
 expect(f.control).toHaveBeenLastCalledWith(entity);expect(f.host.spawnScriptVehicle).toHaveBeenCalledOnce();
});

test('manual and contact switches gate their own detonation paths, and a destroyed target still hands back control',async()=>{
 const entity=car(),f=setup(async()=>entity);f.world.giveRemoteControlledModelToPlayer!(0,1,2,3,0,441);
 await f.mission.vehicles.whenSettled(f.world.getRemoteControlledCar!(0));await Promise.resolve();
 f.world.setEnableRcDetonate!(false);f.world.setEnableRcDetonateOnContact!(false);
 expect(f.mission.detonateRemote()).toBe(false);expect(f.mission.detonateRemote(true)).toBe(false);
 f.world.setEnableRcDetonateOnContact!(true);expect(f.mission.detonateRemote(true)).toBe(true);
 expect(f.explode).toHaveBeenCalledExactlyOnceWith(entity);expect(f.mission.remote.createExplosion).toBe(true);
 expect(f.mission.detonateRemote()).toBe(false);f.process(2001,2000);
 expect(f.remove).toHaveBeenCalledExactlyOnceWith(entity);expect(f.world.isPlayerInRemoteMode!(0)).toBe(false);
});

test('SET_HELI_STABILISER preserves the native vehicle flag independently of remote control',async()=>{
 const entity={...car(),heliMinimumTilt:false},f=setup(async()=>entity);
 const h=f.mission.vehicles.create(501,{x:1,y:2,z:30});await f.mission.vehicles.whenSettled(h);
 f.world.setHeliStabiliser!(h,true);expect(entity.heliMinimumTilt).toBe(true);
 expect(f.world.isPlayerInRemoteMode!(0)).toBe(false);
 f.world.setHeliStabiliser!(h,false);expect(entity.heliMinimumTilt).toBe(false);
});
