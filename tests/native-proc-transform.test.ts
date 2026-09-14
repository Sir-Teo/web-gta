import {expect,test} from 'vitest';
import {prepareNativeProcRules} from '../src/world/nativeProcRules';
import {readProcObjects} from '../src/assets/vegetation';
import {nativeProcTransform} from '../src/world/nativeProcTransform';
const rule=prepareNativeProcRules(readProcObjects('GRASS_SHORT_LUSH shrub 4 80 0 0 2 2 3 3 1 1 1 0'))[0];
const samples=[.5,.5,.5,.5] as const;
test('native object visual scaling leaves entity placement intact and adjusts collision-bottom height',()=>{
 const result=nativeProcTransform(rule,[10,20,30],[0,0,1],-2,'object',samples);
 expect(result.allocatedMatrix).toBe(false);expect(result.scaleApplied).toBe(true);
 expect([...result.entityMatrix]).toEqual([1,0,0,0,-0,1,0,0,0,0,1,0,10,20,33,1]);
 expect([...result.renderMatrix]).toEqual([2,0,0,0,-0,2,0,0,0,0,3,0,10,20,37,1]);
});
test('building scale and single-axis object scale follow the source suppression condition',()=>{
 for(const [kind,settings] of [['building',rule],['object',{...rule,minimumScaleZ:1,maximumScaleZ:1}],['object',{...rule,minimumScaleXY:1,maximumScaleXY:1}]] as const){
  const result=nativeProcTransform(settings,[0,0,0],[0,0,1],-2,kind,samples);
  expect(result.scaleApplied).toBe(false);expect(result.renderMatrix).toEqual(result.entityMatrix);
 }
});
test('slope alignment offsets along the supplied normal below the strict threshold',()=>{
 const aligned=nativeProcTransform(rule,[10,20,30],[0,.6,.8],-2,'building',samples);
 expect(aligned.allocatedMatrix).toBe(true);
 expect(aligned.entityMatrix[13]).toBeCloseTo(21.8,5);expect(aligned.entityMatrix[14]).toBeCloseTo(32.4,5);
 expect([...aligned.entityMatrix.slice(8,11)]).toEqual([0,Math.fround(.6),Math.fround(.8)]);
 expect(nativeProcTransform(rule,[0,0,0],[0,.3,.95],0,'building',samples).allocatedMatrix).toBe(false);
 expect(nativeProcTransform({...rule,align:false},[0,0,0],[0,.6,.8],0,'building',samples).allocatedMatrix).toBe(false);
});
test('explicit transform samples preserve reversed ranges and reject invalid data',()=>{
 const settings={...rule,minimumOffsetZ:4,maximumOffsetZ:-4};
 expect(nativeProcTransform(settings,[0,0,0],[0,0,1],0,'building',[0,0,0,.75]).offset).toBe(-2);
 expect(()=>nativeProcTransform(rule,[0,0,NaN],[0,0,1],0,'object',samples)).toThrow('geometry');
 expect(()=>nativeProcTransform(rule,[0,0,0],[0,0,1],0,'object',[0,0,0,2])).toThrow('samples');
});
