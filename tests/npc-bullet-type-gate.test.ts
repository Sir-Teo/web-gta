import {expect,test} from 'vitest';
import {sameNonCivilianPedType} from '../src/ped/nativeAcquaintance';

test.each(['COP','GANG1','GANG2','MEDIC'])('NPC bullets spare an equal noncivilian type (%s)',pedType=>{
 expect(sameNonCivilianPedType({pedType},{pedType})).toBe(true);
 expect(sameNonCivilianPedType({pedType},{pedType:'CIVMALE'})).toBe(false);
});
test.each(['CIVMALE','CIVFEMALE'])('the native civilian exception allows equal-type wounds (%s)',pedType=>{
 expect(sameNonCivilianPedType({pedType},{pedType})).toBe(false);
});
test('actual CREATE_CHAR types override clothing/model types in either direction',()=>{
 expect(sameNonCivilianPedType({pedType:'COP',scriptPedType:4},{pedType:'COP'})).toBe(false);
 expect(sameNonCivilianPedType({pedType:'CIVMALE',scriptPedType:6},{pedType:'CIVMALE',scriptPedType:6})).toBe(true);
 expect(sameNonCivilianPedType({},{pedType:'COP'})).toBe(false);expect(sameNonCivilianPedType({},{})).toBe(false);
});
