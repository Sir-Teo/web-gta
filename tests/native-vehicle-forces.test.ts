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
test('native air resistance follows gravity and owns angular damping before suspension',()=>{
  const {body,controller,input}=setup();body.setGravityScale(0,true);body.setAngvel({x:0,y:1,z:0},true);
  input.gravity={applyGravity:true,disableMoveForce:false,usesCollision:true};input.airResistance={};input.tires.engineEnabled=false;input.tires.wheelParameters.burnout=false;
  for(const w of NATIVE_CAR_WHEELS){input.suspension.wheels[w]=undefined;input.tires.compression[w]=1;}
  // Fixture drag is zero: linear gravity is unchanged, angular decay still applies.
  const r=controller.step(input,false);expect(r.suspension.angular.z).toBeCloseTo(.0198,7);expect(body.angvel().y).toBeCloseTo(.99,6);expect(body.linvel().y).toBeCloseTo(-.4,7);
  body.setLinearDamping(.1);const before=controller.snapshot(),velocity=body.linvel();expect(()=>controller.step(input,false)).toThrow(/Disable Rapier chassis damping/);
  expect(controller.snapshot()).toEqual(before);expect(body.linvel()).toEqual(velocity);
});
test.each([30,60])('native chassis settles at analytically predicted spring height at %i Hz',async(hz)=>{
  const {createNativeWheelRays}=await import('../src/simulation/nativeWheelRays');
  const {nativeSuspensionLine}=await import('../src/simulation/nativeSuspension');
  const {sampleNativeSuspensionWheels}=await import('../src/simulation/nativeSuspensionContacts');
  const {body,controller,input}=setup();world.timestep=1/hz;body.setGravityScale(0,true);body.setTranslation({x:0,y:.65,z:0},true);
  world.createCollider(RAPIER.ColliderDesc.cuboid(20,.1,20).setTranslation(0,-.1,0));
  const lines=Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,nativeSuspensionLine({x:w.endsWith('Left')?-1:1,y:w.startsWith('front')?2:-2,z:0},.25,-.25,1)])) as Parameters<typeof createNativeWheelRays>[2];
  const rays=createNativeWheelRays(world,body,lines),dt=50/hz;
  const ground=Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,{status:'normal',sandGroup:false,railTrack:false,rhino:false,forwardSpeed:0,wetRoads:0,handlingFlags:0,rotation:0,wheelSpeed:0,timeStep:dt}])) as Parameters<typeof sampleNativeSuspensionWheels>[3];
  const parameters=Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,{forceLevel:1,bias:.5,damping:.15}])) as Parameters<typeof sampleNativeSuspensionWheels>[4];
  input.gravity={applyGravity:true,disableMoveForce:false,usesCollision:true};input.airResistance={};input.suspension.timeStep=input.tires.timeStep=dt;
  input.tires.engineEnabled=false;input.tires.wheelParameters.burnout=false;world.step();
  let latch=false;
  for(let tick=0;tick<hz*10;tick++){
    rays.controller.updateVehicle(1/hz,undefined,undefined,c=>c.parent()?.handle!==body.handle);
    const sampled=sampleNativeSuspensionWheels(rays.controller,rays.indices,lines,ground,parameters);
    input.suspension.wheels=sampled.wheels;input.tires.compression=sampled.compression;
    const result=controller.step(input,latch);latch=result.alreadySkidding;world.step();
    expect(body.translation().y).toBeGreaterThan(.5);expect(body.translation().y).toBeLessThan(.75);
  }
  // 4 * .5 bias * .016 * stress = .008 gravity => stress .25,
  // compression .75 => raw fraction .875 => origin height .875 - upper .25.
  expect(body.translation().y).toBeCloseTo(.625,3);expect(Math.abs(body.linvel().y)).toBeLessThan(.002);
  expect(controller.snapshot().wheelFrame.drivetrain.contacts.frontLeft).toBe(4);rays.dispose();
});
test('retained airborne wheels use refreshed endpoint fallback until contact counters expire',async()=>{
  const {sampleNativeWheelFallbacks}=await import('../src/simulation/nativeWheelFallback');const {nativeSuspensionLine}=await import('../src/simulation/nativeSuspension');
  const {body,controller,input}=setup();input.tires.wheelParameters.burnout=false;input.tires.engineEnabled=false;controller.step(input,false);
  const lines=Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,nativeSuspensionLine({x:w.endsWith('Left')?-1:1,y:w.startsWith('front')?2:-2,z:0},.25,-.25,1)])) as Parameters<typeof sampleNativeWheelFallbacks>[1];
  const surfaces=Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,{normal:{x:0,y:0,z:1},groundSpeed:{x:0,y:0,z:0}}]));
  for(const w of NATIVE_CAR_WHEELS){input.suspension.wheels[w]=undefined;input.tires.compression[w]=1;}
  body.setRotation({x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2},true);
  for(let step=1;step<=4;step++){
    input.fallback=sampleNativeWheelFallbacks(body,lines,surfaces);const result=controller.step(input,false);
    expect(result.contacts.frontLeft!.point.x).toBeCloseTo(-2,6);expect(result.contacts.frontLeft!.point.y).toBeCloseTo(-1,6);
    expect(result.suspension.springs.frontLeft).toBeUndefined();expect(result.state.drivetrain.contacts.frontLeft).toBe(4-step);
    expect(result.tires.contactCount).toBe(step<4?4:0);
  }
});
