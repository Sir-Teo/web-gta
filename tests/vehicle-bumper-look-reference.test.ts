import {expect,test} from 'vitest';
import reference from './fixtures/vehicle-bumper-look-reference.json';
import {nativeVehicleBumperLook} from '../src/render/nativeVehicleBumperLook';

for(const [index,row] of reference.cases.entries())test(`native first-person vehicle glance capture ${index}`,()=>{
 const result=nativeVehicleBumperLook(row.input);
 expect(result.source).toEqual(row.source);expect(result.front).toEqual(row.front);expect(result.up).toEqual(row.up);expect(result.near).toBe(row.near);
});
