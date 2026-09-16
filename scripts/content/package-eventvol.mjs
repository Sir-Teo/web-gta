/** Package the verified EVENTVOL.DAT table for the browser sound manager.
 * Usage: package-eventvol.mjs CONTENT_DEPOT OUTPUT_DIRECTORY */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const [depotArg,outputArg]=process.argv.slice(2);if(!depotArg||!outputArg)throw new Error('Usage: package-eventvol.mjs CONTENT_DEPOT OUTPUT_DIRECTORY');
const depot=resolve(depotArg),output=resolve(outputArg),hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=await readFile(join(depot,'audio/CONFIG/EventVol.dat'));
if(bytes.length!==45402||hash(bytes)!=='ad8bab3deff68a93787566dab34b33d37876ba9e15308386e2166837024059a8')throw new Error('EventVol.dat does not match the verified source (45402 bytes, retail XXH3 e95fc016454f961b).');
await mkdir(output,{recursive:true});
await writeFile(join(output,'eventvol.dat'),bytes);
await writeFile(join(output,'eventvol.json'),JSON.stringify({version:1,bytes:bytes.length,sha256:hash(bytes),xxh3:'e95fc016454f961b',source:'audio/CONFIG/EventVol.dat'},null,1)+'\n');
console.log(`Packaged EVENTVOL.DAT (${bytes.length} bytes).`);
