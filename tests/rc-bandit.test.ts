import {expect,test} from 'vitest';
import {rcBanditHitsCarWheels,type RcWheelCandidate} from '../src/simulation/nativeRcBandit';

const min={x:-.3,y:-.5,z:-.15},max={x:.3,y:.5,z:.15};
const car=(o:Partial<RcWheelCandidate>={}):RcWheelCandidate=>({modelId:492,automobile:true,deltaX:0,deltaY:0,simple:false,
 compression:[.5,1,1,1],frontWheelSize:.8,wheels:[{x:0,y:0,z:0}],...o});
const hit=(o:Partial<RcWheelCandidate>={})=>rcBanditHitsCarWheels(min,max,car(o));

test('contact detonation tests another automobile wheel, not generic body or ground contact',()=>{
 expect(hit()).toBe(true);expect(hit({automobile:false})).toBe(false);expect(hit({modelId:441})).toBe(false);
 expect(hit({wheels:[]})).toBe(false);expect(hit({wheels:[{x:0,y:0,z:.36}]})).toBe(false);
 expect(hit({modelId:564})).toBe(true); // The exclusion is another Bandit, not every RC model.
});

test('both planar distances must be strictly below ten in either direction',()=>{
 for(const axis of ['deltaX','deltaY'] as const){
  expect(hit({[axis]:9.99})).toBe(true);expect(hit({[axis]:-9.99})).toBe(true);
  expect(hit({[axis]:10})).toBe(false);expect(hit({[axis]:-10})).toBe(false);
 }
});

test('only compressed wheels count on a physical car; a simple car tests all four',()=>{
 expect(hit({compression:[1,1,1,1]})).toBe(false);
 expect(hit({compression:[1,1,1,1],simple:true})).toBe(true);
 expect(hit({compression:[1,1,.8,1],wheels:[undefined,undefined,{x:0,y:0,z:0}]})).toBe(true);
 expect(hit({compression:[.8,1,1,1],wheels:[undefined,undefined,{x:0,y:0,z:0}]})).toBe(false);
});

test('the sphere uses a quarter of front wheel size for every wheel and the native inclusive box test',()=>{
 expect(hit({wheels:[{x:.5,y:0,z:0}]})).toBe(true);
 expect(hit({wheels:[{x:.50001,y:0,z:0}]})).toBe(false);
 // A diagonal corner lies outside a Euclidean sphere/box intersection, but inside native TestSphereBox's slabs.
 expect(hit({wheels:[{x:.5,y:.7,z:.35}]})).toBe(true);
 expect(hit({frontWheelSize:.4,wheels:[{x:.5,y:0,z:0}]})).toBe(false);
});
