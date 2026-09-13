import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {createNativeWheelRays} from '../src/simulation/nativeWheelRays';
import {nativeSuspensionLine,sampleNativeSuspensionHitFraction} from '../src/simulation/nativeSuspension';
import {NATIVE_CAR_WHEELS,type CarWheel} from '../src/simulation/nativeDriveContacts';
let world:RAPIER.World;
beforeAll(async()=>{await RAPIER.init();});afterEach(()=>world?.free());
function setup(){
  world=new RAPIER.World({x:0,y:0,z:0});world.createCollider(RAPIER.ColliderDesc.cuboid(10,.1,10).setTranslation(0,-.1,0));
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,.5,0));
  const chassis=world.createCollider(RAPIER.ColliderDesc.ball(.05).setMass(1000),body).handle;
  const lines=Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,nativeSuspensionLine({x:w.endsWith('Left')?-1:1,y:w.startsWith('front')?2:-2,z:0},.25,-.25,w.startsWith('front')?1:1.2)])) as Record<CarWheel,ReturnType<typeof nativeSuspensionLine>>;
  return {body,chassis,lines};
}
test('native lines create named axle geometry and real contacts in browser axes',()=>{
  const {body,chassis,lines}=setup(),rays=createNativeWheelRays(world,body,lines);world.step();
  rays.controller.updateVehicle(1/60,undefined,undefined,c=>c.handle!==chassis);
  expect(rays.indices).toEqual({frontLeft:0,rearLeft:1,frontRight:2,rearRight:3});
  const point=rays.controller.wheelHardPoint(rays.indices.frontLeft)!;expect(point).toEqual({x:-1,y:.75,z:-2});
  expect(sampleNativeSuspensionHitFraction(rays.controller,0,lines.frontLeft)).toBeCloseTo(.75,6);
  expect(rays.controller.wheelRadius(1)).toBeCloseTo(.6,6);rays.dispose();rays.dispose();
});
test('ray refresh produces no second set of tire or suspension velocity changes',()=>{
  const {body,chassis,lines}=setup(),rays=createNativeWheelRays(world,body,lines);world.step();
  body.setLinvel({x:2,y:-.3,z:4},true);body.setAngvel({x:.1,y:.2,z:.3},true);
  const linear=body.linvel(),angular=body.angvel();rays.controller.updateVehicle(1/60,undefined,undefined,c=>c.handle!==chassis);
  expect(body.linvel()).toEqual(linear);expect(body.angvel()).toEqual(angular);
  expect(NATIVE_CAR_WHEELS.every(w=>rays.controller.wheelIsInContact(rays.indices[w]))).toBe(true);rays.dispose();
});
test('invalid line dimensions reject before creating wheel rays',()=>{
  const {body,lines}=setup();lines.rearRight.lineLength=4;
  expect(()=>createNativeWheelRays(world,body,lines)).toThrow(/dimensions/);
});
