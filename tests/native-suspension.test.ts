import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {nativeSuspensionLine,nativeSuspensionCompression,sampleNativeSuspensionCompression,sampleNativeSuspensionHitFraction,sampleNativeGroundSuspension,type NativeSuspensionGroundState} from '../src/simulation/nativeSuspension';
let world:RAPIER.World|undefined;
beforeAll(async()=>{await RAPIER.init();});afterEach(()=>{world?.free();world=undefined;});
test('builds native ray endpoints from wheel center, travel and diameter',()=>{
  const line=nativeSuspensionLine({x:1,y:2,z:.5},.25,-.25,1);
  expect(line).toEqual({start:{x:1,y:2,z:.75},end:{x:1,y:2,z:-.25},springLength:.5,lineLength:1,radius:.5});
});
test('removes radius contribution with source ordering and preserves overcompression',()=>{
  expect(nativeSuspensionCompression(1,.5,1)).toBe(1);
  expect(nativeSuspensionCompression(.75,.5,1)).toBe(.5);
  expect(nativeSuspensionCompression(.5,.5,1)).toBe(0);
  expect(nativeSuspensionCompression(.25,.5,1)).toBe(-.5);
  expect(nativeSuspensionCompression(0,.5,1)).toBe(-1);
});
function rayFixture(){
  world=new RAPIER.World({x:0,y:0,z:0});world.createCollider(RAPIER.ColliderDesc.cuboid(5,.1,5).setTranslation(0,-.1,0));
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,.75,0));
  const chassis=world.createCollider(RAPIER.ColliderDesc.ball(.05),body).handle;
  const controller=world.createVehicleController(body),line=nativeSuspensionLine({x:0,y:0,z:0},0,-.5,1);
  controller.indexUpAxis=1;controller.setIndexForwardAxis=2;
  controller.addWheel({x:0,y:0,z:0},{x:0,y:-1,z:0},{x:-1,y:0,z:0},line.springLength,line.radius);
  controller.setWheelSuspensionStiffness(0,0);controller.setWheelMaxSuspensionForce(0,0);controller.setWheelFrictionSlip(0,0);controller.setWheelSideFrictionStiffness(0,0);
  const refresh=()=>{world!.step();controller.updateVehicle(1/60,undefined,undefined,c=>c.handle!==chassis);};
  return {body,controller,line,refresh};
}
test('samples real wheel ray geometry, then returns full extension after contact loss',()=>{
  const {body,controller,line,refresh}=rayFixture();
  refresh();expect(sampleNativeSuspensionCompression(controller,0,line)).toBeCloseTo(.5,6);
  body.setTranslation({x:0,y:.25,z:0},true);refresh();expect(sampleNativeSuspensionCompression(controller,0,line)).toBeCloseTo(-.5,6);
  body.setTranslation({x:0,y:3,z:0},true);refresh();expect(sampleNativeSuspensionCompression(controller,0,line)).toBe(1);
  expect(()=>sampleNativeSuspensionCompression(controller,0,{...line,radius:.2})).toThrow(/geometry/);
});
test('rejects invalid geometry, fractions and precision loss',()=>{
  expect(()=>nativeSuspensionLine({x:0,y:0,z:0},0,0,1)).toThrow();
  expect(()=>nativeSuspensionLine({x:0,y:0,z:0},1,0,-1)).toThrow();
  for(const fraction of [-.01,1.01,NaN])expect(()=>nativeSuspensionCompression(fraction,.5,1)).toThrow();
  expect(()=>nativeSuspensionCompression(.5,0,1)).toThrow();
  expect(()=>nativeSuspensionCompression(.5,2,1)).toThrow();
  expect(()=>nativeSuspensionCompression(.5,1e-30,1)).toThrow(/precision/);
});

const ground=():NativeSuspensionGroundState=>({status:'normal',sandGroup:false,railTrack:false,rhino:false,forwardSpeed:0,wetRoads:0,handlingFlags:0,rotation:0,wheelSpeed:0,timeStep:1});
test('real wheel hits apply ground changes before converting radius to spring compression',()=>{
  const {controller,line,refresh}=rayFixture();refresh();
  expect(sampleNativeSuspensionHitFraction(controller,0,line)).toBeCloseTo(.75,6);
  // With half the line occupied by wheel radius, raw changes double in spring space.
  for(const [state,adjusted,compression] of [
    [{...ground(),status:'burst' as const,burstSample:0},.875,.75],
    [{...ground(),sandGroup:true},.9,.8],
    [{...ground(),railTrack:true,rotation:2.9,wheelSpeed:.2},.6,.2],
    [{...ground(),status:'missing' as const},1,1],
  ] as const){
    const before=structuredClone(state),result=sampleNativeGroundSuspension(controller,0,line,state);
    expect(result.hitFraction).toBeCloseTo(.75,6);expect(result.adjustedFraction).toBeCloseTo(adjusted,6);
    expect(result.compression).toBeCloseTo(compression,6);expect(state).toEqual(before);
  }
});
test('ground-aware sampling preserves overcompression and full extension after contact loss',()=>{
  const {body,controller,line,refresh}=rayFixture();body.setTranslation({x:0,y:.25,z:0},true);refresh();
  expect(sampleNativeGroundSuspension(controller,0,line,ground()).compression).toBeCloseTo(-.5,6);
  body.setTranslation({x:0,y:3,z:0},true);refresh();
  expect(sampleNativeGroundSuspension(controller,0,line,{...ground(),sandGroup:true,railTrack:true})).toEqual({hitFraction:1,adjustedFraction:1,compression:1});
  expect(()=>sampleNativeGroundSuspension(controller,0,line,{...ground(),status:'burst'})).toThrow(/sample/);
  expect(()=>sampleNativeSuspensionHitFraction(controller,0,{...line,lineLength:NaN})).toThrow(/dimensions/);
});
