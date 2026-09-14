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
  it('rejects truncated, nonfinite, malformed and oversized input',()=>{
    for(const [index,value] of [[2,'Infinity'],[3,'1e40'],[6,'1.0'],[6,'2147483648'],[6,'0x1'],[0,'x'.repeat(64)],[1,'x'.repeat(32)],[0,'bad\0name']] as const){
      const tokens=row();tokens[index]=value;expect(()=>readSurfaceInfo(tokens.join(' '))).toThrow();
    }
    expect(()=>readSurfaceInfo(row().slice(1).join(' '))).toThrow('36 columns');
    expect(readSurfaceInfo(row().join(' ')+' TEST # trailing source annotation')).toEqual(readSurfaceInfo(row().join(' ')));
    expect(()=>readSurfaceInfo(' '.repeat(4*1024*1024+1))).toThrow('4 MiB');
    expect(()=>readSurfaceInfo((row().join(' ')+'\n').repeat(50001))).toThrow();
  });
});

it.skipIf(!process.env.GTA_CONTENT_DIR)('reads all acquired native surface rows and explicit wheel adhesion pairs',async()=>{
 const {readFileSync}=await import('node:fs');const {createHash}=await import('node:crypto');
 const {nativeSurfaceId,nativeSurfaceName}=await import('../src/assets/surfaceIds');
 const {readSurfaceAdhesion,surfaceAdhesiveLimit}=await import('../src/assets/surfaceAdhesion');
 const root=process.env.GTA_CONTENT_DIR!,lock=JSON.parse(readFileSync('scripts/content/world-sources.json','utf8'));
 const load=(name:string)=>{
  const bytes=readFileSync(`${root}/${name}`),expected=lock.resources.find((r:{path:string})=>r.path===name);
  expect(bytes.length).toBe(expected.bytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(expected.sha256);
  return bytes.toString('utf8');
 };
 const records=readSurfaceInfo(load('surfinfo.dat')).records,byName=indexSurfaceInfo(records);
 expect(records).toHaveLength(179);expect(byName.size).toBe(179);
 expect(new Set(records.map(r=>nativeSurfaceId(r.name))).size).toBe(179);
 for(const record of records){expect(nativeSurfaceName(nativeSurfaceId(record.name))).toBe(record.name);expect(record.issues).toEqual([]);}
 expect(byName.get('SAND_DEEP')).toMatchObject({adhesionGroup:'SAND',tyreGrip:1,wetGrip:.5});
 expect(byName.get('CARPET')?.values.sprint).toBe(1);expect(byName.get('TARMAC')?.values.sprint).toBe(0);
 const {rows}=readSurfaceAdhesion(load('surface.dat'));
 expect(rows.map(r=>r.cells)).toEqual([[6],[3.6,2],[4.5,3,6],[3.2,3.5,2,1],[3,4,2,1,1],[2.8,2,1,1,1,.5]]);
 const wheel=byName.get('WHEELBASE')!;
 expect(surfaceAdhesiveLimit(rows,wheel,byName.get('TARMAC')!)).toBe(4.5);
 expect(surfaceAdhesiveLimit(rows,wheel,byName.get('SAND_DEEP')!)).toBe(3);
});
