import {expect,test} from 'vitest';
import {healthBarHidden,armourBarHidden,hudMoney,healthBarWidth,barFill} from '../src/ui/nativeHudBars';
test('the health bar blinks every eight frames under 10 health; the armour bar shows only above 1',()=>{
 expect(healthBarHidden(50,0)).toBe(false);expect(healthBarHidden(9.9,8)).toBe(false);
 expect(healthBarHidden(9.9,0)).toBe(true);expect(healthBarHidden(9.9,7)).toBe(true);expect(healthBarHidden(9.9,16)).toBe(true);expect(healthBarHidden(9.9,15)).toBe(false);
 expect(healthBarHidden(10,8)).toBe(false);
 expect(armourBarHidden(1)).toBe(true);expect(armourBarHidden(1.5)).toBe(false);
});

test('money prints $%08d, or -$%07d when owed; the health bar grows with max health and fills against it',()=>{
 expect(hudMoney(350)).toEqual({text:'$00000350',negative:false});
 expect(hudMoney(-1234)).toEqual({text:'-$0001234',negative:true});
 // At 100 max health the bar is the armour bar's 62 units; at 176 it is 109.
 expect(healthBarWidth(100)*62).toBeCloseTo(61.93,1);expect(healthBarWidth(176)*62).toBeCloseTo(109,5);
 expect(barFill(88,176)).toBe(50);expect(barFill(150,100)).toBe(100);
});
