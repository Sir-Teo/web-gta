import {test,expect} from 'vitest';
import {readFile,writeFile} from 'node:fs/promises';
import {openAsBlob} from 'node:fs';
import {readImgIndex} from '../src/assets/img';
import {readWorldCarGenerators,carGeneratorsInRegion} from '../src/assets/worldCarGenerators';
import {readVehicleIde} from '../src/assets/vehicleIde';
test.skipIf(!process.env.GTA_CONTENT_DIR)('audit native car generators throughout the complete world',async()=>{
 const depot=process.env.GTA_CONTENT_DIR!,manifest=JSON.parse(await readFile('public/play/world/manifest.json','utf8')),archive=await openAsBlob(`${depot}/gta3.img`),entries=await readImgIndex(archive);
 const files=await Promise.all(manifest.resources.filter((r:any)=>r.path.endsWith('.ipl')).map(async(r:any)=>({path:r.path,file:await openAsBlob(`${depot}/${r.path}`)})));
 const records=await readWorldCarGenerators(archive,entries,files);
 expect(new Set(records.map(r=>r.id)).size).toBe(records.length);
 expect(carGeneratorsInRegion(records,{x:2495,y:-1687,radius:180}).map(r=>r.id)).toContain('gta3.img/lae2_stream2.ipl:3');
 const vehicles=readVehicleIde(await readFile(`${depot}/vehicles/vehicles.ide`,'utf8')).records,byId=new Map(vehicles.map(v=>[v.id,v]));
 const report={count:records.length,models:[...new Set(records.map(r=>r.modelId))],unknown:records.filter(r=>r.modelId!==-1&&!byId.has(r.modelId)),records};
 await writeFile('/tmp/gta-car-generators.json',JSON.stringify(report,null,2));expect(report.count).toBe(1043);expect(report.unknown.map(r=>r.id)).toEqual(['gta3.img/vegass_stream0.ipl:0','gta3.img/vegass_stream0.ipl:2','gta3.img/vegass_stream0.ipl:3','gta3.img/vegass_stream0.ipl:4','gta3.img/vegass_stream0.ipl:6','gta3.img/vegass_stream1.ipl:0','gta3.img/vegass_stream3.ipl:1','gta3.img/vegass_stream4.ipl:0']);
});

test('external IPL overrides preserve stable generator identities without duplicate spawns',async()=>{
 const car=(model:number)=>new Blob([`cars\n1, 2, 3, 0, ${model}, -1, -1, 0, 0, 0, -1, -1\nend\n`]);
 const archive=car(402),entries=[{name:'test.ipl',offset:0,length:archive.size,archivedSectors:0}];
 const records=await readWorldCarGenerators(archive,entries,[{path:'maps/TEST.ipl',file:car(421)}]);
 expect(records).toHaveLength(1);expect(records[0]).toMatchObject({id:'maps/TEST.ipl:0',modelId:421});
 expect(carGeneratorsInRegion(records,{x:1,y:2,radius:1})).toHaveLength(1);expect(carGeneratorsInRegion(records,{x:10,y:10,radius:1})).toHaveLength(0);
 await expect(readWorldCarGenerators(archive,entries,[{path:'a/test.ipl',file:car(402)},{path:'b/TEST.ipl',file:car(421)}])).rejects.toThrow('Ambiguous');
 expect(()=>carGeneratorsInRegion(records,{x:0,y:0,radius:NaN})).toThrow('region');
});
import {generatorInRange,GENERATOR_PROCESS_MS} from '../src/assets/worldCarGenerators';
// CCarGenerator::CheckIfWithinRangeOfAnyPlayers: a boat generator the camera sees is in range out to 240 units; any
// other generator idles past 160. CTheCarGenerators::Process visits every generator every fourth 30 fps frame.
test('a visible boat generator counts as in range out to 240 units',()=>{
 const toward={x:-1,y:0};// heading toward a generator 200 units off along +x
 expect(generatorInRange({x:200,y:0},0,toward,false,false,0).eligible).toBe(false);
 expect(generatorInRange({x:200,y:0},0,toward,false,false,0,1,true).eligible).toBe(true);
 expect(generatorInRange({x:250,y:0},0,toward,false,false,0,1,true).eligible).toBe(false);
 // Heading away, or held to wait until far: still not eligible.
 expect(generatorInRange({x:200,y:0},0,{x:1,y:0},false,false,0,1,true).eligible).toBe(false);
 expect(generatorInRange({x:200,y:0},0,toward,true,false,0,1,true).eligible).toBe(false);
 expect(GENERATOR_PROCESS_MS).toBeCloseTo(133.33,1);
});
