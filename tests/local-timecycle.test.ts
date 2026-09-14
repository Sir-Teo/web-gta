import {expect,test} from 'vitest';
import {LocalTimecycle} from '../src/world/LocalTimecycle';
const text=()=>Array.from({length:184},(_,row)=>{const v=Array(51).fill(0);v[0]=64;v[9]=row<8?255:0;v[11]=row<8?0:255;return v.join(' ');}).join('\n');
test('local lighting swaps atomically, caches samples and restores authored fallback',()=>{
  const lighting=new LocalTimecycle();expect(lighting.sample(0)).toBeUndefined();lighting.load(text(),'local.dat');
  const sample=lighting.sample(0)!;expect(sample.top).toEqual([1,0,0]);expect(sample.ambient[0]).toBeCloseTo(64/255);expect(lighting.sample(0)).toBe(sample);
  expect(sample.skyColors).toEqual({top:[255,0,0],bottom:[0,0,0]});
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

test('sun core and corona retain separate imported colors',()=>{
  const rows=text().split('\n').map(row=>row.split(' '));
  rows.forEach(row=>{row[15]='255';row[19]='128';});
  const lighting=new LocalTimecycle();lighting.load(rows.map(row=>row.join(' ')).join('\n'),'sun.dat');
  expect(lighting.sample(720)!.sunCore).toEqual([1,0,0]);
  expect(lighting.sample(720)!.sunCorona[1]).toBeCloseTo(.2158605,6);
  expect(lighting.sample(720)!.sunCorona[0]).toBe(0);
});

test('pedestrian ambient uses the separate object channels in normalized native units',()=>{
 const rows=text().split('\n').map(row=>row.split(' '));
 rows.forEach(row=>{row[3]='128';row[4]='64';row[5]='32';});
 const lighting=new LocalTimecycle();lighting.load(rows.map(row=>row.join(' ')).join('\n'),'objects.dat');
 expect(lighting.sample(720)!.objectAmbient).toEqual([128,64,32].map(v=>Math.fround(v/255)));
 expect(lighting.sample(720)!.ambient).toEqual([Math.fround(64/255),0,0]);
 lighting.clear();expect(lighting.sample(720)).toBeUndefined();
});

test('directional illumination is optional and decoded in source units',()=>{
 const lighting=new LocalTimecycle();lighting.load(text(),'absent.dat');
 expect(lighting.sample(0)!.directionalMultiplier).toBeUndefined();
 lighting.load(text().split('\n').map(row=>row+' 1.75').join('\n'),'explicit.dat');
 expect(lighting.sample(0)!.directionalMultiplier).toBe(1);
 expect(()=>lighting.load(text().split('\n').map(row=>row+' -1').join('\n'),'bad.dat')).toThrow();
 expect(lighting.sample(0)!.directionalMultiplier).toBe(1);expect(lighting.name).toBe('explicit.dat');
});

test('imported shadow strength retains source integer interpolation independently of ambient',()=>{
 const rows=text().split('\n').map(row=>row.split(' '));rows[0][24]='255';rows[1][24]='100';
 const lighting=new LocalTimecycle();lighting.load(rows.map(row=>row.join(' ')).join('\n'),'shadows.dat');
 expect(lighting.sample(0)!.shadowStrength).toBe(255);expect(lighting.sample(150)!.shadowStrength).toBe(177);expect(lighting.sample(300)!.shadowStrength).toBe(100);
});

test('native sky retains final byte colors instead of display-decoded interpolation inputs',()=>{
 const rows=text().split('\n').map(row=>row.split(' '));
 rows.forEach(row=>{row[9]='300';row[10]='128';row[11]='-1';});
 const lighting=new LocalTimecycle();lighting.load(rows.map(row=>row.join(' ')).join('\n'),'sky.dat');
 expect(lighting.sample(0)!.skyColors!.top).toEqual([44,128,255]);
});

test('local weather selection refreshes sky fog independently of timecycle fog distance',()=>{
 const lighting=new LocalTimecycle();lighting.load(text(),'weather.dat');
 expect(lighting.sample(720)!.skyFoggyness).toBe(0);
 for(const weather of [9,19]){lighting.setWeather(weather);expect(lighting.sample(720)!.skyFoggyness).toBe(1);expect(lighting.sample(720)!.fog).toBeUndefined();}
 lighting.setWeather(8);expect(lighting.sample(720)!.skyFoggyness).toBe(0);
});

test('local low-cloud colors preserve source bytes with independent viewer attenuation',()=>{
 const rows=text().split('\n').map(row=>row.split(' '));rows.forEach(row=>{row[30]='200';row[31]='100';row[32]='40';});
 const lighting=new LocalTimecycle();lighting.load(rows.map(row=>row.join(' ')).join('\n'),'clouds.dat');
 expect(lighting.sample(720)!.lowClouds).toEqual({color:[200,100,40],visibility:0});
 lighting.setWeather(1);expect(lighting.sample(720)!.lowClouds).toEqual({color:[200,100,40],visibility:1});
});
