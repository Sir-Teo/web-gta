import {expect,it} from 'vitest';
import {hudAmmoText} from '../src/ui/nativeAmmoText';

it('prints the rounds outside the clip, a dash, then the clip, as CHud::DrawAmmo does',()=>{
 expect(hudAmmoText({type:22,clipSize:17,inClip:17,total:153,fire:'instant',slot:2})).toBe('136-17');
 // Single-round and huge clips show the total alone.
 expect(hudAmmoText({type:35,clipSize:1,inClip:1,total:5,fire:'projectile',slot:7})).toBe('5');
 expect(hudAmmoText({type:38,clipSize:500,inClip:500,total:1000,fire:'instant',slot:7})).toBe('500-500');
 // The flamethrower counts in tens.
 expect(hudAmmoText({type:37,clipSize:500,inClip:500,total:1500,fire:'area',slot:7})).toBe('100-50');
});
it('draws nothing for fists, melee slots, gifts, the parachute, USE weapons or 9999 spare rounds',()=>{
 expect(hudAmmoText({type:0,clipSize:0,inClip:0,total:0})).toBeUndefined();
 expect(hudAmmoText({type:5,clipSize:1,inClip:1,total:1,fire:'melee',slot:1})).toBeUndefined();
 expect(hudAmmoText({type:14,clipSize:1,inClip:1,total:1,fire:'melee',slot:10})).toBeUndefined();
 expect(hudAmmoText({type:43,clipSize:36,inClip:36,total:72,fire:'camera',slot:9})).toBe('36-36');
 expect(hudAmmoText({type:41,clipSize:500,inClip:500,total:1000,fire:'use',slot:9})).toBeUndefined();
 expect(hudAmmoText({type:22,clipSize:17,inClip:17,total:17+9999,fire:'instant',slot:2})).toBeUndefined();
});
