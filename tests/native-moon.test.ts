import {expect,test} from 'vitest';
import {nativeMoon} from '../src/world/nativeMoon';

test('Render_MaybeRenderMoon: visible while |minutes - 220| < 220, blue 220 less that, red and green faded by the balance',()=>{
 expect(nativeMoon(220,0)).toEqual({color:[220,220,187],halfSize:10});
 expect(nativeMoon(120,0)?.color).toEqual([120,120,102]);
 expect(nativeMoon(440,0)).toBeUndefined();expect(nativeMoon(0,0)).toBeUndefined();expect(nativeMoon(22*60,0)).toBeUndefined();
 // Full fog or cloud leaves red and green at 0, and the moon is not drawn at all.
 expect(nativeMoon(220,1)).toBeUndefined();
 expect(nativeMoon(220,.5)?.color).toEqual([110,110,187]);
});
