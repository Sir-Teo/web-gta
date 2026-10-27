import {expect,test} from 'vitest';
import reference from './fixtures/bumper-ground-reference.json';
import {nativeBumperGround} from '../src/render/nativeBumperGround';

for(const [index,row] of reference.cases.entries())test(`native bumper ground lift capture ${index}`,()=>{
 expect(nativeBumperGround(row.input)).toEqual({state:row.state,sourceZ:row.sourceZ});
});
