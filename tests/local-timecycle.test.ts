import {expect,test} from 'vitest';
import {LocalTimecycle} from '../src/world/LocalTimecycle';
const text=()=>Array.from({length:184},(_,row)=>{const v=Array(51).fill(0);v[0]=64;v[9]=row<8?255:0;v[11]=row<8?0:255;return v.join(' ');}).join('\n');
test('local lighting swaps atomically, caches samples and restores authored fallback',()=>{
  const lighting=new LocalTimecycle();expect(lighting.sample(0)).toBeUndefined();lighting.load(text(),'local.dat');
  const sample=lighting.sample(0)!;expect(sample.top).toEqual([1,0,0]);expect(sample.ambient[0]).toBeCloseTo(64/255);expect(lighting.sample(0)).toBe(sample);
  expect(()=>lighting.load('broken','bad.dat')).toThrow();expect(lighting.name).toBe('local.dat');expect(lighting.sample(0)).toBe(sample);
  lighting.setWeather(1);expect(lighting.sample(0)!.top).toEqual([0,0,1]);expect(()=>lighting.setWeather(23)).toThrow();
  lighting.clear();expect(lighting.sample(0)).toBeUndefined();expect(lighting.name).toBe('');
});

test('usable native fog distances are sampled and invalid ranges preserve other lighting channels',()=>{
  const rows=text().split('\n').map(row=>row.split(' '));rows.forEach(row=>{row[27]='400';row[28]='100';});
  const lighting=new LocalTimecycle();lighting.load(rows.map(row=>row.join(' ')).join('\n'),'fog.dat');
  expect(lighting.sample(0)!.fog).toEqual({start:100,end:400});
  for(const [start,end] of [[0,0],[500,400],[-1,400],[10,-1]]){
    rows.forEach(row=>{row[27]=String(end);row[28]=String(start);});
    expect(lighting.load(rows.map(row=>row.join(' ')).join('\n'),'invalid-fog.dat').some(w=>w.startsWith('Authored fog'))).toBe(true);
    expect(lighting.sample(0)!.fog).toBeUndefined();expect(lighting.sample(0)!.top).toEqual([1,0,0]);
  }
});
