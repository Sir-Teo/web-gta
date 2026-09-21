import {expect,test} from 'vitest';
import {PED_SIGHT_RANGE,PED_SIGHT_TARGET_RAISE,pedSightAngleAndRange} from '../src/ped/nativePedSight';

const north={x:0,y:1};

test('a ped sees only what is in front of it and inside forty units',()=>{
 const at={x:0,y:0};
 expect(pedSightAngleAndRange(at,north,{x:0,y:10})).toBe(true);
 // Directly behind is out, and so is anything on the rear half.
 expect(pedSightAngleAndRange(at,north,{x:0,y:-1})).toBe(false);
 expect(pedSightAngleAndRange(at,north,{x:5,y:-5})).toBe(false);
 // Exactly abreast is not behind, so the range test decides it.
 expect(pedSightAngleAndRange(at,north,{x:10,y:0})).toBe(true);
 // Forty units is the limit and is itself out, as the squared comparison is strict.
 expect(pedSightAngleAndRange(at,north,{x:0,y:PED_SIGHT_RANGE})).toBe(false);
 expect(pedSightAngleAndRange(at,north,{x:0,y:PED_SIGHT_RANGE-.01})).toBe(true);
 expect(PED_SIGHT_TARGET_RAISE).toBe(1);
});
