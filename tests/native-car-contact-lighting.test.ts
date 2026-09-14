import {test,expect} from 'vitest';
import {initialCarCollisionLighting,nativeCarContactBrightness} from '../src/simulation/nativeCarContactLighting';
test('constructor collision-lighting bytes are owned per car and preserve distinct day/night nibbles',()=>{
 const a=initialCarCollisionLighting(),b=initialCarCollisionLighting();expect(Object.values(a)).toEqual([0x48,0x48,0x48,0x48]);
 expect(nativeCarContactBrightness(a,0)).toBeCloseTo(8/30,7);expect(nativeCarContactBrightness(a,1)).toBeCloseTo(4/30,7);a.frontLeft=0;expect(b.frontLeft).toBe(0x48);
});
test('four unequal wheel lighting bytes average native brightness, rather than selecting one contact',()=>{
 const lighting={frontLeft:0x0f,rearLeft:0xf0,frontRight:0x00,rearRight:0xff};
 for(const night of [0,.25,.5,1])expect(nativeCarContactBrightness(lighting,night)).toBeCloseTo(.25,7);
 expect(()=>nativeCarContactBrightness({...lighting,rearRight:256},0)).toThrow();expect(()=>nativeCarContactBrightness(lighting,NaN)).toThrow();
});
