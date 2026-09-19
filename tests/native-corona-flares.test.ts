import {expect,test} from 'vitest';
import {FLARE,HEADLIGHTS_FLARE,SUN_FLARE,coronaFlares} from '../src/world/nativeCoronaFlares';

test('the sun flare strings 26 sprites from the screen centre through the sun', () => {
 const sprites=coronaFlares(FLARE.sun,[.5,-.25],[255,190,120],255,()=>1);
 expect(sprites).toHaveLength(SUN_FLARE.length);
 expect(SUN_FLARE).toHaveLength(26);expect(HEADLIGHTS_FLARE).toHaveLength(26);
 // Each sits at its own fraction of the line, the first four screens out beyond the sun and the last nine behind the
 // centre. Its size is four times the listed one.
 expect(sprites[0].position).toEqual([2,-1]);expect(sprites[0].halfSize).toBe(32);
 expect(sprites[25].position).toEqual([-4.5,2.25]);expect(sprites[25].halfSize).toBe(89.6);
 // Colour: the corona's byte × the random 0.7 to 1 of the faded intensity × the multiplier / 65535, then × 255 / 256.
 expect(sprites[0].color).toEqual([34,21,10]);
 // The big dim halo at -0.4 is nearly black but far wider.
 expect(sprites[13].halfSize).toBe(384);expect(sprites[13].color).toEqual([16,7,3]);
 // The random dims every sprite together.
 const dim=coronaFlares(FLARE.sun,[.5,-.25],[255,190,120],255,()=>0);
 expect(dim[0].color).toEqual([24,14,6]);
 // A dark or unregistered corona and one without a flare draw nothing.
 expect(coronaFlares(FLARE.sun,[0,0],[255,255,255],0)).toEqual([]);
 expect(coronaFlares(FLARE.none,[0,0],[255,255,255],255)).toEqual([]);
 // The headlight flares are ready for the vehicle lights: same positions, their own sizes and grey multipliers.
 const headlights=coronaFlares(FLARE.headlights,[1,0],[255,255,255],255,()=>1);
 expect(headlights[0]).toEqual({position:[4,0],halfSize:20,color:[58,58,58]});
});
