import {expect,test} from 'vitest';
import {planWorldFolder,type WorldFolderFile} from '../src/assets/worldFolder';
import {imgFixture} from './fixtures/native-assets';
const entry=(path:string,text:string):WorldFolderFile=>({path:`depot/${path}`,file:new File([text],path.split('/').at(-1)!)});
const ide=(id:number,name:string)=>`objs\n${id}, ${name}, shared, 100, 0\nend`;
const files=():WorldFolderFile[]=>[
 {path:'depot/gta3.img',file:new File([imgFixture([{name:'sfw_stream0.ipl',bytes:new Uint8Array([0])},{name:'sfn_stream0.ipl',bytes:new Uint8Array([0])}]) as BlobPart],'gta3.img')},
 entry('ide/SF/SFw.ide',ide(1,'bridge')),entry('ide/SF/SFn.ide',ide(2,'north')),
 entry('ipl/SF/SFw.ipl','inst\nend'),entry('ipl/SF/SFn.ipl','inst\nend'),
 entry('ide/txd.ide','txdp\nshared, parent\nend'),
];
test('folder plan matches each district stream to its own static source',async()=>{
 const request=await planWorldFolder(files(),'gant-bridge');
 expect(request.staticPlacementFile?.name).toBe('SFw.ipl');expect(request.placementEntry?.name).toBe('sfw_stream0.ipl');
 expect(request.additionalDistricts?.[0].staticPlacementFile?.name).toBe('SFn.ipl');expect(request.additionalDistricts?.[0].placementEntry?.name).toBe('sfn_stream0.ipl');
 expect(request.parents).toEqual([['shared','parent']]);expect(request.allArchiveCollisions).toBe(true);expect(request.region).toMatchObject({x:-2681.5,y:1850,radius:550,includeCollisionBounds:true});
});
test('folder plan preserves scoped IDs and only adds unambiguous external definitions',async()=>{
 const source=files();source.push(entry('ide/country/countryS.ide',ide(1,'other')+'\n'+ide(3,'unique')+'\n'+ide(4,'conflict')),entry('ide/leveldes/leveldes.ide',ide(4,'different')));
 const request=await planWorldFolder(source,'gant-bridge');
 expect(request.associations.map(a=>a.model)).toEqual(['bridge','north','unique']);
});
test('folder selection reports missing exact paths and rejects duplicates or mixed roots',async()=>{
 const source=files();
 await expect(planWorldFolder(source.filter(f=>!f.path.endsWith('SFn.ipl')),'gant-bridge')).rejects.toThrow('ipl/SF/SFn.ipl');
 await expect(planWorldFolder([...source,{...source[0],path:'depot/GTA3.IMG'}],'gant-bridge')).rejects.toThrow('Duplicate');
 await expect(planWorldFolder([...source,entry('../gta3.img','')],'gant-bridge')).rejects.toThrow('Invalid');
 await expect(planWorldFolder([...source,{...source[0],path:'another/gta3.img'}],'gant-bridge')).rejects.toThrow('one content folder');
 await expect(planWorldFolder(source,'unknown')).rejects.toThrow('named map region');
});
test('folder does not silently apply optional repair files or unrelated texture overrides',async()=>{
 const source=files();source.push(entry('repairs/verdant-lod/countn2_stream2.ipl','repair'),entry('comparison/shared.txd','override'));
 const request=await planWorldFolder(source,'gant-bridge');
 expect(request.textureFiles).toBeUndefined();expect(request.additionalPlacementFiles).toBeUndefined();
});
test('folder attaches exact root environment files and selects a regional sunny row',async()=>{
 const source=files();source.push(entry('surfaud.dat','surface'),entry('timecycp.dat','pc'),entry('timecyc.dat','other'),entry('water.dat','water'),entry('particle.txd','particle'),entry('comparison/particle.txd','unrelated'));
 const request=await planWorldFolder(source,'gant-bridge');
 expect(await request.environment.surfaceAudio?.text()).toBe('surface');expect(request.environment.lighting?.name).toBe('timecycp.dat');expect(await request.environment.lighting?.text()).toBe('pc');
 expect(await request.environment.particle?.text()).toBe('particle');expect(request.environment.water?.name).toBe('water.dat');expect(request.environment.weather).toBe(5);
 const missing=await planWorldFolder(files(),'gant-bridge');expect(missing.environment.lighting).toBeUndefined();expect(missing.environment.water).toBeUndefined();expect(missing.environment.particle).toBeUndefined();
});
