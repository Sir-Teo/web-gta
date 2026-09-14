import {expect,test} from 'vitest';
import {readSfxBankLookups,readSfxPackageNames,readSfxBank,readSfxBankFile,sfxPcmSamples,SFX_BANK_HEADER_BYTES} from '../src/assets/sfx';
function bank(){
 const bytes=new Uint8Array(SFX_BANK_HEADER_BYTES+10),v=new DataView(bytes.buffer);v.setUint16(0,2,true);
 for(const [i,offset,rate,headroom,loop] of [[0,0,22050,-7,0xffffffff],[1,6,11025,120,1]]){
  const p=4+i*12;v.setUint32(p,offset,true);v.setUint32(p+4,loop,true);v.setUint16(p+8,rate,true);v.setInt16(p+10,headroom,true);
 }
 [-32768,0,32767,-1,16384].forEach((n,i)=>v.setInt16(SFX_BANK_HEADER_BYTES+i*2,n,true));return bytes;
}
test('PC SFX samples preserve frequency, signed headroom, raw loop offset and exact PCM',()=>{
 const bytes=bank(),sounds=readSfxBank(bytes,10);
 expect(sounds.map(s=>[s.sampleRate,s.headroom,s.loopStartOffset,s.pcm16.length])).toEqual([[22050,-7,0xffffffff,6],[11025,120,1,4]]);
 expect([...sfxPcmSamples(sounds[0])]).toEqual([-1,0,32767/32768]);expect([...sfxPcmSamples(sounds[1])]).toEqual([-1/32768,.5]);
 bytes.fill(0);expect(sfxPcmSamples(sounds[0])[0]).toBe(-1);
});
test('SFX package reader slices a bank at a nonzero byte offset',async()=>{
 const bytes=bank(),packageBytes=new Uint8Array(bytes.length+64);packageBytes.set(bytes,32);
 const file=new Blob([packageBytes]);const sounds=await readSfxBankFile(file,{packageIndex:0,offset:32,dataBytes:10});
 expect(sounds).toHaveLength(2);expect(sfxPcmSamples(sounds[1])[1]).toBe(.5);
 await expect(readSfxBankFile(file,{packageIndex:0,offset:64,dataBytes:11})).rejects.toThrow('range exceeds');
});
test('SFX lookup padding and byte offsets are decoded from subarrays',()=>{
 const bytes=new Uint8Array(14),v=new DataView(bytes.buffer);v.setUint8(1,3);v.setUint32(5,4099,true);v.setUint32(9,9000,true);
 expect(readSfxBankLookups(bytes.subarray(1,13))).toEqual([{packageIndex:3,offset:4099,dataBytes:9000}]);
 const packages=new Uint8Array(104);packages.set(new TextEncoder().encode('FEET'));packages.set(new TextEncoder().encode('GENRL'),52);packages[12]=255;
 expect(readSfxPackageNames(packages)).toEqual(['FEET','GENRL']);
 packages[0]=47;expect(()=>readSfxPackageNames(packages)).toThrow('filename');
 expect(()=>readSfxBankLookups(bytes)).toThrow('lookup size');
});
test('SFX bank rejects truncated headers, oversized counts, odd/reversed offsets and zero rates',()=>{
 expect(()=>readSfxBank(bank().subarray(0,100),10)).toThrow('mismatched');
 for(const mutate of [(v:DataView)=>v.setUint16(0,401,true),(v:DataView)=>v.setUint32(16,3,true),(v:DataView)=>v.setUint32(4,8,true),(v:DataView)=>v.setUint16(12,0,true)]){
  const bytes=bank();mutate(new DataView(bytes.buffer));expect(()=>readSfxBank(bytes,10)).toThrow();
 }
});

test('global bank IDs resolve through package indices rather than assuming FEET or GENRL',async()=>{
 const {resolveSfxBank}=await import('../src/assets/sfx');
 const banks=[{packageIndex:1,offset:100,dataBytes:6},{packageIndex:0,offset:40,dataBytes:12}];
 expect(resolveSfxBank(0,banks,['GENRL','FEET'])).toEqual({bankId:0,packageName:'FEET',lookup:banks[0]});
 expect(resolveSfxBank(1,banks,['GENRL','FEET']).packageName).toBe('GENRL');
 for(const id of [-1,.5,2,NaN])expect(()=>resolveSfxBank(id,banks,['GENRL','FEET'])).toThrow('bank ID');
 expect(()=>resolveSfxBank(0,banks,['GENRL'])).toThrow('missing package');
});
