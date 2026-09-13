import {expect,test} from 'vitest';
import {readTimecycle,TIMECYCLE_FIELDS,timecycleInterval} from '../src/assets/timecycle';
const rows=()=>Array.from({length:184},(_,r)=>Array.from({length:52},(_,c)=>String(c===51?r/100:c)).join(' '));
test('native timecycle keeps weather-major samples, field order and original numeric precision',()=>{
  const lines=rows();lines[0]=lines[0].replaceAll(' ',',\t');
  const data=readTimecycle('\uFEFF// original diagnostic values\r\n\r\n'+lines.join('\r\n'));
  expect(TIMECYCLE_FIELDS).toHaveLength(52);expect(TIMECYCLE_FIELDS[40]).toBe('postFx1Alpha');expect(TIMECYCLE_FIELDS[51]).toBe('directionalMultiplier');
  expect(data.rows[8]).toMatchObject({weather:1,hour:0,line:11});expect(data.rows[183]).toMatchObject({weather:22,hour:22});
  expect(data.rows[183].values[51]).toBe(1.83);expect(data.rows.every(r=>r.issues.length===0)).toBe(true);expect(data.warnings).toEqual([]);
});
test('missing and shifted fields remain inspectable without inventing values',()=>{
  const lines=rows();lines[0]=lines[0].split(' ').slice(0,51).join(' ');lines[1]='255 '+lines[1].split(' ').slice(3).join(' ');lines[2]=lines[2].replace(/^0 /,'0.5 ');
  const data=readTimecycle(lines.join('\n'));expect(data.rows[0].values).toHaveLength(51);expect(data.warnings).toHaveLength(1);
  expect(data.rows[1].values).toHaveLength(50);expect(data.rows[1].issues[0]).toContain('not safe to apply');expect(data.rows[2].issues[0]).toContain('ambientR');
});
test('timecycle bounds reject incomplete files and invalid numeric syntax',()=>{
  expect(()=>readTimecycle('')).toThrow('184');expect(()=>readTimecycle([...rows(),rows()[0]].join('\n'))).toThrow('184');
  for(const token of ['NaN','Infinity','0xFF','1e999'])expect(()=>readTimecycle(rows().join('\n').replace(/^0 /,token+' '))).toThrow('number');
  expect(()=>readTimecycle(' '.repeat(1024*1024+1))).toThrow('1 MiB');
});
test('native intervals preserve uneven hour spacing, fractional time and midnight clamping',()=>{
  expect(timecycleInterval(330)).toEqual({current:1,next:2,blend:.5});expect(timecycleInterval(570)).toEqual({current:3,next:4,blend:.5});
  expect(timecycleInterval(1380)).toEqual({current:7,next:0,blend:.5});expect(timecycleInterval(1440)).toEqual({current:0,next:1,blend:0});
  expect(timecycleInterval(-60)).toEqual(timecycleInterval(1380));expect(timecycleInterval(360.5).blend).toBeCloseTo(1/120);
  expect(timecycleInterval(1439.999).blend).toBeCloseTo(.9995);expect(()=>timecycleInterval(NaN)).toThrow('finite');
});
