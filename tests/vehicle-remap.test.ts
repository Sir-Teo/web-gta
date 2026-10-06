import {describe,expect,it} from 'vitest';
import {firstTextureOf,isRemapMaterial,packStoredPaintjob,remapColours,remapName,unpackStoredPaintjob} from '../src/vehicle/nativeVehicleRemap';

describe('vehicle paintjobs (remaps)',()=>{
 it('marks a model texture whose name begins "remap", not one vehicle.txd holds',()=>{
  expect(isRemapMaterial('remapsultanbody256','sultan')).toBe(true);
  expect(isRemapMaterial('RemapUranus92body256','uranus')).toBe(true);
  expect(isRemapMaterial('vehiclegeneric256','vehicle')).toBe(false);
  expect(isRemapMaterial('remapsomething','vehicle')).toBe(false);
  expect(isRemapMaterial('sultan92interior128','sultan')).toBe(false);
 });
 it('takes the head of the dictionary list, the last texture read',()=>{
  expect(firstTextureOf(['a','b','c'])).toBe('c');
  expect(firstTextureOf(['elegy1body256'])).toBe('elegy1body256');
  expect(firstTextureOf([])).toBeUndefined();
 });
 it('clears the remap for -1 or an index past the model\'s remaps',()=>{
  expect(remapName(['sultan1','sultan2','sultan3'],1)).toBe('sultan2');
  expect(remapName(['sultan1','sultan2','sultan3'],3)).toBeUndefined();
  expect(remapName(['sultan1'],-1)).toBeUndefined();
 });
 it('whitens the primary colour unless told not to',()=>{
  expect(remapColours([36,1,23,0])).toEqual([1,1,23,0]);
  expect(remapColours([36,1,23,0],true)).toEqual([36,1,23,0]);
 });
 it('stores the paintjob as a byte, 255 for none, and gives it back sign-extended',()=>{
  expect(packStoredPaintjob(-1)).toBe(255);expect(unpackStoredPaintjob(255)).toBe(-1);
  expect(packStoredPaintjob(2)).toBe(2);expect(unpackStoredPaintjob(2)).toBe(2);
 });
});
