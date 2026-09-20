import {expect,test} from 'vitest';
import {lightForPeds,pedSignalCorners,pedSignalQuad,shinyFade} from '../src/world/nativeShinyTexts';
import {TRAFFIC_LIGHT} from '../src/world/nativeTrafficLights';
test('the pedestrian light is red for 12000 of its 16384 half-ms ticks, then green, then yellow',()=>{
 expect(lightForPeds(0)).toBe(TRAFFIC_LIGHT.red);expect(lightForPeds(23998)).toBe(TRAFFIC_LIGHT.red);
 expect(lightForPeds(24000)).toBe(TRAFFIC_LIGHT.green);expect(lightForPeds(30764)).toBe(TRAFFIC_LIGHT.green);
 expect(lightForPeds(30766)).toBe(TRAFFIC_LIGHT.yellow);expect(lightForPeds(32768)).toBe(TRAFFIC_LIGHT.red);
});
test('only the four signal models carry a sign, and the colour fades over the second half of 60 units',()=>{
 expect(pedSignalCorners('trafficlight1')).toEqual([[2.673,.713,-.127],[2.673,1.262,-.539]]);
 expect(pedSignalCorners('CJ_TRAFFIC_LIGHT4')).toBeDefined();expect(pedSignalCorners('mtraffic1')).toBeUndefined();
 expect(shinyFade(10,60)).toBe(1);expect(shinyFade(45,60)).toBeCloseTo(.5,9);expect(shinyFade(61,60)).toBeUndefined();
});
test('the red half draws the hand on red, the green half the man on green and through the yellow blink',()=>{
 const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 const red=pedSignalQuad({name:'trafficlight1',matrix:identity},0,[0,0,0]);
 expect(red!.colour).toEqual([255,0,0]);expect(red!.uv).toEqual([.5,0,0,0,.5,1,0,1]);
 // Red half: corner 2's x/y at corner 1's z, the midpoint, corner 2, the midpoint at corner 2's z.
 expect(red!.corners[0]).toEqual([2.673,1.262,-.127]);expect(red!.corners[2]).toEqual([2.673,1.262,-.539]);
 expect(red!.corners[1][1]).toBeCloseTo(.9875,9);
 const green=pedSignalQuad({name:'trafficlight1',matrix:identity},24000,[0,0,0]);
 expect(green!.colour).toEqual([255,255,255]);expect(green!.uv).toEqual([1,0,.5,0,1,1,.5,1]);expect(green!.corners[1]).toEqual([2.673,.713,-.127]);
 // Yellow: drawn only while bit 0x100 of the time is set.
 expect(pedSignalQuad({name:'trafficlight1',matrix:identity},30766,[0,0,0])).toBeUndefined();
 expect(pedSignalQuad({name:'trafficlight1',matrix:identity},30766+256,[0,0,0])).toBeDefined();
 // Out of range, and faded at 45 units.
 expect(pedSignalQuad({name:'trafficlight1',matrix:identity},0,[100,0,0])).toBeUndefined();
 expect(pedSignalQuad({name:'trafficlight1',matrix:identity},0,[2.673+45,1.262,-.127])!.colour).toEqual([127,0,0]);
});
