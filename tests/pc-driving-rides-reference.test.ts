import {expect,test} from 'vitest';
import reference from './fixtures/pc-driving-rides-reference.json';
import {carDrivingRideIds} from '../src/simulation/nativeCarDriving';
for(const [index,row] of reference.cases.entries())test(`source-compiled PC driving ride set ${index}`,()=>{expect(carDrivingRideIds(row.input)).toEqual(row.ids);});
