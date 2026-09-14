import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,copyFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const source=process.env.GTA_CONTENT_DIR;
test('world audit uses browser planning and reports dictionary conflicts as failures',{skip:!source,timeout:90000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'web-gta-world-audit-test-'));
 try{
  const report=JSON.parse(await readFile(join(source,'world-content.json'),'utf8'));
  // Copy metadata only. Keep the large native archive read-only through a link.
  await symlink(resolve(source,'gta3.img'),join(root,'gta3.img'));
  for(const resource of [...report.resources,...(report.supplementalFiles??[])]){
   const local=relative(resolve(source),resource.path);
   assert.ok(local&&!local.startsWith('..'));
   const destination=join(root,local);await mkdir(dirname(destination),{recursive:true});
   await copyFile(resource.path,destination);resource.path=destination;
  }
  await writeFile(join(root,'world-content.json'),JSON.stringify(report));
  const run=()=>spawnSync(process.execPath,['scripts/content/audit-world.mjs',join(root,'gta3.img'),root],{encoding:'utf8',timeout:40000,maxBuffer:1024*1024});
  let result=run();assert.equal(result.status,0,result.stderr+result.stdout);
  const valid=JSON.parse(await readFile(join(root,'world-content.json'),'utf8'));
  assert.equal(valid.regions.length,9);
  assert.ok(valid.regions.every(r=>r.planner==='browser-folder'&&!r.error));
  const overlap=valid.regionOverlaps.find(r=>r.from==='mount-chiliad'&&r.to==='chiliad-east');
  assert.deepEqual(overlap,{from:'mount-chiliad',to:'chiliad-east',retained:90,retainedPhysical:48,added:337,removed:113,replaced:0,unresolvedLodTargets:0});
  assert.equal(valid.regionOverlaps.length,2);
  for(const entry of valid.regionOverlaps){
   const before=valid.regions.find(r=>r.id===entry.from),after=valid.regions.find(r=>r.id===entry.to);
   assert.equal(entry.retained+entry.removed+entry.replaced,before.requested-before.omitted);
   assert.equal(entry.retained+entry.added+entry.replaced,after.requested-after.omitted);
   const reverse=valid.regionOverlaps.find(r=>r.from===entry.to&&r.to===entry.from);
   assert.equal(reverse.retained,entry.retained);assert.equal(reverse.added,entry.removed);assert.equal(reverse.removed,entry.added);
  }
  const grove=valid.regions.find(r=>r.id==='grove-street');
  assert.equal(grove.models,238);assert.equal(grove.requested,550);assert.equal(grove.omitted,0);assert.deepEqual(grove.missingCollision,[]);
  for(const model of ['stormdraifr1_las2','btoroad1mnk_las2','riverbridls_las2'])assert.ok(grove.content.some(p=>p.model===model&&p.collision));
  for(const [id,models,placements,required] of [
   ['mount-chiliad',128,203,['cuntwland06b','cuntwland37_sfs','sbcs_seabit15_new']],
   ['las-venturas',139,345,['skllsgn01_lvs','ballyring01_lvs']],
   ['chiliad-east',224,427,['southtunnel_04_sfs','stunnel_1a_sfse','roadssfse27']],
   ['santa-maria',354,1545,['beach1a1_las','clifftest12','clifftestgrnd']],
  ]){
   const region=valid.regions.find(r=>r.id===id);assert.equal(region.models,models);assert.equal(region.requested,placements);assert.equal(region.omitted,0);assert.deepEqual(region.missingCollision,[]);
   for(const model of required)assert.ok(region.content.some(p=>p.model===model&&p.collision),`${id}: ${model}`);
  }
  const gant=valid.regions.find(r=>r.id==='gant-bridge');
  assert.equal(gant.models,266);assert.equal(gant.requested,581);assert.equal(gant.omitted,0);
  assert.deepEqual(gant.missingCollision,[]);
  assert.ok(gant.content.some(p=>p.model==='sbseabed_sfn02'&&p.collision));
  const dam=valid.regions.find(r=>r.id==='sherman-dam');
  assert.equal(dam.models,109);assert.equal(dam.requested,162);assert.equal(dam.omitted,0);
  assert.deepEqual(dam.missingCollision,[]);
  for(const model of ['dambit1','dambit2','dam_turbine_1','sbcn_seafloor03'])assert.ok(dam.content.some(p=>p.model===model&&p.collision));
  const coverage=spawnSync(process.execPath,['scripts/content/audit-district-index.mjs',root],{encoding:'utf8',timeout:40000,maxBuffer:1024*1024});
  assert.equal(coverage.status,0,coverage.stderr+coverage.stdout);
  const indexed=JSON.parse(await readFile(join(root,'district-index.json'),'utf8'));
  assert.equal(indexed.districts.length,53);assert.equal(indexed.districts.reduce((sum,d)=>sum+d.exteriorPlacements,0),44818);
  for(const region of indexed.regions)assert.deepEqual(region.unselectedSources,[],region.id);
  const textureAudit=spawnSync(process.execPath,['scripts/content/audit-texture-bindings.mjs',root],{encoding:'utf8',timeout:40000,maxBuffer:1024*1024});
  assert.equal(textureAudit.status,0,textureAudit.stderr+textureAudit.stdout);
  const textures=JSON.parse(await readFile(join(root,'texture-bindings.json'),'utf8'));
  assert.equal(textures.dictionariesScanned,2750);assert.deepEqual(textures.scanErrors,[]);assert.equal(textures.bindings.length,10);
  assert.equal(textures.bindings.filter(b=>b.classification==='absent-from-world-archive').length,4);
  assert.equal(textures.bindings.filter(b=>b.classification==='outside-loaded-chain').length,6);
  const canopy=textures.bindings.find(b=>b.model==='kb_canopy_test');assert.equal(canopy.texture,'kb_canopy128');assert.equal(canopy.classification,'absent-from-world-archive');assert.deepEqual(canopy.loadedChain,['canopy.txd']);
  const canal=textures.bindings.find(b=>b.model==='lodcanal_floor3');assert.equal(canal.classification,'outside-loaded-chain');assert.deepEqual(canal.loadedChain,['canalsg_law.txd']);
  assert.equal(canal.candidates.length,1);assert.equal(canal.candidates[0].dictionary,'lod_a_law.txd');assert.equal(canal.candidates[0].width,32);assert.equal(canal.candidates[0].height,64);assert.equal(canal.candidates[0].format,'DXT1');
  const path=join(root,'ide/SF/SFw.ide');
  const changed=Buffer.from((await readFile(path,'utf8'))+'\nobjs\n9482, chinagate, conflicting_dictionary, 100, 0\nend\n');
  await writeFile(path,changed);
  // Mark the deliberately altered local fixture cached so acquisition does not
  // replace it before the actual region-planning regression is exercised.
  const resource=valid.resources.find(r=>r.path===path);assert.ok(resource);
  resource.bytes=changed.length;resource.sha256=createHash('sha256').update(changed).digest('hex');
  await writeFile(join(root,'world-content.json'),JSON.stringify(valid));
  result=run();assert.equal(result.status,1,result.stderr+result.stdout);
  const broken=JSON.parse(await readFile(join(root,'world-content.json'),'utf8'));
  assert.match(broken.regions.find(r=>r.id==='gant-bridge').error,/Conflicting IDE dictionaries for chinagate/);
  assert.equal(broken.regions.find(r=>r.id==='grove-street').omitted,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
