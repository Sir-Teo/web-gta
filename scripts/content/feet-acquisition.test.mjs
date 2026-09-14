import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {mediafireDownloadUrl,readLimitedPage,acquireArchivePrefix} from './lib/feet-acquisition.mjs';
test('download discovery accepts only the expected HTTPS host and bounds source pages',async()=>{
 assert.equal(mediafireDownloadUrl('<a href="https://download1.mediafire.com/path?a=1&amp;b=2">'),'https://download1.mediafire.com/path?a=1&b=2');
 for(const page of ['no link','<a href="https://download.evil.test/a">'])assert.throws(()=>mediafireDownloadUrl(page));
 await assert.rejects(readLimitedPage(new Response('12345'),4));assert.equal(await readLimitedPage(new Response('ok')),'ok');
});
test('archive prefix requires exact partial response and verifies content without replacing good data on failure',async()=>{
 const root=await mkdtemp(join(tmpdir(),'feet-prefix-test-')),path=join(root,'prefix');
 const data=Buffer.from('four'),lock={downloadedRange:[0,3],archiveBytes:100,prefixSha256:createHash('sha256').update(data).digest('hex')};
 try{
  await writeFile(path,'old');
  for(const response of [new Response(data),new Response(data,{status:206,headers:{'content-range':'bytes 0-3/101'}}),new Response('bad!',{status:206,headers:{'content-range':'bytes 0-3/100'}})]){
   await assert.rejects(acquireArchivePrefix(path,lock,'https://example.test',async()=>response));assert.equal(await readFile(path,'utf8'),'old');
  }
  await acquireArchivePrefix(path,lock,'https://example.test',async(_url,options)=>{
   assert.equal(options.headers.Range,'bytes=0-3');return new Response(data,{status:206,headers:{'content-range':'bytes 0-3/100'}});
  });assert.equal(await readFile(path,'utf8'),'four');
 }finally{await rm(root,{recursive:true,force:true});}
});
