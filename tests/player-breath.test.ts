import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {beginPlayerBreathFrame,handlePlayerBreath,boatDriverNeedsBreath} from '../src/simulation/playerBreath';
import {updatePlayerSwim,type SwimPlayer} from '../src/simulation/playerSwim';
import {SWIM} from '../src/simulation/nativeSwim';
import {Simulation} from '../src/simulation/Simulation';

beforeAll(async()=>{await RAPIER.init();});

test('previous-frame breath ownership suppresses recovery, then releases it on dry land',()=>{
 const p={breath:10,requireHandleBreath:false};
 for(let i=0;i<3;i++){
  beginPlayerBreathFrame(p,1);
  handlePlayerBreath(p,true,1,1);
 }
 expect(p.breath).toBe(7);
 beginPlayerBreathFrame(p,1); // first frame after the task stops: previous frame handled it
 expect(p.breath).toBe(7);
 beginPlayerBreathFrame(p,1);
 expect(p.breath).toBe(9);
 beginPlayerBreathFrame(p,1);
 expect(p.breath).toBe(11);
});

test('swim callback owns recovery and releasing the swim task permits dry recovery',()=>{
 const p:SwimPlayer={position:{x:0,y:-1,z:0},health:100,grounded:false,swimming:true,swimState:SWIM.tread,swimBlend:0,breath:10,requireHandleBreath:false,swimStopTime:0,swimDiveTime:0,swimDiveDuration:1,swimVel:{x:0,z:0}};
 const input={moveMag:0,sprint:false,jump:false,dive:false};
 for(let i=0;i<3;i++){beginPlayerBreathFrame(p,1);updatePlayerSwim(p,input,0,1/50,undefined);}
 expect(p.breath).toBe(16); // no duplicate recovery from ProcessControl
 beginPlayerBreathFrame(p,1);updatePlayerSwim(p,input,undefined,1/50,undefined);
 expect(p.swimming).toBe(false);expect(p.breath).toBe(16);
 beginPlayerBreathFrame(p,1);updatePlayerSwim(p,input,undefined,1/50,undefined);
 expect(p.breath).toBe(18);
});

test('boat-driver breath branch preserves native strict thresholds',()=>{
 const needs=(force=2,up=-1,x=0,y=0)=>boatDriverNeedsBreath(force,1000,1,up,x,y);
 expect(needs()).toBe(true);
 expect(needs(.8)).toBe(false);
 expect(needs(2,-.6)).toBe(false);
 expect(needs(2,-1,.05)).toBe(false);
 expect(needs(2,-1,0,-.05)).toBe(false);
 expect(needs(2,-1,.049,-.049)).toBe(true);
 expect(needs(2,1)).toBe(false);
});

test('vehicle drowning bypasses armour and seated death can finish without on-foot physics',()=>{
 const sim=new Simulation();
 try{
  sim.player.armour=100;sim.player.breath=0;sim.player.health=.1;
  sim.playerCollider.setEnabled(false);
  sim.beginPlayerBreathFrame(1/50);
  const result=sim.handlePlayerBreath(1/50);
  // (int32)(50/30 x 1 x 3): one 30 fps frame's hit.
  expect(result.damage).toBe(5);expect(sim.player.health).toBe(0);expect(sim.player.armour).toBe(100);
  let releases=0;
  const duration=sim.deathRemaining;
  expect(sim.advancePlayerDeath(duration/2,()=>releases++)).toBe(false);
  expect(releases).toBe(0);
  expect(sim.advancePlayerDeath(duration/2,()=>releases++)).toBe(true);
  expect(releases).toBe(1);expect(sim.player.health).toBe(100);
  expect(sim.player.breath).toBe(1150);expect(sim.player.requireHandleBreath).toBe(false);
  expect(sim.playerCollider.isEnabled()).toBe(true);
  expect(sim.advancePlayerDeath(1,()=>releases++)).toBe(false);expect(releases).toBe(1);
 }finally{sim.dispose();}
});

import {handlePlayerBreath as breathStep} from '../src/simulation/playerBreath';
test('HandlePlayerBreath drowns at (int32)(timeStep x 3) per 30 fps frame: 150 a second over 60 Hz steps',()=>{
 const p={breath:0,requireHandleBreath:true};let damage=0;
 // Ten seconds: 300 frames of 5, give or take the frame that lands on the last step's end.
 for(let i=0;i<600;i++)damage+=breathStep(p,true,1,50/60,100,false).damage;
 expect(damage).toBeGreaterThanOrEqual(1500);expect(damage).toBeLessThanOrEqual(1505);
 // Surfacing resets the countdown, so the next dive's first frame hits at once.
 breathStep(p,false,1,50/60,100,false);p.breath=0;
 expect(breathStep(p,true,1,50/60,100,false).damage).toBe(5);
});
