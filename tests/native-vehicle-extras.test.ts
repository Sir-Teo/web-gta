import {expect,test} from 'vitest';
import {chooseComponentByRule,chooseFirstExtra,chooseSecondExtra,chooseVehicleExtras,componentsNotUsedByRules,countCompsInRule,decodeVehicleComps,isValidCompRule,vehicleExtraFrames,COMPONENT_RULE} from '../src/vehicle/nativeVehicleExtras';

test('the comps column splits into two twelve-bit component lists with a four-bit rule each',()=>{
 // Rule 1 over components 0 and 1 in the A half, rule 3 over component 2 in the B half.
 expect(decodeVehicleComps(0x3ff2_1ff0)).toEqual({extraAComp:0xff0,extraARule:1,extraBComp:0xff2,extraBRule:3});
 expect(countCompsInRule(0xff0)).toBe(1);expect(countCompsInRule(0xf10)).toBe(2);expect(countCompsInRule(0x210)).toBe(3);expect(countCompsInRule(0xfff)).toBe(0);
});
test('ONLY_WHEN_RAINING is the one rule the weather can invalidate',()=>{
 expect(isValidCompRule(COMPONENT_RULE.allowAlways,false)).toBe(true);
 expect(isValidCompRule(COMPONENT_RULE.onlyWhenRaining,false)).toBe(false);
 expect(isValidCompRule(COMPONENT_RULE.onlyWhenRaining,true)).toBe(true);
 expect(isValidCompRule(COMPONENT_RULE.maybeHide,false)).toBe(true);expect(isValidCompRule(COMPONENT_RULE.fullRandom,false)).toBe(true);
});
test('a rule picks one of its listed components, MAYBE_HIDE can pick none and FULL_RANDOM any of five',()=>{
 // Components 0, 1 and 2 listed: the random picks the slot.
 expect(chooseComponentByRule(COMPONENT_RULE.allowAlways,0x210,()=>0)).toBe(0);
 expect(chooseComponentByRule(COMPONENT_RULE.allowAlways,0x210,()=>1)).toBe(2);
 expect(chooseComponentByRule(COMPONENT_RULE.onlyWhenRaining,0xff3,()=>.5)).toBe(3);
 // MAYBE_HIDE draws from -1, so the lowest random hides the component.
 expect(chooseComponentByRule(COMPONENT_RULE.maybeHide,0x210,()=>0)).toBe(-1);
 expect(chooseComponentByRule(COMPONENT_RULE.maybeHide,0x210,()=>1)).toBe(2);
 expect(chooseComponentByRule(COMPONENT_RULE.fullRandom,0,()=>0)).toBe(0);
 expect(chooseComponentByRule(COMPONENT_RULE.fullRandom,0,()=>1)).toBe(4);
 expect(chooseComponentByRule(0,0x210,()=>0)).toBe(-1);expect(chooseComponentByRule(7,0x210,()=>0)).toBe(-1);
});
test('the fallback list holds the extras no valid rule names, and none at all under FULL_RANDOM',()=>{
 const comps=decodeVehicleComps(0x0000_1ff0);
 expect(componentsNotUsedByRules(comps,4,false)).toEqual([1,2,3]);
 expect(componentsNotUsedByRules(decodeVehicleComps(0x0000_4fff),4,false)).toEqual([]);
 // A rainless ONLY_WHEN_RAINING rule strikes nothing off.
 expect(componentsNotUsedByRules(decodeVehicleComps(0x0000_2ff0),3,false)).toEqual([0,1,2]);
 expect(componentsNotUsedByRules(decodeVehicleComps(0x0000_2ff0),3,true)).toEqual([1,2]);
});
test('without a rule the first extra is one unused component two frames in three, and the second needs a valid A rule',()=>{
 const none=decodeVehicleComps(0);
 expect(chooseFirstExtra(none,4,()=>0,false)).toBe(0);
 // The two-in-three test fails on a high random.
 expect(chooseFirstExtra(none,4,()=>1,false)).toBe(-1);
 // No A rule means no second component at all.
 expect(chooseSecondExtra(none,4,()=>0,false)).toBe(-1);
 const withA=decodeVehicleComps(0x0000_1ff0);
 expect(chooseSecondExtra(withA,4,()=>0,false)).toBe(1);
});
test('an instance takes at most two extras, both inside the model\'s own count',()=>{
 expect(chooseVehicleExtras(0,0,()=>0)).toEqual([]);
 // Rule 1 on component 0 for A and rule 1 on component 1 for B: both always chosen.
 const both=chooseVehicleExtras(0x1ff1_1ff0,4,()=>0);
 expect(both).toEqual([0,1]);
 // A model with two extras never shows a component past its own count.
 for(const random of [()=>0,()=>.5,()=>1]){
  const picked=chooseVehicleExtras(0x0000_4fff,2,random);
  expect(picked.every(i=>i>=0&&i<2)).toBe(true);expect(picked.length).toBeLessThanOrEqual(2);
 }
});
test('the extra frames are found by name in extra1 to extra6 order, whatever the hierarchy order',()=>{
 // The Bobcat stores extra2 before extra1.
 const frames=[{name:'chassis'},{name:'extra2'},{name:'extra1'},{name:'wheel_lf_dummy'}];
 expect(vehicleExtraFrames(frames)).toEqual([2,1]);
 expect(vehicleExtraFrames([{name:'chassis'}])).toEqual([]);
 expect(vehicleExtraFrames([{name:' Extra1 '},{name:'extra3'}])).toEqual([0,1]);
});
