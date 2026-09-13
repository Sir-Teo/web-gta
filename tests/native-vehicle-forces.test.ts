import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {readHandling} from '../src/assets/handling';
import {prepareHandling} from '../src/simulation/nativeHandling';
import {NativeVehicleForces,type NativeVehicleForceInput} from '../src/simulation/NativeVehicleForces';
import {NATIVE_CAR_WHEELS} from '../src/simulation/nativeDriveContacts';
let world:RAPIER.World;
beforeAll(async()=>{await RAPIER.init();});afterEach(()=>world?.free());
function setup(){
  world=new RAPIER.World({x:0,y:0,z:0});const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());world.createCollider(RAPIER.ColliderDesc.ball(.1).setMass(1000),body);world.step();
  const handling=prepareHandling(readHandling('TEST 1000 2000 0 0 0 0 75 .8 .9 .5 5 180 24 10 R P 8 .6 0 35 1.2 .15 .02 .25 -.25 .5 0 .25 .7 12345 0 0 1 2 3').records[0],0);
  const wheels=Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,{compression:.5,point:{x:w.endsWith('Left')?-1:1,y:w.startsWith('front')?2:-2,z:-.5},normal:{x:0,y:0,z:1},groundSpeed:{x:0,y:0,z:0},forceLevel:0,bias:.5,damping:0}])) as NativeVehicleForceInput['suspension']['wheels'];
  const input:NativeVehicleForceInput={suspension:{wheels,timeStep:1,mode:'normal',makeMassTwiceAsBig:false,frameLimit:1,springLimitMultiplier:2},
    steeringControl:{angle:0,secondAngle:0,playerStatus:true,tarmacAdhesion:1},fallback:{},
    tires:{timeStep:1,compression:{frontLeft:.5,rearLeft:.5,frontRight:.5,rearRight:.5},throttle:1,engineEnabled:true,velocityFrequency:1,playerControlled:true,
      vehicleGrip:{physicsStatus:false,perfectHandling:false,extraPerfectHandling:false,extraHandlingNitros:false,isPlayerVehicle:true,vortex:false,vortexAccelerationBrakeStatus:0},
      wheelParameters:{brakePedal:0,coastBrake:0,handbrake:false,burnout:true,wheelDamageEffect:1,playerCollisions:false,
        surfaces:Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,{adhesiveLimit:1,wetMultiplier:1,offRoad:false,burst:false}])) as NativeVehicleForceInput['tires']['wheelParameters']['surfaces']}}};
  return {body,handling,input,controller:new NativeVehicleForces(body,handling)};
}
test('controller carries tire heat and retained wheel state across physical updates',()=>{
  const {controller,input}=setup();controller.step(input,false);expect(controller.snapshot().tireTemperature).toBeCloseTo(1.001,7);
  input.tires.wheelParameters.burnout=false;
  for(const w of NATIVE_CAR_WHEELS){input.fallback[w]=input.suspension.wheels[w];input.suspension.wheels[w]=undefined;input.tires.compression[w]=1;}
  const second=controller.step(input,false);expect(second.tires.parameters.rearLeft.adhesion).toBeCloseTo(.0008*1.001,9);
  expect(controller.snapshot().wheelFrame.drivetrain.contacts.rearLeft).toBe(3);expect(controller.snapshot().tireTemperature).toBeLessThan(1.001);
});
test('failed frame leaves body velocities and committed state unchanged',()=>{
  const {body,controller,input}=setup();controller.step(input,false);const before=controller.snapshot(),linear=body.linvel(),angular=body.angvel();
  input.tires.compression.frontLeft=.6;expect(()=>controller.step(input,false)).toThrow(/disagrees/);
  expect(controller.snapshot()).toEqual(before);expect(body.linvel()).toEqual(linear);expect(body.angvel()).toEqual(angular);
});
test('caller mutation cannot overwrite owned handling or committed wheel history',()=>{
  const {controller,input,handling}=setup();handling.values.mass=0;
  const result=controller.step(input,false),before=controller.snapshot();result.state.drivetrain.contacts.rearLeft=0;result.state.drivetrain.transmission.gear=5;
  const exposed=controller.snapshot();exposed.wheelFrame.wheels.rearLeft='fixed';exposed.tireTemperature=99;
  expect(controller.snapshot()).toEqual(before);
});
test('native gravity enters suspension before one body batch and does not run again in Rapier',()=>{
  const {body,controller,input}=setup();world.gravity={x:0,y:-9.81,z:0};body.setGravityScale(0,true);
  input.gravity={applyGravity:true,disableMoveForce:false,usesCollision:true};input.tires.engineEnabled=false;input.tires.wheelParameters.burnout=false;
  for(const w of NATIVE_CAR_WHEELS){input.suspension.wheels[w]=undefined;input.tires.compression[w]=1;}
  const r=controller.step(input,false);expect(r.suspension.linear.z).toBeCloseTo(-.008,9);expect(body.linvel().y).toBeCloseTo(-.4,7);
  world.step();expect(body.linvel().y).toBeCloseTo(-.4,7);
});
test('conflicting gravity ownership rejects without changing body or wheel history',()=>{
  const {body,controller,input}=setup();input.gravity={applyGravity:true,disableMoveForce:false,usesCollision:true};
  const before=controller.snapshot(),velocity=body.linvel();expect(()=>controller.step(input,false)).toThrow(/Disable Rapier/);
  expect(controller.snapshot()).toEqual(before);expect(body.linvel()).toEqual(velocity);
});
