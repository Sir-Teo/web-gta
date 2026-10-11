import {expect,test} from 'vitest';
import {nativeSuspensionLine} from '../src/simulation/nativeSuspension';
import {stepTrailerSupportExtension,trailerSupportLines,TRAILER_SUPPORT_EXTENSION_RATE} from '../src/simulation/nativeTrailerSupport';

test('CTrailer::SetupSuspensionLines puts the legs at the front corners of the bounds, reaching below the wheels',()=>{
 // PETROTR's rear axles (wheel_lf at y -2.64, wheel_lb at -3.78, z -1.45), handling limits and its 1.12 wheels.
 const line=(x:number,y:number)=>nativeSuspensionLine({x,y,z:-1.45},.1,-.25,1.12);
 const wheels={frontLeft:line(-1.13,-2.64),rearLeft:line(-1.13,-3.78),frontRight:line(1.13,-2.64),rearRight:line(1.13,-3.78)};
 const bounds={min:[-1.3,-5,-2.2],max:[1.3,7,2.4]};
 const [left,right]=trailerSupportLines(wheels,bounds,1.2,1.12);
 expect(left.start).toEqual({x:Math.fround(-1.3),y:7,z:Math.fround(2.4)});expect(right.start.x).toBe(Math.fround(1.3));
 expect(left.end.x).toBe(left.start.x);expect(left.end.y).toBe(left.start.y);expect(right.end.z).toBe(left.end.z);
 // The foot is low enough to meet the road the wheels stand on, so the legs carry the front.
 expect(left.end.z).toBeLessThan(wheels.frontLeft.end.z);
});

test('ProcessControl: the legs come out untowed (slowly while under a tenth) and go in towed',()=>{
 expect(stepTrailerSupportExtension(.5,false,1)).toBeCloseTo(.5+TRAILER_SUPPORT_EXTENSION_RATE,6);
 expect(stepTrailerSupportExtension(.05,false,1)).toBeCloseTo(.0505,6);
 expect(stepTrailerSupportExtension(1,false,10)).toBe(1);
 expect(stepTrailerSupportExtension(.001,true,1)).toBe(0);
 expect(stepTrailerSupportExtension(.5,true,1)).toBeCloseTo(.498,6);
});
