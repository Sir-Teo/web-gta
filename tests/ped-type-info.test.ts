import {expect,test} from 'vitest';
import {pedTypeInfo} from '../src/ped/nativeAcquaintance';

test.each([
 ['COP',true,undefined],['CIVMALE',false,undefined],['GANG1',false,0],['GANG2',false,1],['GANG10',false,9],['DEALER',false,undefined],['MEDIC',false,undefined],['FIREMAN',false,undefined],['CRIMINAL',false,undefined],
] as const)('native victim classification for %s follows the ped type', (pedType,officer,gang)=>{
 expect(pedTypeInfo({pedType,officer:!officer,gang:4})).toEqual({pedType,officer,gang});
});
test.each([
 [6,'CIVMALE',false,undefined,'COP',true,undefined],
 [4,'COP',true,undefined,'CIVMALE',false,undefined],
 [8,'COP',true,undefined,'GANG2',false,1],
 [4,'GANG1',false,0,'CIVMALE',false,undefined],
 [7,'GANG2',false,1,'GANG1',false,0],
] as const)('CREATE_CHAR type %s overrides model %s for kill and drop classification',(scriptPedType,pedType,oldOfficer,oldGang,actualType,officer,gang)=>{
 expect(pedTypeInfo({pedType,scriptPedType,officer:oldOfficer,gang:oldGang})).toEqual({pedType:actualType,officer,gang});
});
test('legacy records without a type retain their explicit role fields',()=>{
 expect(pedTypeInfo({officer:true})).toEqual({pedType:undefined,officer:true,gang:undefined});
 expect(pedTypeInfo({gang:1})).toEqual({pedType:undefined,officer:false,gang:1});
});
