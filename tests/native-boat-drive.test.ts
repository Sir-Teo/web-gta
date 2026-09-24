import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {readHandling} from '../src/assets/handling';
import {readBoatHandling,type BoatHandlingData} from '../src/assets/boatHandling';
import {nativeBoatDrive,type NativeBoatDriveInput} from '../src/simulation/nativeBoatDrive';
import type {NativeVec} from '../src/simulation/nativeBuoyancy';

const boatRow=():BoatHandlingData=>{
 const handling=readHandling(readFileSync('public/play/world/files/vehicles/handling.cfg','utf8'));
 return readBoatHandling(handling.supplements).get('PREDATOR')!;
};
// Representative car-row values for the test fixture (not native claims).
const car={tractionBias:.2,tractionMultiplier:1,tractionLoss:.5,suspensionLowerLimit:.5,suspensionForceLevel:1,suspensionBiasBetweenFrontAndRear:0,brakeDeceleration:2,brakeBias:.5,engineAcceleration:.02};
const input=(over:Partial<NativeBoatDriveInput>={}):NativeBoatDriveInput=>({
 gasPedal:0,steerAngle:0,handbrake:false,player:true,
 collidedWithWorld:false,postCollision:false,onWater:true,
 upZ:1,immersionDepth:.5,lastImmersionDepth:.5,
 buoyancyForceZ:10,buoyancyTurn:[0,0,0],
 move:[0,0,0],turn:[0,0,0],
 forward:[0,1,0],right:[1,0,0],up:[0,0,1],
 mass:3000,turnMass:8000,centerOfMass:[0,0,0],
 boundsMinY:-2,boundsMinZ:-.5,
 position:[0,0,0],level:()=>0,
 timeStep:1,boat:boatRow(),car,...over,
});
const fwd=(out:{move:NativeVec})=>out.move[1];

test('a resting boat holds station without gas',()=>{
 const out=nativeBoatDrive(input());
 expect(out.wake).toBe(false);expect(out.engineInWater).toBe(true);expect(out.waveVolume).toBe(0);
 expect(out.move).toEqual([0,0,0]);expect(out.turn).toEqual([0,0,0]);
});

test('throttle drives forward, reverse backs up, more gas pushes harder',()=>{
 const half=nativeBoatDrive(input({gasPedal:.5}));
 const full=nativeBoatDrive(input({gasPedal:1}));
 const back=nativeBoatDrive(input({gasPedal:-1}));
 expect(fwd(full)).toBeGreaterThan(0);expect(fwd(half)).toBeGreaterThan(0);
 expect(fwd(full)).toBeGreaterThan(fwd(half));
 expect(fwd(back)).toBeLessThan(0);
 expect(full.wake).toBe(true);
});

test('a dry engine makes no way',()=>{
 const out=nativeBoatDrive(input({gasPedal:1,onWater:false,position:[0,0,5],level:()=>0}));
 expect(out.engineInWater).toBe(false);
 expect(fwd(out)).toBe(0);
});

test('steering yaws the hull',()=>{
 const left=nativeBoatDrive(input({gasPedal:.6,steerAngle:.4}));
 const right=nativeBoatDrive(input({gasPedal:.6,steerAngle:-.4}));
 const straight=nativeBoatDrive(input({gasPedal:.6,steerAngle:0}));
 expect(left.turn.some(v=>Math.abs(v)>1e-9)).toBe(true);
 expect(right.turn.some(v=>Math.abs(v)>1e-9)).toBe(true);
 expect(left.turn).not.toEqual(right.turn);
 // Straight thrust pitches (thrust below the centre of mass) but does not yaw.
 expect(Math.abs(straight.turn[2])).toBeLessThan(1e-9);
});

test('handbrake checks forward way and collisions skip the lift',()=>{
 const free=nativeBoatDrive(input({gasPedal:0,handbrake:false,move:[0,.5,0]}));
 const braking=nativeBoatDrive(input({gasPedal:0,handbrake:true,move:[0,.5,0]}));
 expect(fwd(braking)).toBeLessThan(fwd(free));
 // Post-collision skips aquaplane lift (less rise) and water resistance (keeps more way).
 const calm=nativeBoatDrive(input({gasPedal:1,buoyancyForceZ:10,move:[0,.5,0]}));
 const hit=nativeBoatDrive(input({gasPedal:1,buoyancyForceZ:10,move:[0,.5,0],postCollision:true}));
 expect(hit.move[2]).toBeLessThan(calm.move[2]);
 expect(fwd(hit)).toBeGreaterThan(fwd(calm));
});

test('immersion jumps hit like waves',()=>{
 const out=nativeBoatDrive(input({move:[0,.5,0],immersionDepth:.5,lastImmersionDepth:.1}));
 // The depth change is a frame's: timeStep 1 is 0.6 of a frame, so the 0.4 rise counts as 0.4 / 0.6.
 expect(out.waveVolume).toBe(Math.floor(4000/.6)*boatRow().waveAudioMult);
 expect(out.move[2]).toBeGreaterThan(0);
 const calm=nativeBoatDrive(input({immersionDepth:.5,lastImmersionDepth:.5}));
 expect(calm.waveVolume).toBe(0);
});
