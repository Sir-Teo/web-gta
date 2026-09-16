/** Extract verified native combat banks from a local GENRL package. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const [depotArg,outputArg]=process.argv.slice(2);if(!depotArg||!outputArg)throw new Error('Usage: package-combat-audio.mjs CONTENT_DEPOT OUTPUT_DIRECTORY');
const depot=resolve(depotArg),output=resolve(outputArg),hash=b=>createHash('sha256').update(b).digest('hex');
const genrl=await readFile(join(depot,'audio/SFX/GENRL')),lookup=await readFile(join(depot,'audio/CONFIG/BankLkup.dat')),packages=await readFile(join(depot,'audio/CONFIG/PakFiles.dat'));
if(genrl.length!==25170572||hash(genrl)!=='d8aa28b90743176e440f651ca3270d578bfde41359dfb524743f41a24e2d22fd')throw new Error('GENRL does not match the verified source.');
if(hash(lookup)!=='b89a66ddef4e5da74c4c13abb38a9aa7985397bee45b00e080da89f07a1eee50'||hash(packages)!=='36bc8f4814d4ef4dc3b7c43ae5c26f0de1feeda1bc15cdf2250456d2927bc57c')throw new Error('Audio lookup mismatch.');
const banks=[];await mkdir(output,{recursive:true});
for(const id of [143,52]){const index=lookup[id*12],packageName=packages.subarray(index*52,index*52+12).toString().split('\0')[0];if(packageName!=='GENRL')throw new Error('Unexpected bank package');const offset=lookup.readUInt32LE(id*12+4),dataBytes=lookup.readUInt32LE(id*12+8),bytes=genrl.subarray(offset,offset+4804+dataBytes);if(bytes.length!==4804+dataBytes)throw new Error('Truncated bank');const path=`bank-${id}.bin`;await writeFile(join(output,path),bytes);banks.push({id,path,dataBytes,bytes:bytes.length,sounds:bytes.readUInt16LE(0),sha256:hash(bytes)});}
await writeFile(join(output,'combat.json'),JSON.stringify({version:1,packageSha256:hash(genrl),banks},null,2)+'\n');console.log('Packaged 94 native weapon and explosion samples.');
