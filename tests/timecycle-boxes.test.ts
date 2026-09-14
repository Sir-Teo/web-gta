import {expect,test} from 'vitest';
import {readIpl} from '../src/assets/ipl';
const parse=(row:string)=>readIpl(new TextEncoder().encode(`tcyc\n${row}\nend`));
test('TCYC preserves nine-field defaults and the distinct eleven/twelve-field LOD layouts',()=>{
 const base='-10 -20 -30 10 20 30 1000 -1 75';
 expect(parse(base).timecycleBoxes[0]).toEqual({min:[-10,-20,-30],max:[10,20,30],farClip:1000,extraColor:-1,strengthPercent:75,falloff:100,lodDistanceMultiplier:1,line:2});
 expect(parse(base+' 5').timecycleBoxes[0]).toMatchObject({falloff:5,lodDistanceMultiplier:1});
 expect(parse(base+' 5 .9').timecycleBoxes[0]).toMatchObject({falloff:5,lodDistanceMultiplier:.9});
 expect(parse(base+' 5 99 1.5').timecycleBoxes[0]).toMatchObject({falloff:5,unused:99,lodDistanceMultiplier:1.5});
 expect(parse(base).warnings).toEqual([]);
});
test('TCYC parsing retains source lines and rejects malformed bounds, integer fields and distances',()=>{
 const data=readIpl(new TextEncoder().encode('# header\nTCYC\n0, 0, 0, 1, 1, 1, 800, 0, 100, 5, 0.9 # box\nend\npath\nend'));
 expect(data.timecycleBoxes[0]).toMatchObject({line:3,farClip:800,lodDistanceMultiplier:.9});expect(data.warnings).toEqual(['IPL section path is not imported.']);
 for(const row of ['0 0 0 1 1 1 800 0','0 0 0 1 1 1 800.5 0 100','0 0 0 1 1 1 800 0.5 100','2 0 0 1 1 1 800 0 100','0 0 0 1 1 1 800 0 NaN','0 0 0 1 1 1 800 0 100 -1','0 0 0 1 1 1 800 0 100 5 -1','0 0 0 1 1 1 32768 0 100','0 0 0 1 1 1 800 0 100 5 1 1 1'])expect(()=>parse(row),row).toThrow('IPL line 2');
 expect(()=>readIpl(new TextEncoder().encode('tcyc\n'+'0 0 0 1 1 1 0 0 100\n'.repeat(4097)+'end'))).toThrow('4,096');
});
test('public static IPL content contains eight regional modifiers with source strengths and LOD multipliers',async()=>{
 const root=process.env.GTA_CONTENT_DIR;if(!root)return;
 const {readFile}=await import('node:fs/promises');
 const manifest=JSON.parse(await readFile(root+'/scenes.json','utf8')).sa;
 const boxes=[];
 for(const path of manifest.paths.ipl)for(const box of readIpl(new Uint8Array(await readFile(`${root}/ipl/${path}.ipl`))).timecycleBoxes)boxes.push({path,...box});
 expect(boxes).toHaveLength(8);
 expect(boxes.filter(b=>b.strengthPercent===100)).toHaveLength(3);
 expect(boxes.filter(b=>b.lodDistanceMultiplier===.9)).toHaveLength(4);
 expect(boxes.find(b=>b.path==='country/countryS')).toMatchObject({min:[-2401.76,-2671.99,27.9354],max:[-1901.01,-2170.84,52.2846],farClip:1000,strengthPercent:0,falloff:100});
});
