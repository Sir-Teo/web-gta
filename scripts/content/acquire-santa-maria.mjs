/** Optional original-content supplements for the Santa Maria outdoor gym. */
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {acquireFile,matchesFile} from './lib/verified-file.mjs';
const [destination,...flags]=process.argv.slice(2);
if(!destination||flags.some(flag=>flag!=='--verify-only'))throw new Error('Usage: node scripts/content/acquire-santa-maria.mjs /absolute/content-depot [--verify-only]');
const lock=JSON.parse(await readFile(new URL('./santa-maria-sources.json',import.meta.url),'utf8'));
const root=resolve(destination),seen=new Set();
for(const item of lock.items){
 if(!/^[a-z0-9_]+\.(dff|txd|col)$/.test(item.name)||seen.has(item.name))throw new Error('Invalid or duplicate supplemental filename.');
 seen.add(item.name);
 const path=join(root,'supplemental',item.name);
 if(flags.includes('--verify-only')){
  if(!await matchesFile(path,item))throw new Error(`Missing or changed supplement: ${item.name}`);
 }else console.log(`${item.name}: ${await acquireFile(path,item)}`);
}
console.log(`Verified ${lock.items.length} supplemental native files. Original archive unchanged.`);
