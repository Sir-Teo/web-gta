import {expect,test} from 'vitest';
import {applyGravityAndAirResistance,flyingControlTail,heightAboveCeiling,heliFlyingControl,heliHoverInputs,planeFlyingControl,stepHeliRotor,smoothPlaneInput,stepPropSpeed,stickFactor,type FlyingBody,type NativeVec} from '../src/simulation/nativeFlyingControl';

// The RUSTLER's flying handling line.
const rustler={thrust:.5,thrustFallOff:.3,yaw:-.0001,yawStabilization:.004,sideSlip:.1,roll:.002,rollStabilization:-.002,pitch:.0002,pitchStabilization:.002,
 formLift:.008,attackLift:.1,gearUpResistance:.2,gearDownLift:1.2,windMultiplier:.2,moveResistance:1,turnResistanceX:.998,turnResistanceY:.998,turnResistanceZ:.99,
 speedResistanceX:10,speedResistanceY:20,speedResistanceZ:0};
// The SPARROW's.
const sparrow={thrust:.4,thrustFallOff:.95,yaw:-.001,yawStabilization:.01,sideSlip:.05,roll:.002,rollStabilization:2,pitch:.002,pitchStabilization:2,
 formLift:.7,attackLift:.004,gearUpResistance:.2,gearDownLift:1,windMultiplier:.2,moveResistance:.998,turnResistanceX:.98,turnResistanceY:.98,turnResistanceZ:.99,
 speedResistanceX:1,speedResistanceY:1,speedResistanceZ:10};
/** Level, heading north. */
const body=(o:Partial<FlyingBody>={}):FlyingBody=>({moveSpeed:[0,0,0],turnSpeed:[0,0,0],position:[0,0,100],right:[1,0,0],forward:[0,1,0],up:[0,0,1],comWorld:[0,0,0],
 tailY:-5,allWheelsInAir:true,gearStatus:1,...o});
const still={rudder:0,pitch:0,roll:0,accel:0};

test('the stick factor is 1 on an axis and √2 on a diagonal; inputs follow the stick 0.069 a step',()=>{
 expect(stickFactor(1,0)).toBeCloseTo(1,6);expect(stickFactor(0,-1)).toBeCloseTo(1,6);expect(stickFactor(1,1)).toBeCloseTo(Math.SQRT2,6);expect(stickFactor(-.5,.5)).toBeCloseTo(Math.SQRT2,6);
 expect(smoothPlaneInput(0,1,1)).toBeCloseTo(.069,6);expect(smoothPlaneInput(.95,1,100)).toBe(1);
});

test('gravity is 0.008 a step, air resistance grows with speed, and the spin loses 1% a step',()=>{
 const b=body({moveSpeed:[0,1,0],turnSpeed:[0,0,.1]});applyGravityAndAirResistance(b,.005,1);
 expect(b.moveSpeed[2]).toBeCloseTo(-.008*.995,6);expect(b.moveSpeed[1]).toBeCloseTo(.995,6);expect(b.turnSpeed[2]).toBeCloseTo(.099,6);
});

test('thrust: half at a centred throttle in the air, full open, nothing on the wheels with it shut',()=>{
 const at=(accel:number,inAir=true)=>{const b=body({allWheelsInAir:inAir});planeFlyingControl(b,rustler,{...still,accel},3,1);return b.moveSpeed[1];};
 expect(at(0)).toBeCloseTo(.008*.5*.5,6);expect(at(1)).toBeCloseTo(.008*.5,6);expect(at(-1)).toBeCloseTo(0,6);
 expect(at(0,false)).toBeCloseTo(0,6);expect(at(1,false)).toBeCloseTo(.008*.5,6);
 // The fall-off past fThrustFallOff: 1 − 0.65 (fwd − 0.3)².
 const fast=body({moveSpeed:[0,1,0]});planeFlyingControl(fast,{...rustler,sideSlip:0},{...still,accel:1},3,1);
 expect(fast.moveSpeed[1]-1).toBeCloseTo(.008*.5*(1-.65*.49),5);
});

test('lift is fwd² (fFormLift × fGearDownL with the gear down − fAttackLift × the angle of attack), capped at the weight over the ceiling',()=>{
 const lift=(o:Partial<FlyingBody>)=>{const b=body({moveSpeed:[0,1,0],...o});planeFlyingControl(b,{...rustler,thrust:0},still,3,1);return b.moveSpeed[2];};
 expect(lift({})).toBeCloseTo(.008,6);expect(lift({gearStatus:0})).toBeCloseTo(.008*1.2,6);
 // Flying 0.1 nose-up into the air: the air comes from below, the angle is −0.1 and lifts.
 expect(lift({moveSpeed:[0,1,-.1]})+.1).toBeGreaterThan(.008*1.01);
 // 25 over the ceiling the lift past the weight is cut to half the weight.
 expect(lift({moveSpeed:[0,1,-.2],position:[0,0,825]})).toBeCloseTo(-.2+.004,6);
 expect(heightAboveCeiling(825,3)).toBe(25);expect(heightAboveCeiling(600,1)).toBe(100);expect(heightAboveCeiling(1200,1)).toBe(-1);
});

test('the elevator pitches the nose up, the ailerons roll right, the rudder yaws right',()=>{
 const turn=(input:Partial<typeof still>)=>{const b=body({moveSpeed:[0,1,0]});planeFlyingControl(b,{...rustler,thrust:0,formLift:0,attackLift:0,rollStabilization:0},{...still,...input},3,1);return b.turnSpeed;};
 // About +x (the right axis) the nose rises; about +y (forward) the right wing drops; about −z the nose turns right.
 expect(turn({pitch:1})[0]).toBeGreaterThan(0);expect(turn({roll:1})[1]).toBeGreaterThan(0);expect(turn({rudder:1})[2]).toBeLessThan(0);
});

test('the tail caps the move speed at 1.5 a step and the spin at 0.2',()=>{
 const b=body({moveSpeed:[0,3,0],turnSpeed:[0,0,.5]});flyingControlTail(b,{...rustler,speedResistanceX:0,speedResistanceY:0,turnResistanceZ:1},3,1);
 expect(Math.hypot(...b.moveSpeed)).toBeCloseTo(1.5,6);expect(Math.hypot(...b.turnSpeed)).toBeCloseTo(.2,6);
});

test('the propeller runs toward 0.18 idle, 0.34 open and 0.05 braking, 1% a step',()=>{
 expect(stepPropSpeed(0,0,1)).toBeCloseTo(.0018,6);expect(stepPropSpeed(.18,1,1)).toBeCloseTo(.18+.0016,6);expect(stepPropSpeed(.18,-1,1)).toBeCloseTo(.18-.0013,6);
 const nv:NativeVec=[0,0,0];expect(nv).toHaveLength(3);
});

test('the helicopter collective: 0.45 + accel × fThrust − fThrustFallOff × the climb (doubled climbing), with half g against the vertical speed',()=>{
 const lifted=(accel:number,vz=0,z=100)=>{const b=body({moveSpeed:[0,0,vz],position:[0,0,z]});heliFlyingControl(b,{...sparrow,moveResistance:1},{yaw:0,pitch:0,roll:0,accel},6,1);return b.moveSpeed[2]-vz;};
 expect(lifted(0)).toBeCloseTo(.004+.008*.45,6);expect(lifted(1)).toBeCloseTo(.004+.008*.85,6);
 // Climbing at 0.1 a step: the push loses 0.1 × 0.008 and the collective 2 × 0.95 × 0.1.
 expect(lifted(0,.1)).toBeCloseTo(.004-.0008+.008*(.45-.19),6);
 // 30 over the ceiling the collective is cut to a quarter.
 expect(lifted(0,0,830)).toBeCloseTo(.004+.008*.45/4,6);
});

test('a helicopter levels itself, pitches nose up and rolls with its inputs, and yaws by twice fYaw',()=>{
 const spin=(input:Partial<{yaw:number;pitch:number;roll:number}>,o:Partial<FlyingBody>={})=>{const b=body(o);heliFlyingControl(b,{...sparrow,speedResistanceX:0,speedResistanceY:0,speedResistanceZ:0,turnResistanceX:1,turnResistanceY:1,turnResistanceZ:1},{yaw:0,pitch:0,roll:0,accel:0,...input},6,1);return b.turnSpeed;};
 expect(spin({pitch:1})[0]).toBeCloseTo(.002,6);expect(spin({roll:1})[1]).toBeCloseTo(-.002,6);expect(spin({yaw:1})[2]).toBeCloseTo(-.002,6);
 // Rolled right by 0.1 (its right axis dipping), it rolls back by fAttackLift × 0.1.
 const r:NativeVec=[Math.cos(.1),0,-Math.sin(.1)],u:NativeVec=[Math.sin(.1),0,Math.cos(.1)];
 expect(spin({},{right:r,up:u})[1]).toBeCloseTo(-.004*Math.sin(.1)*Math.cos(.1),5);
});

test('the rotor spins up 0.001 a frame (0.003 for RC) to 0.22 and winds down 0.00055 a step; hovering brakes the drift',()=>{
 expect(stepHeliRotor(0,true,false,1,1)).toBeCloseTo(.001,9);expect(stepHeliRotor(0,true,true,1,1)).toBeCloseTo(.003,9);expect(stepHeliRotor(.2199,true,false,1,1)).toBe(.22);
 expect(stepHeliRotor(.1,false,false,1,2)).toBeCloseTo(.1-.0011,9);expect(stepHeliRotor(.0001,false,false,1,1)).toBe(0);
 const hover=heliHoverInputs(body({moveSpeed:[.1,.2,0]}),sparrow);
 expect(hover.yaw).toBe(0);expect(hover.pitch).toBeCloseTo(.4,6);expect(hover.roll).toBeCloseTo(.2,6);
});
