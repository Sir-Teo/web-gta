import {Quaternion,Vector3,type PerspectiveCamera} from 'three';
import type {WorldCar} from '../../simulation/WorldCar';
import type {WorldPlane} from '../../simulation/WorldPlane';
import type {WorldBike} from '../../simulation/WorldBike';
import type {WorldBoat} from '../../simulation/WorldBoat';
import type {SurfaceAudioFlags} from '../../assets/surfaceAudio';
import type {NativeCamera,NativeVec} from './NativeSound';
import type {NativeVehicleAudioInput} from './NativeVehicleAudio';
/** Browser (x, y up, z south) to native (x, y north, z up). */
const native=(v:{x:number;y:number;z:number}):NativeVec=>({x:v.x,y:-v.z,z:v.y});
const q=new Quaternion(),v=new Vector3();
function axes(rotation:{x:number;y:number;z:number;w:number}){
 q.set(rotation.x,rotation.y,rotation.z,rotation.w);
 return {right:native(v.set(1,0,0).applyQuaternion(q)),forward:native(v.set(0,0,-1).applyQuaternion(q)),up:native(v.set(0,1,0).applyQuaternion(q))};
}
/** TheCamera for CAEAudioEnvironment: on-screen right, forward and up in native space. */
export function nativeAudioCamera(camera:PerspectiveCamera,player:{x:number;y:number;z:number},firstPerson:boolean):NativeCamera{
 camera.updateMatrixWorld();
 const e=camera.matrixWorld.elements,right=native({x:e[0],y:e[1],z:e[2]}),up=native({x:e[4],y:e[5],z:e[6]}),forward=native({x:-e[8],y:-e[9],z:-e[10]});
 return {position:native(camera.position),right,forward,up,firstPerson,playerPosition:native(player),justSwitched:false};
}
/** CAutomobile state for the vehicle audio entity. Parked cars have their engines off; the player's and AI-driven cars run, and
 * a car the player stepped out of keeps idling (WorldCar.engineRunning). */
export function worldCarAudioInput(car:WorldCar,playerAlive:boolean,surfaces?:ReadonlyMap<number,SurfaceAudioFlags>):NativeVehicleAudioInput{
 const body=car.car.body,h=car.assets.handling,a=car.audio,s=surfaces?.get(a.contactSurface),lin=body.linvel();
 return {position:native(body.translation()),...axes(body.rotation()),moveSpeed:{x:lin.x/50,y:-lin.z/50,z:lin.y/50},
  status:car.wrecked?'wrecked':car.occupied?'player':car.autopilot?'physics':'abandoned',
  playerDriver:car.occupied,playerInVehicle:car.occupied,playerAlive,engineOn:!car.wrecked&&(car.occupied||!!car.autopilot||!!car.engineRunning),
  gasPedal:car.gasPedal,brakePedal:a.brakePedal,handbrake:a.handbrake,gear:car.gear,padAccelerate:car.occupied?a.accelerate:0,padBrake:car.occupied?a.brake:0,
  health:car.health,drowning:car.drowning,underwater:false,towing:false,nitro:car.car.nitro.burning,horn:car.horn,sirenOrAlarm:car.siren,alarmState:car.alarm>0?1:0,
  transmission:{driveType:h.values.driveType,maxVelocity:h.values.maxVelocity,maxReverseVelocity:h.maxReverseVelocity,numberOfGears:h.values.gears,gears:h.gears},
  wheels:{states:a.states,counts:a.counts,contactWheels:a.contactWheels,driveOnGround:a.driveOnGround,driveOnGroundLastFrame:a.driveOnGroundLastFrame,spinForAudio:a.spinForAudio,burst:a.burst},
  contactSurface:{grass:!!(s?.grass||s?.longGrass),wet:!!(s?.gravel||s?.sand||s?.water)}};
}
/** CBike state for the vehicle audio entity (motorbikes; the quad is an automobile to the audio). A parked bike's engine
 * is off; the player's and a script-driven one's run. The pad's brake is the reverse pedal and the handbrake its brake,
 * as for a car; bPlayerBoost is never set (CBike::ProcessControlInputs is unreversed). */
export function worldBikeAudioInput(bike:WorldBike,playerAlive:boolean):NativeVehicleAudioInput{
 const body=bike.body,h=bike.assets.handling,a=bike.audio,lin=body.linvel(),wheels=bike.occupied||!!bike.autopilot;
 return {position:native(body.translation()),...axes(body.rotation()),moveSpeed:{x:lin.x/50,y:-lin.z/50,z:lin.y/50},
  status:bike.wrecked?'wrecked':bike.occupied?'player':bike.autopilot?'physics':'abandoned',
  playerDriver:bike.occupied,playerInVehicle:bike.occupied,playerAlive,engineOn:!bike.wrecked&&wheels,
  gasPedal:bike.gasPedal,brakePedal:a.brake,handbrake:bike.brake,gear:bike.gear,
  padAccelerate:bike.occupied?Math.max(0,bike.throttle):0,padBrake:bike.occupied?Math.max(0,-bike.throttle):0,
  health:bike.health,drowning:false,underwater:false,towing:false,horn:bike.horn,sirenOrAlarm:bike.siren,alarmState:0,
  transmission:{driveType:h.values.driveType,maxVelocity:h.values.maxVelocity,maxReverseVelocity:h.maxReverseVelocity,numberOfGears:h.values.gears,gears:h.gears},
  wheels:wheels?{states:a.states,counts:a.counts,contactWheels:a.contactWheels,driveOnGround:a.driveOnGround,driveOnGroundLastFrame:a.driveOnGroundLastFrame,spinForAudio:a.spinForAudio,burst:a.burst}:undefined,
  bike:{leanAngle:bike.lean,playerBoost:false}};
}
/** CBoat state for the vehicle audio entity. Only CJ drives boats here, so an empty one's engine is off (bEngineOn). */
export function worldBoatAudioInput(boat:WorldBoat,playerAlive:boolean):NativeVehicleAudioInput{
 const body=boat.body,lin=body.linvel();
 return {position:native(body.translation()),...axes(body.rotation()),moveSpeed:{x:lin.x/50,y:-lin.z/50,z:lin.y/50},
  status:boat.wrecked?'wrecked':boat.occupied?'player':'abandoned',playerDriver:boat.occupied,playerInVehicle:boat.occupied,playerAlive,
  engineOn:boat.occupied&&!boat.wrecked,gasPedal:boat.gasPedal,brakePedal:boat.brakePedal,handbrake:false,gear:0,
  padAccelerate:boat.occupied?Math.max(0,boat.throttle):0,padBrake:boat.occupied?Math.max(0,-boat.throttle):0,
  health:boat.health,drowning:false,underwater:false,towing:false,horn:{counter:0,pattern:0},sirenOrAlarm:false,alarmState:0,
  boat:{engineSpeed:boat.engineSpeed,inWater:boat.inWater}};
}
/** CHeli/CPlane state: the browser throttle stands in for m_fHeliRotorSpeed (0.22 at full) and m_fPropSpeed (0.34 at full).
 * A scripted police airframe runs its engine off the autopilot collective. */
export function worldPlaneAudioInput(plane:WorldPlane,playerAlive:boolean,pad:{accelerate:number;brake:number}):NativeVehicleAudioInput{
 const body=plane.body,lin=body.linvel(),alive=plane.health>0;
 const engineOn=alive&&(plane.occupied||plane.policeHeli&&(plane.autopilot?.throttle??0)>0);
 return {position:native(body.translation()),...axes(body.rotation()),moveSpeed:{x:lin.x/50,y:-lin.z/50,z:lin.y/50},
  // An airframe the game flies itself (the police helicopter's autopilot) is STATUS_PHYSICS: ProcessAIHeli's sound.
  status:!alive?'wrecked':plane.occupied?'player':plane.autopilot?'physics':'abandoned',playerDriver:plane.occupied,playerInVehicle:plane.occupied,playerAlive,
  engineOn,gasPedal:plane.throttle,brakePedal:0,handbrake:false,gear:0,padAccelerate:plane.occupied?pad.accelerate:0,padBrake:plane.occupied?pad.brake:0,
  health:plane.health,drowning:plane.drowning,underwater:false,towing:false,horn:{counter:0,pattern:0},sirenOrAlarm:false,alarmState:0,
  rotorSpeed:plane.helicopter?plane.rotorSpeed:plane.throttle*.22,propSpeed:plane.throttle*.34,
  // A seaplane's hull skims the water as a boat's does (bBoatInWater).
  boat:{engineSpeed:0,inWater:plane.inWater}};
}
