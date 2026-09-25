import {expect,test} from 'vitest';
import {ScriptCarMissions,scriptTempActionPedals} from '../src/simulation/ScriptCarMissions';
import type {WorldCar} from '../src/simulation/WorldCar';

/** A car at a renderer point facing native north (-z), at rest. */
function car(x:number,z:number){
 const at={x,y:0,z};
 const c={disposed:false,wrecked:false,occupied:false,autopilot:undefined as unknown,
  car:{body:{translation:()=>at,rotation:()=>({x:0,y:0,z:0,w:1}),linvel:()=>({x:0,y:0,z:-5})}}};
 return {car:c as unknown as WorldCar,at,raw:c};
}

test('with no road route the car drives straight at the point and stops inside 3 units',()=>{
 const missions=new ScriptCarMissions(()=>undefined),{car:c,at,raw}=car(0,0);
 missions.gotoCoords(c,{x:0,y:0,z:-50},{cruise:20,style:0});
 expect(missions.mission(c)).toBe('gotoCoordsStraight');expect(missions.driving(c)).toBe(true);
 missions.step(1/50);
 const drive=raw.autopilot as {native:{gas:number;steerAngle:number}};
 expect(drive.native.gas).toBeGreaterThan(0);expect(Math.abs(drive.native.steerAngle)).toBeLessThan(.01);
 at.z=-47.5;missions.step(1/50);
 expect(missions.mission(c)).toBe('none');expect(missions.driving(c)).toBe(false);
 expect(raw.autopilot).toEqual({steering:0,throttle:0,brake:1,handbrake:false});
});

test('the accurate mission only clears inside 1 unit',()=>{
 const missions=new ScriptCarMissions(()=>undefined),{car:c,at}=car(0,0);
 missions.gotoCoords(c,{x:0,y:0,z:-50},{cruise:20,style:0,accurate:true});
 expect(missions.mission(c)).toBe('gotoCoordsStraightAccurate');
 at.z=-47.5;missions.step(1/50);expect(missions.mission(c)).toBe('gotoCoordsStraightAccurate');
 at.z=-49.5;missions.step(1/50);expect(missions.mission(c)).toBe('none');
});

test('a wrecked, taken or removed car drops its mission',()=>{
 const missions=new ScriptCarMissions(()=>undefined),{car:c,raw}=car(0,0);
 missions.gotoCoords(c,{x:0,y:0,z:-50},{cruise:20,style:0});
 raw.occupied=true;missions.step(1/50);expect(missions.driving(c)).toBe(false);
 missions.gotoCoords(c,{x:0,y:0,z:-50},{cruise:20,style:0});raw.occupied=false;raw.disposed=true;missions.step(1/50);
 expect(missions.mission(c)).toBeUndefined();
});

test('a temporary action runs for its time over the mission, then the mission (or the brakes) comes back',()=>{
 const missions=new ScriptCarMissions(()=>undefined),{car:c,raw}=car(0,0);
 missions.tempAction(c,6,.1);
 expect(missions.inTempAction(c)).toBe(true);
 missions.step(.05);
 expect(raw.autopilot).toMatchObject({native:{steerAngle:0,gas:0,brake:0,handbrake:true}});
 missions.step(.06);expect(missions.inTempAction(c)).toBe(false);
 missions.step(.02);expect(raw.autopilot).toEqual({steering:0,throttle:0,brake:1,handbrake:false});
});

test('the temporary actions the scripts use',()=>{
 expect(scriptTempActionPedals(9,0,{forwardSpeed:0})).toEqual({swerve:0,accel:.5,brake:0,handbrake:false});
 expect(scriptTempActionPedals(7,0,{forwardSpeed:0})).toEqual({swerve:1,accel:1,brake:0,handbrake:false});
 expect(scriptTempActionPedals(4,0,{forwardSpeed:0})).toEqual({swerve:1,accel:0,brake:0,handbrake:true});
 // Reversing brakes first while the car still rolls forward.
 expect(scriptTempActionPedals(22,0,{forwardSpeed:.1})).toEqual({swerve:0,accel:0,brake:.5,handbrake:false});
 expect(scriptTempActionPedals(14,0,{forwardSpeed:0})).toEqual({swerve:-1,accel:-.5,brake:0,handbrake:false});
 expect(scriptTempActionPedals(99,0,{forwardSpeed:0})).toBeUndefined();
});
