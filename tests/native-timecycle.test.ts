import {expect,test} from 'vitest';
import {readTimecycle} from '../src/assets/timecycle';
import {decodeTimecycleRow,prepareTimecycle,sampleNativeTimecycle} from '../src/world/nativeTimecycle';
const table=()=>readTimecycle(Array.from({length:184},()=>Array(51).fill('0').join(' ')).join('\n'));
test('native storage scales before narrowing and leaves raw values unchanged',()=>{
  const row=table().rows[0];row.values[0]=258;row.values[21]=1.26;row.values[22]=12.8;row.values[27]=40000.9;row.values[28]=250.9;row.values[29]=1.26;row.values[36]=100.9;row.values[40]=127.9;row.values[44]=128;
  const original=row.values.slice(),set=decodeTimecycleRow(row);
  expect(set).toMatchObject({ambientR:2,sunSize:13,spriteSize:-128,farClip:-25536,fogStart:250,groundLight:13,waterR:100,postFx1Alpha:255,postFx2Alpha:0});
  expect(row.values).toEqual(original);expect(set).not.toHaveProperty('directionalMultiplier');expect(set).not.toHaveProperty('directionalR');
});
test('time then weather interpolation truncates integer colors at both stages',()=>{
  const raw=table();for(const [row,value] of [[0,0],[1,1],[8,1],[9,2]]){raw.rows[row].values[9]=value;raw.rows[row].values[0]=value;raw.rows[row].values[24]=value;}
  const prepared=prepareTimecycle(raw),sample=sampleNativeTimecycle(prepared,150,0,1,.5);
  expect(sample.skyTopR).toBe(0);expect(sample.shadowStrength).toBe(0);expect(sample.ambientR).toBe(1);
  expect(prepared.samples[9].skyTopR).toBe(2);expect(sampleNativeTimecycle(prepared,300,1).skyTopR).toBe(2);
});
test('midnight interpolation wraps within the selected weather and retains fractional float fields',()=>{
  const raw=table();raw.rows[23*8-1].values[27]=100;raw.rows[22*8].values[27]=200;
  const prepared=prepareTimecycle(raw);expect(sampleNativeTimecycle(prepared,1380,22).farClip).toBe(150);
  expect(sampleNativeTimecycle(prepared,-60,22)).toEqual(sampleNativeTimecycle(prepared,1380,22));
});
test('preparation rejects unresolved rows and sampling rejects invalid controls',()=>{
  const raw=table();raw.rows[0].issues.push('shifted');expect(()=>prepareTimecycle(raw)).toThrow('unresolved');raw.rows[0].issues=[];
  raw.rows[0].values[0]=NaN;expect(()=>prepareTimecycle(raw)).toThrow('Unsupported');raw.rows[0].values[0]=0;
  const prepared=prepareTimecycle(raw);for(const weather of [-1,23,.5])expect(()=>sampleNativeTimecycle(prepared,0,weather)).toThrow('weather');
  for(const blend of [NaN,-.1,1.1])expect(()=>sampleNativeTimecycle(prepared,0,0,1,blend)).toThrow('blend');
});
