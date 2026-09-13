import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {nativeSuspensionLine} from '../src/simulation/nativeSuspension';
import {sampleNativeWheelFallbacks} from '../src/simulation/nativeWheelFallback';
import {NATIVE_CAR_WHEELS} from '../src/simulation/nativeDriveContacts';
let world:RAPIER.World;
beforeAll(async()=>{await RAPIER.init();});afterEach(()=>world?.free());
function setup(){
  world=new RAPIER.World({x:0,y:0,z:0});const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(10,20,30));world.createCollider(RAPIER.ColliderDesc.ball(.1).setMass(1000),body);world.step();
  const lines=Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,nativeSuspensionLine({x:w.endsWith('Left')?-1:1,y:w.startsWith('front')?2:-2,z:0},.25,-.25,1)])) as Parameters<typeof sampleNativeWheelFallbacks>[1];
  return {body,lines};
}
test('fallback uses current line endpoint relative to chassis origin rather than a world hit',()=>{
  const {body,lines}=setup(),surfaces={frontLeft:{normal:{x:0,y:0,z:1},groundSpeed:{x:.1,y:0,z:0}}};
  const first=sampleNativeWheelFallbacks(body,lines,surfaces);expect(first.frontLeft!.point).toEqual({x:-1,y:2,z:-.75});
  body.setRotation({x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2},true);
  const rotated=sampleNativeWheelFallbacks(body,lines,surfaces);expect(rotated.frontLeft!.point.x).toBeCloseTo(-2,6);expect(rotated.frontLeft!.point.y).toBeCloseTo(-1,6);expect(rotated.frontLeft!.point.z).toBeCloseTo(-.75,6);
  expect(first.frontLeft!.point).toEqual({x:-1,y:2,z:-.75});expect(rotated.rearLeft).toBeUndefined();
});
test('fallback validates normals and owns returned surface vectors',()=>{
  const {body,lines}=setup(),surfaces={rearRight:{normal:{x:0,y:0,z:1},groundSpeed:{x:0,y:0,z:0}}};
  const result=sampleNativeWheelFallbacks(body,lines,surfaces);result.rearRight!.normal.z=0;expect(surfaces.rearRight.normal.z).toBe(1);
  surfaces.rearRight.normal.z=2;expect(()=>sampleNativeWheelFallbacks(body,lines,surfaces)).toThrow(/unit/);
});
