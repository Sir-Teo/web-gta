import {expect,test} from 'vitest';
import {PerspectiveCamera} from 'three';
import {SunCoronas} from '../src/render/SunCoronas';
import {coronaLookMask} from '../src/render/cameraLook';
const red=[1,0,0] as const,blue=[0,0,1] as const;
function setup(){const camera=new PerspectiveCamera(55,1,.08,650);camera.lookAt(.7,1.2,.7);camera.updateMatrixWorld(true);return {camera,state:new SunCoronas()};}
test('sun slots retain independent registration and byte fade history across updates',()=>{
  const {camera,state}=setup();state.update(720,camera,red,blue,.02);
  expect(state.core!.intensity).toBe(0);expect(state.core!.offScreen).toBe(false);expect(state.core!.color).toEqual(red);expect(state.corona!.color).toEqual(blue);
  const core=state.core;state.update(720,camera,red,blue,.02);expect(state.core).toBe(core);expect(core!.intensity).toBe(15);
  for(let i=0;i<20;i++)state.update(720,camera,red,blue,.02);
  const position=state.core!.position.clone();state.update(0,camera,blue,red,.02);
  expect(state.core!.intensity).toBe(240);expect(state.core!.position.equals(position)).toBe(true);expect(state.core!.color).toEqual(red);
  for(let i=0;i<16;i++)state.update(0,camera,blue,red,.02);
  expect(state.core).toBeUndefined();expect(state.corona).toBeUndefined();
});
test('offscreen fading consumes the preceding projection and recovers after returning',()=>{
  const {camera,state}=setup();for(let i=0;i<20;i++)state.update(720,camera,red,blue,.02);
  camera.lookAt(-.7,-1.2,-.7);camera.updateMatrixWorld(true);state.update(720,camera,red,blue,.02);
  expect(state.core!.intensity).toBe(255);expect(state.core!.offScreen).toBe(true);
  state.update(720,camera,red,blue,.02);expect(state.core!.intensity).toBe(240);
  camera.lookAt(.7,1.2,.7);camera.updateMatrixWorld(true);state.update(720,camera,red,blue,.02);expect(state.core!.intensity).toBe(225);
  state.update(720,camera,red,blue,.02);expect(state.core!.intensity).toBe(240);
});
test('missing registration preserves world position while registered slots track the camera and clip',()=>{
  const {camera,state}=setup();for(let i=0;i<20;i++)state.update(720,camera,red,blue,.02);
  const position=state.core!.position.clone();camera.position.set(1,2,3);camera.updateMatrixWorld(true);
  state.update(0,camera,red,blue,.02);expect(state.core!.position.equals(position)).toBe(true);
  expect(state.core!.direction.distanceTo(position.clone().sub(camera.position).normalize())).toBeLessThan(1e-12);
  camera.far=120;camera.updateProjectionMatrix();state.update(720,camera,red,blue,.02);
  expect(state.core!.position.distanceTo(camera.position)).toBeCloseTo(114);
  expect(state.core!.position.equals(position)).toBe(false);
});
test('core-only dawn registration and duration validation do not create a corona slot',()=>{
  const {camera,state}=setup();camera.lookAt(1.665925826,-.058819045,.7);camera.updateMatrixWorld(true);
  state.update(300,camera,red,blue,.02);expect(state.core).toBeDefined();expect(state.corona).toBeUndefined();
  state.update(300,camera,red,blue,1);expect(state.core!.intensity).toBe(45); // Native timestep cap 3.
  expect(()=>state.update(300,camera,red,blue,-1)).toThrow();
});

test('camera-look transitions snap eligible coronas for exactly three updates and can retrigger on return',()=>{
  const {camera,state}=setup();state.update(720,camera,red,blue,.02);
  for(let i=0;i<3;i++){
    state.core!.intensity=30;state.update(720,camera,red,blue,.02,coronaLookMask('behind'));
    expect(state.core!.intensity).toBe(255);
  }
  state.core!.intensity=30;state.update(720,camera,red,blue,.02,4);expect(state.core!.intensity).toBe(45);
  state.update(720,camera,red,blue,.02,0);expect(state.core!.intensity).toBe(255);
  expect(['none','left','right','behind'].map(g=>coronaLookMask(g as 'none'|'left'|'right'|'behind'))).toEqual([0,1,2,4]);
  expect(()=>state.update(720,camera,red,blue,.02,16)).toThrow();
});

test('camera-look override does not bypass previous offscreen state or resurrect unregistered coronas',()=>{
  const {camera,state}=setup();state.update(720,camera,red,blue,.02);
  state.core!.intensity=60;state.core!.offScreen=true;
  state.update(720,camera,red,blue,.02,1);expect(state.core!.intensity).toBe(45);
  state.update(0,camera,red,blue,.02,1);expect(state.core).toBeUndefined();
  expect(state.corona).toBeUndefined();
});

test('only the corona queries obstruction, fades despite a look override and recovers after clearing',()=>{
  const {camera,state}=setup();for(let i=0;i<20;i++)state.update(720,camera,red,blue,.02);
  let queries=0;
  const blocked=(position:unknown,view:unknown)=>{queries++;expect(position).toBe(state.corona!.position);expect(view).toBe(camera.position);return true;};
  state.update(720,camera,red,blue,.02,1,blocked);
  expect(queries).toBe(1);expect(state.corona!.intensity).toBe(240);expect(state.core!.intensity).toBe(255);
  for(let i=0;i<16;i++)state.update(720,camera,red,blue,.02,1,()=>true);
  expect(state.corona).toBeUndefined();expect(state.core!.intensity).toBe(255);
  state.update(720,camera,red,blue,.02,1,()=>false);expect(state.corona!.intensity).toBe(0);
  state.update(720,camera,red,blue,.02,1,()=>false);expect(state.corona!.intensity).toBe(15);
});
test('stored sprite size updates on registration and remains with a fading record',()=>{
  const {camera,state}=setup();for(let i=0;i<20;i++)state.update(720,camera,red,blue,.02,0,undefined,2);
  expect(state.core!.size).toBe(2);state.update(0,camera,red,blue,.02,0,undefined,7);expect(state.core!.size).toBe(2);
});

test('sun ambient multiplier uses prior screen state, recovers before attenuation and respects obstruction',()=>{
  const {camera,state}=setup();state.update(720,camera,red,blue,.02);
  expect(state.lightMultiplier).toBe(1);
  state.update(720,camera,red,blue,.02);expect(state.lightMultiplier).toBeCloseTo(.94);
  state.update(720,camera,red,blue,.02);expect(state.lightMultiplier).toBeCloseTo(.91);
  for(let i=0;i<20;i++)state.update(720,camera,red,blue,.02);
  expect(state.lightMultiplier).toBe(.6);
  state.update(720,camera,red,blue,.02,1,()=>true);expect(state.lightMultiplier).toBeCloseTo(.63);
  camera.lookAt(-.7,-1.2,-.7);camera.updateMatrixWorld(true);
  state.update(720,camera,red,blue,.02);expect(state.lightMultiplier).toBeCloseTo(.6); // Previous render was on screen.
  state.update(720,camera,red,blue,.02);expect(state.lightMultiplier).toBeCloseTo(.63);
  for(let i=0;i<20;i++)state.update(720,camera,red,blue,.02);
  expect(state.lightMultiplier).toBe(1);
});

test('unregistered sun still attenuates on its final eligible fade update, then recovers',()=>{
  const {camera,state}=setup();state.update(720,camera,red,blue,.02);
  state.update(720,camera,red,blue,.02);expect(state.corona!.intensity).toBe(15);
  state.update(0,camera,red,blue,.02);expect(state.corona).toBeUndefined();expect(state.lightMultiplier).toBeCloseTo(.91);
  state.update(0,camera,red,blue,.02);expect(state.lightMultiplier).toBeCloseTo(.94);
});

test('core-only dawn cannot lower ambient, paused updates preserve it and large timesteps cap recovery',()=>{
  const {camera,state}=setup();for(let i=0;i<20;i++)state.update(720,camera,red,blue,.02);
  state.update(720,camera,red,blue,0);expect(state.lightMultiplier).toBe(.6);
  state.update(720,camera,red,blue,10,0,()=>true);expect(state.lightMultiplier).toBeCloseTo(.69);
  const dawn=setup();dawn.camera.lookAt(1.665925826,-.058819045,.7);dawn.camera.updateMatrixWorld(true);
  for(let i=0;i<20;i++)dawn.state.update(300,dawn.camera,red,blue,.02);
  expect(dawn.state.lightMultiplier).toBe(1);
});

test('interior eligibility stops registration but preserves source fade and ambient recovery',()=>{
  const {camera,state}=setup();state.update(720,camera,red,blue,.02,0,undefined,2,false);
  expect(state.core).toBeUndefined();expect(state.corona).toBeUndefined();expect(state.lightMultiplier).toBe(1);
  for(let i=0;i<20;i++)state.update(720,camera,red,blue,.02,0,undefined,2,true);
  const position=state.core!.position.clone();camera.position.x=10;camera.updateMatrixWorld(true);
  state.update(720,camera,blue,red,.02,0,undefined,9,false);
  expect(state.core!.intensity).toBe(240);expect(state.core!.position.equals(position)).toBe(true);expect(state.core!.color).toEqual(red);expect(state.core!.size).toBe(2);
  for(let i=0;i<40;i++)state.update(720,camera,red,blue,.02,0,undefined,2,false);
  expect(state.core).toBeUndefined();expect(state.corona).toBeUndefined();expect(state.lightMultiplier).toBe(1);
  state.update(720,camera,red,blue,.02,0,undefined,2,true);expect(state.core).toBeDefined();expect(state.core!.intensity).toBe(0);
});
