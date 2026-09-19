import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {RADAR_SPRITE_NAMES,readInitialRadarBlips} from '../src/assets/scmRadarBlips';

const blips=readInitialRadarBlips(new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')));
test('INITIAL leaves the properties, races and Pay \'n\' Sprays on the radar',()=>{
 const count=(sprite:number)=>blips.filter(b=>b.sprite===sprite).length;
 // RADAR_SPRITE_PROPERTYR (for sale), PROPERTYG (owned), RACE and SPRAY.
 expect(count(32)).toBe(26);expect(count(31)).toBe(6);expect(count(33)).toBe(3);expect(count(63)).toBe(9);
 expect(blips).toHaveLength(44);
 expect(blips.every(b=>b.shortRange)).toBe(true);
 // The Idlewood Pay 'n' Spray, a literal in the script.
 expect(blips).toContainEqual({x:expect.closeTo(2067.4,1),y:expect.closeTo(-1831.2,1),z:expect.closeTo(13.5,1),sprite:63,shortRange:true});
 expect(RADAR_SPRITE_NAMES[31]).toBe('radar_propertyG');expect(RADAR_SPRITE_NAMES[63]).toBe('radar_spray');expect(RADAR_SPRITE_NAMES[33]).toBe('radar_race');
});
test('the property blips sit on their script coordinates',()=>{
 for(const b of blips)expect(Math.abs(b.x)<3000&&Math.abs(b.y)<3000&&b.z>-20&&b.z<1000).toBe(true);
});
