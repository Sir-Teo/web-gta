import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {CarEntry,nativeDoorPoint} from '../src/simulation/CarEntry';
import {VehicleAnimationLibrary} from '../src/assets/vehicleAnimations';
import {rollDoorLock} from '../src/assets/worldCarGenerators';
import {tickAlarm,type WorldCar} from '../src/simulation/WorldCar';
import {setCarLightState,LIGHT_SURFACE} from '../src/render/nativeCarLightMaterials';
import {worldCarAudioInput} from '../src/audio/native/worldVehicleAudio';

beforeAll(async()=>{await RAPIER.init();});

test('door locks roll the generator percentage',()=>{
  expect(rollDoorLock(0,()=>0)).toBe(false);
  expect(rollDoorLock(0,()=>.999)).toBe(false);
  expect(rollDoorLock(100,()=>.999)).toBe(true);
  expect(rollDoorLock(50,()=>.499)).toBe(true);
  expect(rollDoorLock(50,()=>.5)).toBe(false);
  expect(rollDoorLock(-5,()=>0)).toBe(false);
  expect(rollDoorLock(500,()=>.999)).toBe(true);
  expect(rollDoorLock(NaN,()=>0)).toBe(false);
});

test('a locked car is still walked to: the rattle at its door is CTaskSimpleCarOpenLockedDoorFromOutside, with no alarm',()=>{
  const sim=new Simulation(),clips=new VehicleAnimationLibrary('lock-test:'),entry=new CarEntry(sim,clips);
  const fake=(locked:boolean)=>({wrecked:false,onFire:false,locked,alarm:0,modelFlags:0,animGroup:{flags:0},seat:()=>undefined,worldPoint:()=>({x:0,y:0,z:0})}) as unknown as WorldCar;
  try{
    const locked=fake(true);
    expect(entry.enter(locked)).toBe(true);expect(entry.snapshot().phase).toBe('approach');expect(locked.alarm).toBe(0);
    entry.cancel();
    // The engine fire under 250 health is no CFire (m_pFire): CTaskComplexEnterCar still starts.
    const burning={...fake(false),onFire:true} as unknown as WorldCar;
    expect(entry.enter(burning)).toBe(true);
  }finally{entry.cancel();sim.dispose();}
});

test('a door with nothing in the way is entered with no ground found under it yet (a teleport\'s streamed collision not in the queries)',()=>{
  const sim=new Simulation(),clips=new VehicleAnimationLibrary('ground-test:'),entry=new CarEntry(sim,clips);
  // A get-in clip whose root ends at the Greenwood's ENTER_FRONT offset, and a car over a world with no collision.
  const getIn={key:'car_getin_lhs',group:0,clip:{name:'CAR_getin_LHS',flags:0,duration:1,tracks:[{name:'Root',boneId:0,frameType:4,times:new Float32Array([0,1]),rotations:new Float32Array(8),translations:new Float32Array([0,0,0,.949,.489,-.348])}]}};
  (clips as unknown as {slot:()=>unknown}).slot=()=>getIn;
  const car={wrecked:false,onFire:false,locked:false,alarm:0,modelFlags:0,animGroup:{flags:0},assets:{handling:{values:{seatOffset:.22}}},doors:[],car:{body:sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,20,0))},
   seat:(side:'left'|'right')=>({x:side==='left'?-.463:.463,y:.14,z:-.095}),worldPoint:(p:{x:number;y:number;z:number})=>({x:p.x,y:p.z+20,z:-p.y})} as unknown as WorldCar;
  try{expect(entry.enter(car)).toBe(true);expect(entry.snapshot().phase).toBe('approach');}
  finally{entry.cancel();sim.dispose();}
});

test('alarms count down and reach the horn as an active alarm state',()=>{  expect(tickAlarm(8,1/60)).toBeCloseTo(8-1/60,10);
  expect(tickAlarm(.01,1)).toBe(0);
  expect(tickAlarm(0,1)).toBe(0);
  expect(tickAlarm(5,-1)).toBe(5);
  const audioCar=(alarm:number)=>({
    wrecked:false,occupied:false,autopilot:undefined,siren:false,alarm,gasPedal:0,gear:1,
    horn:{counter:0,pattern:0},
    car:{body:{translation:()=>({x:0,y:0,z:0}),rotation:()=>({x:0,y:0,z:0,w:1}),linvel:()=>({x:0,y:0,z:0})},nitro:{installed:false,burning:false,boosts:0}},
    assets:{handling:{values:{driveType:'R',maxVelocity:.5,gears:5},maxReverseVelocity:-.2,gears:[]}},
    audio:{brakePedal:0,handbrake:false,accelerate:0,brake:0},
  }) as unknown as WorldCar;
  expect(worldCarAudioInput(audioCar(4),true).alarmState).toBe(1);
  expect(worldCarAudioInput(audioCar(0),true).alarmState).toBe(0);
});

test('the jacked driver starts in his seat: CAR_jackedLHS\'s first root key from the door point lands within the seat offset of the seat',()=>{
  // Greenwood: ped_frontseat, the CAR_getin_LHS end key and the handling seat offset; CAR_jackedLHS's first root key.
  const seat={x:-.463,y:.14,z:-.095},getInEnd={x:.949,y:.489,z:-.348},jacked0={x:.97,y:.489,z:-.358};
  const door=nativeDoorPoint(seat,getInEnd,.22,'left');
  // Whatever the door's swing: the pelvis is put back over the seat, pushed out by no more than the seat offset.
  expect(door.x+jacked0.x).toBeCloseTo(seat.x-.22+.021,3);expect(door.y+jacked0.y).toBeCloseTo(seat.y,2);
});

test('active light switching brightens brake and headlight lamps',()=>{
  const colors:Record<string,[number,number,number]>={};
  const binding=(slot:'leftRear'|'rightRear'|'leftFront'|'rightFront')=>({binding:{material:{color:{setRGB:(r:number,g:number,b:number)=>{colors[slot]=[r,g,b];}}}},slot});
  const targets=[binding('leftRear'),binding('rightRear'),binding('leftFront'),binding('rightFront')];
  setCarLightState(targets,{brake:true,headlights:false});
  expect(colors.leftRear[0]).toBeGreaterThan(2);
  expect(colors.leftFront).toEqual([1,1,1]);
  setCarLightState(targets,{brake:false,headlights:true});
  expect(colors.leftRear).toEqual([1,1,1]);
  expect(colors.rightFront[0]).toBeGreaterThan(1.5);
  // A smashed lamp (eLights: front left 0, front right 1, rear right 2, rear left 3) stays out.
  setCarLightState(targets,{brake:true,headlights:true,broken:[false,true,false,true]});
  expect(colors.rightFront).toEqual([1,1,1]);expect(colors.leftFront[0]).toBeGreaterThan(1.5);
  expect(colors.leftRear).toEqual([1,1,1]);expect(colors.rightRear[0]).toBeGreaterThan(2);
});

test('a lit lamp swaps to vehiclelightson128 and gLightSurfProps, and goes back when it goes out',()=>{
 const surface={ambient:{value:.5},diffuse:{value:.8}},material={map:'off',color:{setRGB:()=>{}},userData:{nativeSurface:surface}};
 const target={binding:{material},slot:'leftFront' as const,litMap:'on',unlit:{map:'off',ambient:.5,diffuse:.8}};
 setCarLightState([target],{brake:false,headlights:true});
 expect(material.map).toBe('on');expect(surface.ambient.value).toBe(LIGHT_SURFACE.ambient);expect(surface.diffuse.value).toBe(1);
 setCarLightState([target],{brake:false,headlights:false});
 expect(material.map).toBe('off');expect(surface.ambient.value).toBe(.5);expect(surface.diffuse.value).toBe(.8);
 setCarLightState([target],{brake:false,headlights:true,broken:[true,false,false,false]});expect(material.map).toBe('off');
});
