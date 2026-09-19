import {expect,test} from 'vitest';
import {calcCorrectedDist,calcCurvePoint,calcSpeedScaleFactor,calcSpeedVariationInBend,distForLineToCrossOtherLine} from '../src/vehicle/nativeCurves';

// Expectations from CCurves::TestCurves in the reversed Curves.cpp.
const o={x:0,y:0};
test('DistForLineToCrossOtherLine',()=>{
 expect(distForLineToCrossOtherLine(0,0,1,1,1,0,-1,1)).toBeCloseTo(.5,2);
 expect(distForLineToCrossOtherLine(0,0,1,1,1,1,1,1)).toBe(-1);
 expect(distForLineToCrossOtherLine(0,0,2,2,0,4,2,-2)).toBeCloseTo(1,2);
 expect(distForLineToCrossOtherLine(2500.5,1500,3.5,2.5,3000,2000,-4,3)).toBeCloseTo(170.658539,2);
});
test('CalcSpeedVariationInBend',()=>{
 expect(calcSpeedVariationInBend(o,{x:1,y:0},1,0,-1,0)).toBeCloseTo(1/3,4);
 expect(calcSpeedVariationInBend(o,{x:1,y:0},1,0,.9,.1)).toBeCloseTo(.145296633,2);
 expect(calcSpeedVariationInBend(o,{x:1,y:1},1,0,.8,.2)).toBeCloseTo(.235702246,2);
 expect(calcSpeedVariationInBend(o,{x:1,y:0},1,0,.6,.8)).toBeCloseTo(.047619,2);
 expect(calcSpeedVariationInBend(o,{x:1,y:0},1,0,1,0)).toBe(0);
});
test('CalcSpeedScaleFactor',()=>{
 expect(calcSpeedScaleFactor(o,{x:1,y:1},1,0,0,1)).toBeCloseTo(2,2);
 expect(calcSpeedScaleFactor(o,{x:1,y:0},1,0,1,0)).toBeCloseTo(1,2);
 expect(calcSpeedScaleFactor(o,{x:1,y:0},1,0,0,1)).toBeCloseTo(1.5,2);
 expect(calcSpeedScaleFactor(o,{x:1,y:1},1,1,1,1)).toBeCloseTo(1.4142135,2);
});
test('CalcCorrectedDist',()=>{
 expect(calcCorrectedDist(.5,1,.5)).toEqual({distance:expect.closeTo(.25,4),t:expect.closeTo(.5,4)});
 expect(calcCorrectedDist(1,1,.5).distance).toBeCloseTo(.5,4);
 expect(calcCorrectedDist(.5,1,0).distance).toBeCloseTo(.5,4);
 expect(calcCorrectedDist(.5,1,1).distance).toBeCloseTo(0,4);
 expect(calcCorrectedDist(500,1000,.5).distance).toBeCloseTo(250,2);
});
test('CalcCurvePoint runs from the start point to the end point through the bend',()=>{
 const start={x:0,y:0},end={x:1,y:1},sd={x:1,y:0},ed={x:0,y:1};
 const a=calcCurvePoint(start,end,sd,ed,0,1000).point,b=calcCurvePoint(start,end,sd,ed,1,1000).point,m=calcCurvePoint(start,end,sd,ed,.5,1000).point;
 expect(a.x).toBeCloseTo(0,2);expect(a.y).toBeCloseTo(0,2);expect(b.x).toBeCloseTo(1,2);expect(b.y).toBeCloseTo(1,2);
 expect(m.x).toBeGreaterThan(0);expect(m.x).toBeLessThan(1);expect(m.y).toBeGreaterThan(0);expect(m.y).toBeLessThan(1);
 const sharp=calcCurvePoint(o,{x:1,y:0},{x:1,y:0},{x:-1,y:0},.5,1000).point;expect(sharp.x).toBeCloseTo(1,2);expect(sharp.y).toBeCloseTo(0,2);
 // A straight 20-unit link pair at time 0.5 sits half way along.
 const straight=calcCurvePoint(o,{x:20,y:0},{x:1,y:0},{x:1,y:0},.5,2000);expect(straight.point.x).toBeCloseTo(10,4);
});
