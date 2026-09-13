import {expect,test} from 'vitest';
import {readNativeHandlingNames,indexNativeHandling,resolveVehicleHandling} from '../src/assets/handlingIdentity';
import {readHandling} from '../src/assets/handling';
import {readVehicleIde} from '../src/assets/vehicleIde';
const names=()=>Array.from({length:210},(_,i)=>i===38?'RCBANDIT':`H${String(i).padStart(3,'0')}`);
const row=(name:string,mass=1000)=>`${name} ${mass} 2000 0 0 0 0 75 .8 .9 .5 5 180 24 10 R P 8 .6 0 35 1.2 .15 .02 .3 -.2 .55 0 .25 .7 12345 0 0 1 2 3`;
const vehicle=()=>readVehicleIde('cars\n441 rcmodel rctxd car RCBANDIT RC null normal 10 0 0 -1 .7 .7\nend').records[0];
test('fixed-width handling table preserves entry IDs and bounded strings',()=>{
  const bytes=new Uint8Array(2940);names().forEach((name,i)=>bytes.set(new TextEncoder().encode(name),i*14));
  expect(readNativeHandlingNames(bytes)).toEqual(names());
  expect(()=>readNativeHandlingNames(bytes.subarray(1))).toThrow();bytes.fill(65,0,14);expect(()=>readNativeHandlingNames(bytes)).toThrow(/terminated/);
});
test('model IDs remain separate from native handling IDs and trigger correct preparation branch',()=>{
  const result=resolveVehicleHandling(vehicle(),readHandling(row('RCBANDIT')).records,names());
  expect(result.vehicle.id).toBe(441);expect(result.handlingId).toBe(38);expect(result.handling.handlingId).toBe(38);
  expect(result.handling.maxReverseVelocity).toBe(-result.handling.maxFlatVelocity);
});
test('row loader prefix matching and exact vehicle lookup retain distinct semantics',()=>{
  const records=readHandling(row('RCBANDIT_EXTRA')+'\n'+row('RCBANDIT',1200)).records;
  const indexed=indexNativeHandling(records,names());expect(indexed.byId.get(38)?.values.mass).toBe(1200);expect(indexed.warnings).toHaveLength(2);
  const v=vehicle();v.handling='RCBANDIT_EXTRA';expect(()=>resolveVehicleHandling(v,records,names())).toThrow(/exact/);
  v.handling='rcbandit';expect(()=>resolveVehicleHandling(v,records,names())).toThrow(/exact/);
});
test('first table prefix wins and missing data is not silently assigned a default',()=>{
  const table=names();table[0]='RC';const records=readHandling(row('RCBANDIT')).records;
  expect(indexNativeHandling(records,table).byId.has(0)).toBe(true);
  expect(()=>resolveVehicleHandling(vehicle(),records,table)).toThrow(/not loaded/);
  expect(indexNativeHandling(readHandling(row('UNKNOWN')).records,names()).warnings).toHaveLength(1);
  expect(()=>indexNativeHandling(records,['RCBANDIT'])).toThrow(/table/);
});
