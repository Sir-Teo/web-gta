import {describe,expect,it} from 'vitest';
import {nativeWheelScale} from '../src/vehicle/nativeWheelScale';

const car=(over:Partial<Parameters<typeof nativeWheelScale>[0]>={})=>({frontSize:.7,rearSize:.7,rear:false,wheelScale:1,handlingFlags:0,modelId:400,vehicleType:'car',...over});
describe('CAutomobile::PreRender wheel scale',()=>{
 it('draws a car\'s own wheel at its modelled diameter, widened by the axle\'s size over 0.7',()=>{
  const s=nativeWheelScale(car({frontSize:.768,rearSize:.768}));
  expect(s.diameter).toBe(1);expect(s.width).toBeCloseTo(.768/.7,5);
  expect(nativeWheelScale(car())).toEqual({width:1,diameter:1});
 });
 it('scales a rear wheel by the rear size over the front',()=>{
  const s=nativeWheelScale(car({frontSize:.7,rearSize:.84,rear:true}));
  expect(s.diameter).toBeCloseTo(1.2,5);expect(s.width).toBeCloseTo(.84/.7,5);
 });
 it('sizes a unit upgrade wheel to the car\'s wheels when m_fWheelScale is the front size',()=>{
  const front=nativeWheelScale(car({frontSize:.768,rearSize:.768,wheelScale:.768}));
  expect(front.diameter).toBeCloseTo(.768,5);expect(front.width).toBeCloseTo(.768/.7,5);
  const rear=nativeWheelScale(car({frontSize:.7,rearSize:.8,wheelScale:.7,rear:true}));
  expect(rear.diameter).toBeCloseTo(.8,5);expect(rear.width).toBeCloseTo(.8/.7,5);
 });
 it('narrows or widens by the axle\'s handling flags, the first set winning',()=>{
  expect(nativeWheelScale(car({handlingFlags:0x400})).width).toBeCloseTo(1.1,5);
  expect(nativeWheelScale(car({handlingFlags:0x100|0x800})).width).toBeCloseTo(.65,5);
  expect(nativeWheelScale(car({handlingFlags:0x4000})).width).toBe(1);
  expect(nativeWheelScale(car({handlingFlags:0x4000,rear:true})).width).toBeCloseTo(1.1,5);
  expect(nativeWheelScale(car({handlingFlags:0x8000,rear:true})).width).toBeCloseTo(1.25,5);
 });
 it('leaves a monster truck\'s and a quad\'s width alone, and triples the Kart\'s',()=>{
  expect(nativeWheelScale(car({frontSize:1.5,rearSize:1.5,vehicleType:'mtruck',handlingFlags:0x400}))).toEqual({width:1,diameter:1});
  expect(nativeWheelScale(car({vehicleType:'quad'})).width).toBe(1);
  const kart=nativeWheelScale(car({frontSize:.26,rearSize:.26,modelId:571,handlingFlags:0x200}));
  expect(kart.width).toBeCloseTo(.26/.7*.8*3,5);
 });
 it('draws a wheel model of the vehicle\'s own at the axle\'s size each way',()=>{
  expect(nativeWheelScale(car({frontSize:.9,wheelModel:true}))).toEqual({width:Math.fround(.9),diameter:.9});
 });
});
