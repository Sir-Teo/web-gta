/** Extract the verified sound banks used by the native sound manager from a local audio depot.
 * GENRL: every player/dummy engine bank of the car, special and aircraft rows in CAEVehicleAudioEntity's
 * VehicleAudioSettings (gta-reversed 0076f901), plus APACHE_D (cop heli), BULLET_HITS, COLLISIONS, EXPLOSIONS,
 * FRONTEND_GAME, HORN, RAIN, SWIMMING, VEHICLE_GEN and WEAPONS. FEET: the seven footstep banks. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const [depotArg,outputArg]=process.argv.slice(2);if(!depotArg||!outputArg)throw new Error('Usage: package-native-audio.mjs CONTENT_DEPOT OUTPUT_DIRECTORY');
const depot=resolve(depotArg),output=resolve(outputArg),hash=b=>createHash('sha256').update(b).digest('hex');
const genrl=await readFile(join(depot,'audio/SFX/GENRL')),feet=await readFile(join(depot,'audio/SFX/FEET')),lookup=await readFile(join(depot,'audio/CONFIG/BankLkup.dat')),packages=await readFile(join(depot,'audio/CONFIG/PakFiles.dat'));
if(genrl.length!==25170572||hash(genrl)!=='d8aa28b90743176e440f651ca3270d578bfde41359dfb524743f41a24e2d22fd')throw new Error('GENRL does not match the verified source.');
if(feet.length!==354020||hash(feet)!=='57eeebdf4205f6db6ff388f8b2099a60ce507ee07a5d8b3defad0383d55e31d0')throw new Error('FEET does not match the verified source.');
if(hash(lookup)!=='b89a66ddef4e5da74c4c13abb38a9aa7985397bee45b00e080da89f07a1eee50'||hash(packages)!=='36bc8f4814d4ef4dc3b7c43ae5c26f0de1feeda1bc15cdf2250456d2927bc57c')throw new Error('Audio lookup mismatch.');
const ENGINE_BANKS=[7,8,10,11,12,16,17,25,26,32,33,34,35,36,37,38,45,46,47,48,53,54,57,58,61,62,63,64,68,69,70,71,75,76,77,78,79,80,81,83,84,85,86,87,88,89,92,93,94,95,98,99,100,101,102,103,104,106,107,108,109,112,113,114,115,118,120,126,127,134,135,136,137,141,142];
const GENERIC_BANKS=[13,27,39,52,59,74,105,128,138,143],FEET_BANKS=[0,1,2,3,4,5,6];
const banks=[];await mkdir(output,{recursive:true});
for(const id of [...FEET_BANKS,...ENGINE_BANKS,...GENERIC_BANKS].sort((a,b)=>a-b)){
 const index=lookup[id*12],packageName=packages.subarray(index*52,index*52+12).toString().split('\0')[0],source=id<7?feet:genrl;
 if(packageName!==(id<7?'FEET':'GENRL'))throw new Error(`Bank ${id} is not in ${id<7?'FEET':'GENRL'}.`);
 const offset=lookup.readUInt32LE(id*12+4),dataBytes=lookup.readUInt32LE(id*12+8),bytes=source.subarray(offset,offset+4804+dataBytes);
 if(bytes.length!==4804+dataBytes)throw new Error(`Truncated bank ${id}.`);
 const path=`bank-${id}.bin`;await writeFile(join(output,path),bytes);
 banks.push({id,path,dataBytes,bytes:bytes.length,sounds:bytes.readUInt16LE(0),sha256:hash(bytes)});
}
await writeFile(join(output,'banks.json'),JSON.stringify({version:1,packageSha256:hash(genrl),feetSha256:hash(feet),banks},null,1)+'\n');
console.log(`Packaged ${banks.length} native sound banks (${(banks.reduce((n,b)=>n+b.bytes,0)/1048576).toFixed(2)} MB).`);
