import {expect,test} from 'vitest';
import {nativeSpriteMetrics,stepCoronaFade,coronaDistanceIntensity,type CoronaFadeInput} from '../src/render/corona';

const viewport={width:640,height:480,fov:70,near:.9,far:1000};
const fade:CoronaFadeInput={intensity:0,targetAlpha:255,registered:true,justCreated:false,offScreen:false,blocked:false,changeImmediately:false,timeStep:1,fadeSpeed:15};

test('sprite metrics preserve native viewport, inverse-depth and FOV scaling',()=>{
  const point={x:50,y:25,z:100};
  expect(nativeSpriteMetrics(point,viewport)).toEqual({x:320,y:120,depth:100,widthScale:6.4,heightScale:4.8});
  const wide=nativeSpriteMetrics(point,{...viewport,width:1280,fov:35})!;
  expect(wide.x).toBe(640);expect(wide.y).toBe(120);expect(wide.widthScale).toBeCloseTo(25.6);expect(wide.heightScale).toBeCloseTo(9.6);
  expect(nativeSpriteMetrics({...point,z:200},viewport)!.widthScale).toBeCloseTo(3.2);
});

test('sprite clipping rejects exact near-plus-one and far boundaries with explicit bypasses',()=>{
  for(const depth of [-1,0,1.9,1000,1001])expect(nativeSpriteMetrics({x:0,y:0,z:depth},viewport)).toBeUndefined();
  expect(nativeSpriteMetrics({x:0,y:0,z:1.90001},viewport)).toBeDefined();
  expect(nativeSpriteMetrics({x:0,y:0,z:999.99},viewport)).toBeDefined();
  expect(nativeSpriteMetrics({x:0,y:0,z:1},viewport,false)).toBeDefined();
  expect(nativeSpriteMetrics({x:0,y:0,z:1000},viewport,true,false)).toBeDefined();
  expect(()=>nativeSpriteMetrics({x:0,y:0,z:0},viewport,false)).toThrow();
});

test('corona fade truncates each frame, approaches alpha without overshoot and fades after missing registration',()=>{
  const first=stepCoronaFade({...fade,timeStep:.5});expect(first.intensity).toBe(7);
  expect(stepCoronaFade({...fade,timeStep:.5,intensity:first.intensity}).intensity).toBe(14);
  expect(stepCoronaFade({...fade,timeStep:1}).intensity).toBe(15); // Not interchangeable with two half steps.
  expect(stepCoronaFade({...fade,intensity:250}).intensity).toBe(255);
  expect(stepCoronaFade({...fade,intensity:10,registered:false})).toEqual({intensity:0,expired:true});
  expect(stepCoronaFade({...fade,intensity:50,targetAlpha:40}).intensity).toBe(40);
});

test('offscreen and obstruction fading take precedence over immediate brightness and retain a newly created zero slot',()=>{
  for(const condition of [{offScreen:true},{blocked:true}])expect(stepCoronaFade({...fade,intensity:25,changeImmediately:true,...condition}).intensity).toBe(10);
  expect(stepCoronaFade({...fade,changeImmediately:true}).intensity).toBe(255);
  expect(stepCoronaFade({...fade,offScreen:true,justCreated:true})).toEqual({intensity:0,expired:false});
  expect(stepCoronaFade({...fade,offScreen:true})).toEqual({intensity:0,expired:true});
});

test('corona range attenuation begins halfway and rejects invalid numeric inputs',()=>{
  expect([0,50,75,100,101].map(depth=>coronaDistanceIntensity(depth,100))).toEqual([1,1,.5,0,0]);
  expect(()=>stepCoronaFade({...fade,timeStep:NaN})).toThrow();expect(()=>stepCoronaFade({...fade,intensity:256})).toThrow();
  expect(()=>nativeSpriteMetrics({x:0,y:0,z:10},{...viewport,fov:0})).toThrow();
  expect(()=>coronaDistanceIntensity(1,0)).toThrow();
});
