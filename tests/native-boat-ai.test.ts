import {expect,test} from 'vitest';
import {DEFAULT_CRUISE_SPEED,MISSION_GOTOCOORDINATES_ASTHECROWSWIMS,MISSION_HELI_CRASH_AND_BURN,MISSION_NONE,boatCruiseSpeed,boatGotoCoords,boatStop,steerAIBoat,steerAIBoatHeadingForTarget,type BoatPilot} from '../src/simulation/nativeBoatAI';

const pilot=():BoatPilot=>({mission:MISSION_NONE,target:{x:0,y:0,z:0},cruiseSpeed:DEFAULT_CRUISE_SPEED,engineOn:false});
const north={position:{x:0,y:0},forward:{x:0,y:1},moveSpeed:{x:0,y:0}};

// SteerAIBoatWithPhysicsHeadingForTarget (iOS 0x10019c4dc).
test('the boat turns toward the point, by no more than half a radian, and opens up from rest',()=>{
 expect(steerAIBoatHeadingForTarget(north,{x:0,y:50},10)).toEqual({steer:0,gas:1,brake:0,handbrake:false});
 // A point to the west (left of a bow pointing north) is a positive turn, held at 0.5.
 expect(steerAIBoatHeadingForTarget(north,{x:-50,y:1},10).steer).toBe(.5);
 expect(steerAIBoatHeadingForTarget(north,{x:50,y:1},10).steer).toBe(-.5);
 // Behind it: the native wrap retains both -PI and +PI before the clamp.
 expect(Math.abs(steerAIBoatHeadingForTarget({...north,forward:{x:0,y:-1}},{x:-1,y:50},10).steer)).toBe(.5);
 expect(steerAIBoatHeadingForTarget(north,{x:-5,y:50},10).steer).toBeCloseTo(Math.atan2(5,50),5);
});

test('the throttle eases off over the last quarter below the cruise speed, and reverses past it, the wheel turned round',()=>{
 const at=(perFrame:number,target={x:-5,y:50})=>steerAIBoatHeadingForTarget({...north,moveSpeed:{x:0,y:perFrame}},target,10);
 // 60 × 0.1 = 6 against 10: 40% short, full.
 expect(at(.1).gas).toBe(1);
 // 60 × 0.15 = 9: 10% short, 1 − 4 × 0.15.
 expect(at(.15).gas).toBeCloseTo(.4,5);
 // At or over the cruise speed: −0.1, or −0.2 when more than 5 over; the steering negated.
 const fast=at(11/60),faster=at(16/60),turn=at(.1).steer;
 expect(fast.gas).toBe(Math.fround(-.1));expect(faster.gas).toBe(Math.fround(-.2));
 expect(fast.steer).toBeCloseTo(-turn,6);
});

test('BOAT_GOTO_COORDS, SET_BOAT_CRUISE_SPEED and BOAT_STOP as the iOS handlers set the autopilot',()=>{
 const p=pilot();
 boatGotoCoords(p,100,-200,5,false,()=>3);
 expect(p).toEqual({mission:MISSION_GOTOCOORDINATES_ASTHECROWSWIMS,target:{x:100,y:-200,z:0},cruiseSpeed:10,engineOn:true});
 boatGotoCoords(p,100,-200,-100,false,()=>3);expect(p.target.z).toBe(3);
 p.cruiseSpeed=boatCruiseSpeed(7.9);expect(p.cruiseSpeed).toBe(7);
 p.cruiseSpeed=0;boatGotoCoords(p,1,2,0,true,()=>0);expect(p.cruiseSpeed).toBe(1);expect(p.engineOn).toBe(false);
 boatStop(p);expect(p).toMatchObject({mission:MISSION_NONE,cruiseSpeed:0,engineOn:false});
 expect(steerAIBoat(p,north)).toEqual({steer:0,gas:0,brake:.5,handbrake:true});
 // A crashing aircraft's mission is left alone by both.
 const crash={...pilot(),mission:MISSION_HELI_CRASH_AND_BURN};boatGotoCoords(crash,1,1,0,false,()=>0);boatStop(crash);
 expect(crash.mission).toBe(MISSION_HELI_CRASH_AND_BURN);
});

test('a wrecked boat takes nothing from its autopilot',async()=>{
 const {WorldBoat}=await import('../src/simulation/WorldBoat');
 const boat:any=Object.create(WorldBoat.prototype);
 Object.assign(boat,{occupied:false,wrecked:true,pilot:{...pilot(),mission:14,target:{x:0,y:100,z:0},physics:true},gasPedal:0,brakePedal:0,rawSteer:0,steerAngle:0,throttle:0,steer:0,brake:false,
  handling:{values:{steeringLock:30}},body:{rotation:()=>({x:0,y:0,z:0,w:1}),translation:()=>({x:0,y:0,z:0}),linvel:()=>({x:0,y:0,z:0})}});
 (WorldBoat.prototype as any).controlInputs.call(boat,1/50);
 expect(boat.gasPedal).toBe(0);
 boat.wrecked=false;(WorldBoat.prototype as any).controlInputs.call(boat,1/50);
 expect(boat.gasPedal).toBe(1);
});
