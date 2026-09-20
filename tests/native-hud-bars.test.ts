import {expect,test} from 'vitest';
import {healthBarHidden,armourBarHidden} from '../src/ui/nativeHudBars';
test('the health bar blinks every eight frames under 10 health; the armour bar shows only above 1',()=>{
 expect(healthBarHidden(50,0)).toBe(false);expect(healthBarHidden(9.9,8)).toBe(false);
 expect(healthBarHidden(9.9,0)).toBe(true);expect(healthBarHidden(9.9,7)).toBe(true);expect(healthBarHidden(9.9,16)).toBe(true);expect(healthBarHidden(9.9,15)).toBe(false);
 expect(healthBarHidden(10,8)).toBe(false);
 expect(armourBarHidden(1)).toBe(true);expect(armourBarHidden(1.5)).toBe(false);
});
