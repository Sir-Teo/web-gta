import {expect,test,vi} from 'vitest';
import {planWorldFolder,prepareWorldFolder,type WorldFolderFile} from '../src/assets/worldFolder';
import {imgFixture} from './fixtures/native-assets';
const entry=(path:string,text:string):WorldFolderFile=>({path:`depot/${path}`,file:new File([text],path.split('/').at(-1)!)});
const ide=(id:number,name:string)=>`objs\n${id}, ${name}, shared, 100, 0\nend`;
const files=():WorldFolderFile[]=>[
 {path:'depot/gta3.img',file:new File([imgFixture([{name:'sfw_stream0.ipl',bytes:new Uint8Array([0])},{name:'sfn_stream0.ipl',bytes:new Uint8Array([0])}]) as BlobPart],'gta3.img')},
 entry('ide/SF/SFw.ide',ide(1,'bridge')),entry('ide/SF/SFn.ide',ide(2,'north')),
 entry('ipl/SF/SFw.ipl','inst\nend'),entry('ipl/SF/SFn.ipl','inst\nend'),
 entry('ide/leveldes/seabed.ide',ide(5,'seafloor')),entry('ipl/leveldes/seabed.ipl','inst\nend'),
 entry('ide/txd.ide','txdp\nshared, parent\nend'),
];
test('folder plan matches each district stream to its own static source',async()=>{
 const request=await planWorldFolder(files(),'gant-bridge');
 expect(request.staticPlacementFile?.name).toBe('SFw.ipl');expect(request.placementEntry?.name).toBe('sfw_stream0.ipl');
 expect(request.additionalDistricts?.[0].staticPlacementFile?.name).toBe('SFn.ipl');expect(request.additionalDistricts?.[0].placementEntry?.name).toBe('sfn_stream0.ipl');
 expect(request.additionalDistricts?.[1].placementFile?.name).toBe('seabed.ipl');expect(request.additionalDistricts?.[1].placementEntry).toBeUndefined();
 expect(request.parents).toEqual([['shared','parent']]);expect(request.allArchiveCollisions).toBe(true);expect(request.region).toMatchObject({x:-2681.5,y:1850,radius:550,includeCollisionBounds:true});
});
test('custom selection changes the requested area while retaining district sources and native dependencies',async()=>{
 const selection={x:-2700,y:2020,radius:180,includeCollisionBounds:false};
 const request=await planWorldFolder(files(),'gant-bridge',selection);
 expect(request.region).toEqual(selection);expect(request.region).not.toBe(selection);
 expect(request.staticPlacementFile?.name).toBe('SFw.ipl');expect(request.additionalDistricts?.[0].staticPlacementFile?.name).toBe('SFn.ipl');expect(request.additionalDistricts?.[1].placementFile?.name).toBe('seabed.ipl');
 expect(request.environment.weather).toBe(5);expect(request.allArchiveCollisions).toBe(true);
 selection.radius=1;expect(request.region?.radius).toBe(180);
 for(const selection of [{x:NaN,y:0,radius:1},{x:0,y:Infinity,radius:1},{x:1e8,y:0,radius:1},{x:0,y:0,radius:0},{x:0,y:0,radius:-1},{x:0,y:0,radius:1e8}])await expect(planWorldFolder([],'gant-bridge',selection)).rejects.toThrow('content folder region');
});
test('folder plan preserves scoped IDs and only adds unambiguous external definitions',async()=>{
 const source=files();source.push(entry('ide/country/countryS.ide',ide(1,'other')+'\n'+ide(3,'unique')+'\n'+ide(4,'conflict')),entry('ide/leveldes/leveldes.ide',ide(4,'different')));
 const request=await planWorldFolder(source,'gant-bridge');
 expect(request.associations.map(a=>a.model)).toEqual(['bridge','north','seafloor','unique']);
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
 const source=files();source.push(entry('surfinfo.dat','movement'),entry('surfaud.dat','surface'),entry('timecycp.dat','pc'),entry('timecyc.dat','other'),entry('water.dat','water'),entry('particle.txd','particle'),entry('comparison/particle.txd','unrelated'));
 const request=await planWorldFolder(source,'gant-bridge');
 expect(await request.environment.surfaceInfo?.text()).toBe('movement');
 expect(await request.environment.surfaceAudio?.text()).toBe('surface');expect(request.environment.lighting?.name).toBe('timecycp.dat');expect(await request.environment.lighting?.text()).toBe('pc');
 expect(await request.environment.particle?.text()).toBe('particle');expect(request.environment.water?.name).toBe('water.dat');expect(request.environment.weather).toBe(5);
 const missing=await planWorldFolder(files(),'gant-bridge');expect(missing.environment.lighting).toBeUndefined();expect(missing.environment.water).toBeUndefined();expect(missing.environment.particle).toBeUndefined();
});

test('folder loads only direct supplemental native files and preserves archive precedence',async()=>{
 const source=files();source[0]={path:'depot/gta3.img',file:new File([imgFixture([{name:'present.dff',bytes:new Uint8Array([1])},{name:'present.txd',bytes:new Uint8Array([1])}]) as BlobPart],'gta3.img')};
 source.push(entry('supplemental/missing.dff','model'),entry('supplemental/missing.txd','texture'),entry('supplemental/2630.col','collision'),entry('supplemental/present.dff','override'),entry('supplemental/present.txd','override'),entry('comparison/ignored.dff','unrelated'),entry('supplemental/nested/ignored.dff','nested'));
 const request=await planWorldFolder(source,'gant-bridge');
 expect(request.modelFiles?.map(f=>f.name)).toEqual(['missing.dff']);
 expect(request.textureFiles?.map(f=>f.name)).toEqual(['missing.txd']);
 expect(request.additionalCollisionFiles?.map(f=>f.name)).toEqual(['2630.col']);
});

test('folder attaches a complete classic CJ bundle using exact player and animation paths',async()=>{
 const {PLAYER_CLASSIC_FILES}=await import('../src/assets/readPlayerBaseBody');
 const source=files();source.push(...PLAYER_CLASSIC_FILES.map(name=>entry(`player/${name}`,'body')));
 expect((await planWorldFolder(source,'gant-bridge')).environment.player).toBeUndefined();
 source.push(entry('animations/ped.ifp','movement'));
 const player=(await planWorldFolder(source,'gant-bridge')).environment.player!;
 expect(player.body.map(f=>f.name)).toEqual([...PLAYER_CLASSIC_FILES]);expect(await player.animations.text()).toBe('movement');
 expect((await planWorldFolder(source.filter(f=>!f.path.endsWith('/jeans.dff')),'gant-bridge')).environment.player).toBeUndefined();
});

test('prepared folder reuses discovery indexes and isolates returned metadata from later requests',async()=>{
 const placement=entry('ipl/LA/LAe2.ipl','inst\n1 terrain 0 0 0 0 0 0 0 1 -1\nend');
 const definition=entry('ide/LA/LAe2.ide',ide(1,'terrain'));
 const source=[{path:'depot/gta3.img',file:new File([imgFixture([]) as BlobPart],'gta3.img')},definition,placement];
 const reads=vi.spyOn(placement.file,'arrayBuffer'),definitions=vi.spyOn(definition.file,'arrayBuffer');
 const session=await prepareWorldFolder(source),region={x:0,y:0,radius:2,includeCollisionBounds:false};
 const [first,second]=await Promise.all([session.plan('grove-street',region,true),session.plan('mount-chiliad',region,true)]);
 expect(first.sourceDistricts).toEqual(['la/lae2']);expect(second.sourceDistricts).toEqual(first.sourceDistricts);
 expect(session.indexBuilds).toBe(1);expect(reads).toHaveBeenCalledTimes(1);expect(definitions).toHaveBeenCalledTimes(1);
 first.associations[0].model='mutated';first.sourceDistricts.length=0;source.length=0;
 const again=await session.plan('grove-street',region,true);expect(again.associations[0].model).toBe('terrain');expect(again.sourceDistricts).toEqual(['la/lae2']);
 await expect(session.plan('grove-street',{...region,x:100},true)).rejects.toThrow('No supplied district');
 await session.plan('grove-street',region,true);expect(session.indexBuilds).toBe(1);
 await session.plan('grove-street',{...region,includeCollisionBounds:true},true);expect(session.indexBuilds).toBe(2);expect(reads).toHaveBeenCalledTimes(2);expect(definitions).toHaveBeenCalledTimes(1);
 await expect(session.plan('grove-street',{...region,x:NaN},true)).rejects.toThrow('Invalid');expect(session.indexBuilds).toBe(2);
});

test('a failed source index is not retained and a new folder session reads its own inputs',async()=>{
 const placement=entry('ipl/LA/LAe2.ipl','inst\n1 terrain 0 0 0 0 0 0 0 1 -1\nend');
 const source=[{path:'depot/gta3.img',file:new File([imgFixture([]) as BlobPart],'gta3.img')},entry('ide/LA/LAe2.ide',ide(1,'terrain')),placement];
 const read=vi.spyOn(placement.file,'arrayBuffer').mockRejectedValueOnce(new Error('Temporary read failure'));
 const session=await prepareWorldFolder(source),region={x:0,y:0,radius:2};
 await expect(session.plan('grove-street',region,true)).rejects.toThrow('Temporary read');
 expect((await session.plan('grove-street',region,true)).sourceDistricts).toEqual(['la/lae2']);expect(session.indexBuilds).toBe(2);
 const next=await prepareWorldFolder(source);await next.plan('grove-street',region,true);expect(next.indexBuilds).toBe(1);expect(read).toHaveBeenCalledTimes(3);
});

test('prepared folder returns independent archive entry records for each request',async()=>{
 const session=await prepareWorldFolder(files()),first=await session.plan('gant-bridge');
 first.placementEntry!.name='changed.ipl';first.additionalDistricts![0].placementEntry!.offset=0;
 const second=await session.plan('gant-bridge');expect(second.placementEntry!.name).toBe('sfw_stream0.ipl');expect(second.additionalDistricts![0].placementEntry!.offset).toBeGreaterThan(0);
});
