import {expect,test} from 'vitest';
import reference from './fixtures/bike-rider-reverse-reference.json';
import {bikeRiderReversePedalling} from '../src/simulation/nativeBikeRiderLean';
for(const [index,row] of reference.cases.entries())test(`native ordinary bike reverse pose sentinel ${index}`,()=>{
 expect(bikeRiderReversePedalling(row.input.speed,row.input.maxReverseVelocity,row.input.player)).toBe(row.reverse);
});
