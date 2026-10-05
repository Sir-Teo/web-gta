/** The iOS port's executable (the gta3sa.app bundle, github.com/Google61/gta3sa.app, decrypted: cryptid 0), read as
 * its arm64 slice. scanner-tables.mjs and radio-tables.mjs read their tables out of it. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const REVISION='67f70cb72eb207aeca650ea9e8c10b0e7dda166a';
export const SOURCE={url:`https://raw.githubusercontent.com/Google61/gta3sa.app/${REVISION}/gta3sa`,bytes:14226544,
 sha256:'9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78'};
/** Reads the executable (from `path`, or downloaded from the pinned revision), checks it against its hash and maps
 * the arm64 slice's VM addresses to the file. */
export async function readExecutable(path){
 const file=path?await readFile(path):Buffer.from(await (await fetch(SOURCE.url,{signal:AbortSignal.timeout(300000)})).arrayBuffer());
 if(file.length!==SOURCE.bytes||createHash('sha256').update(file).digest('hex')!==SOURCE.sha256)throw new Error('The iOS executable is not the pinned one.');
 // The universal binary's arm64 slice (CPU_TYPE_ARM64), and its segments' VM addresses against file offsets.
 if(file.readUInt32BE(0)!==0xcafebabe)throw new Error('Not a universal Mach-O.');
 let slice=-1;
 for(let i=0;i<file.readUInt32BE(4);i++)if(file.readUInt32BE(8+i*20)===0x0100000c)slice=file.readUInt32BE(8+i*20+8);
 if(slice<0||file.readUInt32LE(slice)!==0xfeedfacf)throw new Error('No arm64 slice.');
 const segments=[];
 for(let i=0,at=slice+32;i<file.readUInt32LE(slice+16);i++){
  const cmd=file.readUInt32LE(at),size=file.readUInt32LE(at+4);
  if(cmd===0x19)segments.push({vm:Number(file.readBigUInt64LE(at+24)),fileoff:Number(file.readBigUInt64LE(at+40)),filesize:Number(file.readBigUInt64LE(at+48))});
  at+=size;
 }
 const offset=address=>{
  const s=segments.find(s=>address>=s.vm&&address<s.vm+s.filesize);
  if(!s)throw new Error(`Address ${address.toString(16)} is not in the file.`);
  return slice+s.fileoff+address-s.vm;
 };
 return {file,offset,
  int16s:(address,count)=>Array.from({length:count},(_,i)=>file.readInt16LE(offset(address)+i*2)),
  int32s:(address,count)=>Array.from({length:count},(_,i)=>file.readInt32LE(offset(address)+i*4)),
  word:address=>file.readUInt32LE(offset(address)),
  /** The code that reads a table, as a check that the table is where it reads it: [address, instruction word]. */
  expectCode(pairs){for(const [address,word] of pairs)if(file.readUInt32LE(offset(address))!==word)throw new Error(`Unexpected code at ${address.toString(16)}.`);}};
}
