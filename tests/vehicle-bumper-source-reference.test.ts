import {expect,test} from 'vitest';
import reference from './fixtures/vehicle-bumper-source-reference.json';
import {nativeVehicleBumperSource} from '../src/render/nativeVehicleBumperSource';

for(const [index,row] of reference.cases.entries())test(`native vehicle bumper source capture ${index}`,()=>{
 const input=row.input,position=input.vehiclePosition??input.matrix.position;
 expect(nativeVehicleBumperSource({boat:input.vehicleType===5,dummy:input.dummy,matrix:input.matrix,position})).toEqual(row.source);
});
