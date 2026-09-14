import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const source=process.env.GTA_CONTENT_DIR;
test('native big-building audit identifies the Verdant gap without editing its source',{skip:!source,timeout:60000},async()=>{
 const temp=await mkdtemp(join(tmpdir(),'web-gta-big-building-test-'));
 try{
  const run=async multiplier=>{
   const output=join(temp,`${multiplier}.json`);
   const result=spawnSync(process.execPath,['scripts/content/audit-big-buildings.mjs',source,output,String(multiplier)],{encoding:'utf8',timeout:25000,maxBuffer:1024*1024});
   assert.equal(result.status,0,result.stderr+result.stdout);
   return JSON.parse(await readFile(output,'utf8'));
  };
  const standard=await run(1);
  assert.equal(standard.regions.length,9);
  for(const region of standard.regions){
   assert.equal(region.runtimePhysicalPlacements,region.proposedPhysicalPlacements,region.id);
   assert.deepEqual(region.runtimeMissing,region.proposedMissing,region.id);
  }
  assert.ok(standard.regions.every(region=>region.omitted===0&&region.proposedMissing.length===0));
  const verdant=standard.regions.find(region=>region.id==='verdant-meadows');
  assert.equal(verdant.placements,164);
  assert.deepEqual(verdant.linkedOnlyMissing,['lod_airstrm_med_']);
  assert.equal(verdant.additionalBigBuildings.length,1);
  const trailer=verdant.additionalBigBuildings[0];
  assert.equal(trailer.modelId,3347);assert.equal(trailer.drawDistance,400);
  assert.equal(trailer.hasNativeCollision,false);assert.equal(trailer.source.index,161);
  assert.deepEqual(trailer.placement.position,[540.6171875,2360.984375,29.859375]);
  assert.ok(standard.regions.find(region=>region.id==='chiliad-east').additionalBigBuildings.some(entry=>entry.model==='xoverlaymap07'&&entry.hasNativeCollision));
  // Native comparison is strictly greater: 400 * .75 == 300 stays physical.
  const boundary=await run(.75),boundaryVerdant=boundary.regions.find(region=>region.id==='verdant-meadows');
  assert.deepEqual(boundaryVerdant.proposedMissing,['lod_airstrm_med_']);
  assert.equal(boundaryVerdant.additionalBigBuildings.length,0);
  assert.deepEqual(boundaryVerdant.linkedOnlyMissing,verdant.linkedOnlyMissing);
 }finally{await rm(temp,{recursive:true,force:true});}
});
