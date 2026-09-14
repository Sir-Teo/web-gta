/** Optional repair of one verified public-pack placement link. Never edits the IMG.
 * node scripts/content/repair-verdant-lod.mjs /absolute/content-directory */
import {open,readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(process.argv[2]??'');if(!process.argv[2])throw new Error('Supply the audited content directory.');
const hash=b=>createHash('sha256').update(b).digest('hex');
const streamName='countn2_stream2.ipl',expected='ddd290e995e34497ce9cb55c9c55aca9abf1c5e029ec0c4fb440aa316999cefb';
const archive=await open(join(root,'gta3.img'),'r');let bytes;
try{
 const header=Buffer.alloc(8);await archive.read(header,0,8,0);
 if(header.toString('ascii',0,4)!=='VER2')throw new Error('Expected a VER2 archive.');
 const count=header.readUInt32LE(4),size=(await archive.stat()).size;
 if(count>200000||8+count*32>size)throw new Error('Invalid archive directory.');
 const directory=Buffer.alloc(count*32);await archive.read(directory,0,directory.length,8);
 const matches=[];
 for(let i=0;i<count;i++){const at=i*32,name=directory.subarray(at+8,at+32).toString('ascii').split('\0')[0];if(name===streamName)matches.push(at);}
 if(matches.length!==1)throw new Error('Expected exactly one source stream.');
 const at=matches[0],offset=directory.readUInt32LE(at)*2048,length=directory.readUInt16LE(at+4)*2048;
 if(directory.readUInt16LE(at+6)!==0||length!==8192||offset+length>size)throw new Error('Unexpected stream storage.');
 bytes=Buffer.alloc(length);await archive.read(bytes,0,length,offset);
}finally{await archive.close();}
if(hash(bytes)!==expected)throw new Error('Source stream hash differs; repair refused.');
const staticBytes=await readFile(join(root,'ipl/country/countn2.ipl'));
// The companion is checked against the exact reviewed public metadata below.
const staticHash=hash(staticBytes);
const expectedStatic='3afc8a78a31cb41299136687debcf69740cf8bd965bbd17762ecbe9345bef9ab';
if(staticHash!==expectedStatic)throw new Error('Static IPL hash differs; repair refused.');
const position=bytes.readUInt32LE(28)+125*40;
if(bytes.readInt32LE(position+28)!==3175||bytes.readInt32LE(position+36)!==-1)throw new Error('Unexpected source placement.');
const repaired=Buffer.from(bytes);repaired.writeInt32LE(161,position+36);
const folder=join(root,'repairs/verdant-lod');await mkdir(folder,{recursive:true});
await writeFile(join(folder,streamName),repaired);
const report={sourceArchive:join(root,'gta3.img'),sourceStream:streamName,sourceSha256:expected,staticIpl:'country/countn2.ipl',staticSha256:staticHash,instance:125,modelId:3175,oldLod:-1,newLod:161,byteOffset:position+36,repairedSha256:hash(repaired),changedBytes:[...bytes].flatMap((value,i)=>value!==repaired[i]?[i]:[]),reason:'Matching high-detail trailer and LOD have identical transforms; three other same-model placements have explicit links. This optional repair is inferred content reconstruction, not an original-game data claim.'};
await writeFile(join(folder,'repair.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
