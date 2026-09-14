import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('SFX audit resolves multiple packages, reports exact PCM and preserves existing output',async()=>{
 const root=await mkdtemp(join(tmpdir(),'web-gta-sfx-audit-test-'));
 try{
  await mkdir(join(root,'audio','CONFIG'),{recursive:true});await mkdir(join(root,'audio','SFX'));
  const packages=Buffer.alloc(104);packages.write('SECOND',0);packages.write('FIRST',52);
  const lookup=Buffer.alloc(24),bank=Buffer.alloc(4808);
  bank.writeUInt16LE(1,0);bank.writeUInt32LE(0xffffffff,8);bank.writeUInt16LE(8000,12);bank.writeInt16LE(-3,14);
  bank.writeInt16LE(-32768,4804);bank.writeInt16LE(16384,4806);
  for(const [id,pkg,offset] of [[0,1,32],[1,0,64]]){
   lookup.writeUInt8(pkg,id*12);lookup.writeUInt32LE(offset,id*12+4);lookup.writeUInt32LE(4,id*12+8);
   await writeFile(join(root,'audio','SFX',pkg?'FIRST':'SECOND'),Buffer.concat([Buffer.alloc(offset),bank]));
  }
  await writeFile(join(root,'audio','CONFIG','PakFiles.dat'),packages);await writeFile(join(root,'audio','CONFIG','BankLkup.dat'),lookup);
  const output=join(root,'report.json'),run=()=>spawnSync(process.execPath,[resolve('scripts/content/audit-sfx.mjs'),root,output,'0','1'],{encoding:'utf8'});
  const result=run();assert.equal(result.status,0,result.stderr);
  const original=await readFile(output,'utf8'),report=JSON.parse(original);
  assert.deepEqual(report.selected.map(b=>[b.bankId,b.packageName,b.offset]),[[0,'FIRST',32],[1,'SECOND',64]]);
  const sound=report.selected[0].sounds[0];assert.equal(sound.sampleRate,8000);assert.equal(sound.seconds,.00025);assert.equal(sound.peak,1);assert.equal(sound.headroom,-3);assert.equal(sound.loopStartOffset,0xffffffff);
  assert.equal(sound.rms,Math.sqrt(.625));assert.match(sound.sha256,/^[a-f0-9]{64}$/);
  assert.notEqual(run().status,0);assert.equal(await readFile(output,'utf8'),original);
 }finally{await rm(root,{recursive:true,force:true});}
});
