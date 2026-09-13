import {expect,test} from 'vitest';
import {nativeWetMultiplier,nativeSurfaceGrip} from '../src/simulation/nativeSurfaceGrip';
import {readSurfaceInfo} from '../src/assets/surfaceInfo';
import {indexNativeSurfaceInfo} from '../src/assets/surfaceIds';
import {readSurfaceAdhesion} from '../src/assets/surfaceAdhesion';
const row=(name:string,group:string)=>[name,group,9.9,-.999,'DEFAULT','NONE',...Array(29).fill(0),'NONE'].join(' ');
const records=()=>indexNativeSurfaceInfo(readSurfaceInfo([row('WHEELBASE','RUBBER'),row('TARMAC','ROAD'),row('SAND_DEEP','SAND'),row('WATER_SHALLOW','WET')].join('\n')).records).byId;
const rows=readSurfaceAdhesion('a 1\nb 2\nc 3\nd 4\ne 5\nf 6').rows;
test('runtime wet byte controls interpolation without treating raw file grip as a multiplier',()=>{
  expect(nativeWetMultiplier(-50,0)).toBe(1);expect(nativeWetMultiplier(-50,.5)).toBe(.75);expect(nativeWetMultiplier(-50,1)).toBe(.5);
  expect(nativeWetMultiplier(25,1)).toBe(1.25);
  expect(nativeSurfaceGrip(1,records(),rows,-50,.5,{burst:false})).toMatchObject({adhesiveLimit:3,wetMultiplier:.75,offRoad:false});
});
test('off-road eligibility uses group ordering including WET, not the material sand flag',()=>{
  const r=records();expect(r.get(28)!.values.sand).toBe(0);
  expect(nativeSurfaceGrip(28,r,rows,0,1,{burst:true,burstNoise:.1})).toEqual({adhesiveLimit:5,wetMultiplier:1,offRoad:true,burst:true,burstNoise:.1});
  expect(nativeSurfaceGrip(39,r,rows,0,1,{burst:false}).offRoad).toBe(true);
});
test('raw accessor preserves negative results but tire adapter rejects unsupported negative adhesion',()=>{
  expect(nativeWetMultiplier(-128,1)).toBeCloseTo(-.28,6);
  expect(()=>nativeSurfaceGrip(1,records(),rows,-128,1,{burst:false})).toThrow(/Negative/);
  for(const byte of [-129,128,.5,NaN])expect(()=>nativeWetMultiplier(byte,1)).toThrow();
  expect(()=>nativeWetMultiplier(0,1.1)).toThrow();
});
test('missing and nonregular material identities do not silently become default traction',()=>{
  expect(()=>nativeSurfaceGrip(255,records(),rows,0,0,{burst:false})).toThrow(/ID/);
  const r=records();r.delete(60);expect(()=>nativeSurfaceGrip(1,r,rows,0,0,{burst:false})).toThrow(/Missing/);
});
