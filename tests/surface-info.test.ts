import {describe,expect,it} from 'vitest';
import {indexSurfaceInfo,readSurfaceInfo} from '../src/assets/surfaceInfo';

const row=(name='TEST')=>[name,'ROAD','1.25','-.375','DEFAULT','SPARKS',...Array(29).fill('0'),'DUST'];
describe('raw surface info',()=>{
  it('maps every column independently and retains file precision and signed flags',()=>{
    const tokens=row();for(let i=6;i<35;i++)tokens[i]=String(i-5);
    const record=readSurfaceInfo(tokens.join(' ')).records[0];
    expect(record).toMatchObject({name:'TEST',line:1,adhesionGroup:'ROAD',tyreGrip:1.25,wetGrip:-.375,skidMark:'DEFAULT',frictionEffect:'SPARKS',bulletFx:'DUST'});
    expect(record.values).toEqual({softLand:1,seeThrough:2,shootThrough:3,sand:4,water:5,shallowWater:6,beach:7,
      steepSlope:8,glass:9,stairs:10,skateable:11,pavement:12,roughness:13,flame:14,sparks:15,sprint:16,footsteps:17,
      footDust:18,carDirt:19,carClean:20,wheelGrass:21,wheelGravel:22,wheelMud:23,wheelDust:24,wheelSand:25,
      wheelSpray:26,procPlant:27,procObj:28,climbable:29});
    expect(record.issues).toContain('roughness requires native two-bit narrowing.');
    expect(record.issues).toContain('seeThrough requires native boolean conversion.');
  });
  it('handles source line separators and comments, preserving duplicates and line provenance',()=>{
    const a=row(),b=row();b[3]='-.5';
    const {records}=readSurfaceInfo('\uFEFF # material data\r\n\n'+a.join(',')+'\r\n'+b.join('\t'));
    expect(records.map(r=>r.line)).toEqual([3,4]);
    expect(indexSurfaceInfo(records).get('TEST')?.wetGrip).toBe(-.5);
    expect(indexSurfaceInfo(records).has('test')).toBe(false);
    expect(records[0].issues).toEqual([]);
  });
  it('retains unknown categories and unconverted values without assigning default surfaces',()=>{
    const tokens=row();tokens[1]='CUSTOM';tokens[4]='custom';tokens[5]='MORE';tokens[35]='SMOKE';tokens[6]='-2';tokens[18]='7';
    const record=readSurfaceInfo(tokens.join(' ')).records[0];
    expect(record.adhesionGroup).toBe('CUSTOM');expect(record.values.softLand).toBe(-2);
    expect(record.issues).toHaveLength(6);
  });
  it('rejects truncated, extra, nonfinite, malformed and oversized input',()=>{
    for(const [index,value] of [[2,'Infinity'],[3,'1e40'],[6,'1.0'],[6,'2147483648'],[6,'0x1'],[0,'x'.repeat(64)],[1,'x'.repeat(32)],[0,'bad\0name']] as const){
      const tokens=row();tokens[index]=value;expect(()=>readSurfaceInfo(tokens.join(' '))).toThrow();
    }
    expect(()=>readSurfaceInfo(row().slice(1).join(' '))).toThrow('36 columns');
    expect(()=>readSurfaceInfo(row().join(' ')+' extra')).toThrow('36 columns');
    expect(()=>readSurfaceInfo(' '.repeat(4*1024*1024+1))).toThrow('4 MiB');
    expect(()=>readSurfaceInfo((row().join(' ')+'\n').repeat(50001))).toThrow();
  });
});
