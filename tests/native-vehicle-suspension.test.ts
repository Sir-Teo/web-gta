import {expect,test} from 'vitest';
import {Matrix4} from 'three';
import {readVehicleIde} from '../src/assets/vehicleIde';
import {readHandling} from '../src/assets/handling';
import {prepareHandling} from '../src/simulation/nativeHandling';
import {nativeVehicleSuspension} from '../src/simulation/nativeVehicleSuspension';
const vehicle=()=>readVehicleIde('cars\n492 greenwoo greenwoo car GREENWOO GREENWOOD null normal 10 0 0 -1 .8 1.2\nend').records[0];
const handling=()=>prepareHandling(readHandling('GREENWOO 1000 2000 0 0 0 0 75 .8 .9 .5 5 180 24 10 R P 8 .6 0 35 1.2 .15 .02 .25 -.25 .55 0 .25 .7 12345 0 0 1 2 3').records[0],0);
const frame=(x:number,y:number,z:number,parent=0)=>({name:'explicit',parent,matrix:new Matrix4().makeTranslation(x,y,z).toArray()});
const model=()=>({frames:[frame(100,200,300,-1),frame(1,-2,.5),frame(-1,2,.5),frame(-1,-2,.5),frame(1,2,.5)]});
const indices={frontLeft:2,rearLeft:3,frontRight:4,rearRight:1};
test('explicit wheel-frame identity links IDE axle size to handling suspension limits',()=>{
  const lines=nativeVehicleSuspension(vehicle(),handling(),model(),indices);
  expect(lines.frontLeft.start).toEqual({x:-1,y:2,z:.75});expect(lines.rearRight.start).toEqual({x:1,y:-2,z:.75});
  expect(lines.frontLeft.radius).toBeCloseTo(.4,7);expect(lines.rearLeft.radius).toBeCloseTo(.6,7);
  expect(lines.frontLeft.end.z).toBeCloseTo(-.15,7);expect(lines.rearLeft.end.z).toBeCloseTo(-.35,7);expect(lines.frontLeft.springLength).toBe(.5);
});
test('ordinary car reads local wheel translation rather than applying parent/root translation',()=>{
  const m=model(),before=structuredClone(m),lines=nativeVehicleSuspension(vehicle(),handling(),m,indices);
  expect(lines.frontRight.start.x).toBe(1);expect(lines.frontRight.start.y).toBe(2);expect(m).toEqual(before);
});
test('unsupported types, missing dimensions and ambiguous frame selections reject',()=>{
  const v=vehicle(),h=handling(),m=model();
  expect(()=>nativeVehicleSuspension({...v,type:'plane'},h,m,indices)).toThrow(/ordinary/);
  expect(()=>nativeVehicleSuspension({...v,frontWheelSize:undefined},h,m,indices)).toThrow(/sizes/);
  expect(()=>nativeVehicleSuspension(v,h,m,{...indices,frontLeft:3})).toThrow(/distinct/);
  expect(()=>nativeVehicleSuspension(v,h,m,{...indices,frontLeft:99})).toThrow(/frame/);
  m.frames[2].matrix[12]=NaN;expect(()=>nativeVehicleSuspension(v,h,m,indices)).toThrow(/matrix/);
});
test('standard car dummy names resolve model geometry without positional wheel indices',()=>{
  const m=model();m.frames[1].name='wheel_rb_dummy';m.frames[2].name='wheel_lf_dummy';m.frames[3].name='wheel_lb_dummy';m.frames[4].name='wheel_rf_dummy';
  const before=structuredClone(m),lines=nativeVehicleSuspension(vehicle(),handling(),m);
  expect(lines.frontLeft.start).toEqual({x:-1,y:2,z:.75});expect(lines.rearRight.start).toEqual({x:1,y:-2,z:.75});expect(m).toEqual(before);
});
test('automatic wheel selection rejects duplicate, missing, root and case-mismatched names',()=>{
  const m=model();m.frames[1].name='wheel_rb_dummy';m.frames[2].name='wheel_lf_dummy';m.frames[3].name='wheel_lb_dummy';m.frames[4].name='wheel_rf_dummy';
  m.frames.push({...m.frames[2]});expect(()=>nativeVehicleSuspension(vehicle(),handling(),m)).toThrow(/found 2/);m.frames.pop();
  m.frames[2].name='WHEEL_LF_DUMMY';expect(()=>nativeVehicleSuspension(vehicle(),handling(),m)).toThrow(/found 0/);m.frames[2].name='wheel_lf_dummy';
  m.frames[2].parent=-1;expect(()=>nativeVehicleSuspension(vehicle(),handling(),m)).toThrow(/root/);
  // Explicit identity remains available for caller-installed or renamed models.
  expect(()=>nativeVehicleSuspension(vehicle(),handling(),model(),indices)).not.toThrow();
});
