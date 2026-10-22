import {expect,test} from 'vitest';
import {aircraftBaseOffset} from '../src/simulation/nativeAircraftBase';
const matrix=(z:number)=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,z,1];
const frames=[{name:'root',parent:-1,matrix:matrix(0)},{name:'wheel_lf_dummy',parent:0,matrix:matrix(-.282)}];

test('the RC Baron base includes the suspension line below its raw positive COL minimum',()=>{
 expect(aircraftBaseOffset(frames,.00149,0,.25,true)).toBeCloseTo(.407,7);
 expect(aircraftBaseOffset(frames,-.8,0,.25,true)).toBe(.8);
});

test('plane wheel positions accumulate their parents, while helicopter positions stay local',()=>{
 const nested=[{...frames[0],matrix:matrix(.2)},frames[1]];
 expect(aircraftBaseOffset(nested,.00149,-.1,.25,true)).toBeCloseTo(.307,7);
 expect(aircraftBaseOffset(nested,.00149,-.1,.25,false)).toBeCloseTo(.507,7);
 expect(aircraftBaseOffset([frames[0]],-.3,-.1,.25,true)).toBe(.3);
});
