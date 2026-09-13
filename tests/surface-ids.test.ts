import {expect,test} from 'vitest';
import {readSurfaceInfo} from '../src/assets/surfaceInfo';
import {NATIVE_SURFACE_NAMES,NATIVE_WHEELBASE_SURFACE,nativeSurfaceId,nativeSurfaceName,indexNativeSurfaceInfo} from '../src/assets/surfaceIds';
const row=(name:string,grip=1)=>[name,'ROAD',grip,0,'DEFAULT','NONE',...Array(29).fill(0),'NONE'].join(' ');
test('regular material IDs cover the native table with verified domain landmarks',()=>{
  expect(NATIVE_SURFACE_NAMES).toHaveLength(179);expect(new Set(NATIVE_SURFACE_NAMES).size).toBe(179);
  for(const [name,id] of [['DEFAULT',0],['TARMAC',1],['GRAVEL',6],['SAND_DEEP',28],['WHEELBASE',60],['P_KIRCHENFLOOR',103],['P_FORRESTLEAVES',130],['RAILTRACK',178]] as const){
    expect(nativeSurfaceId(name)).toBe(id);expect(nativeSurfaceName(id)).toBe(name);
  }
  expect(NATIVE_WHEELBASE_SURFACE).toBe(60);expect(Object.isFrozen(NATIVE_SURFACE_NAMES)).toBe(true);
  for(const id of [-1,.5,179,188,194,255,NaN,Infinity])expect(nativeSurfaceName(id)).toBeUndefined();
});
test('unknown or differently cased names follow explicit source fallback',()=>{
  for(const name of ['tarmac','UNKNOWN','TARMAC_EXTRA',' TARMAC',''])expect(nativeSurfaceId(name)).toBe(0);
});
test('native table follows load order and reports unknown default overwrites',()=>{
  const records=readSurfaceInfo([row('DEFAULT'),row('TARMAC'),row('CUSTOM',2),row('TARMAC',3)].join('\n')).records;
  const {byId,warnings}=indexNativeSurfaceInfo(records);
  expect(byId.size).toBe(2);expect(byId.get(0)).toBe(records[2]);expect(byId.get(1)?.tyreGrip).toBe(3);
  expect(byId.get(60)).toBeUndefined();expect(warnings).toHaveLength(3);
  expect(warnings[0]).toContain('unknown name CUSTOM maps to DEFAULT (0)');
  expect(records).toHaveLength(4);expect(records[0].tyreGrip).toBe(1);
});
