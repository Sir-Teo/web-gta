/** Optional original-content supplements for native vehicle assembly. */
import {readFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {acquireFile,matchesFile} from './lib/verified-file.mjs';
const [destination,...flags]=process.argv.slice(2);
if(!destination||flags.some(flag=>flag!=='--verify-only'))throw new Error('Usage: node scripts/content/acquire-vehicles.mjs /absolute/content-depot [--verify-only]');
const lock=JSON.parse(await readFile(new URL('./vehicle-sources.json',import.meta.url),'utf8'));
const root=resolve(destination),seen=new Set();
for(const item of lock.resources){
 const path=resolve(root,item.path),rel=relative(root,path);
 if(!rel||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)||seen.has(path))throw new Error('Invalid or duplicate vehicle resource destination.');seen.add(path);
 if(flags.includes('--verify-only')){
  if(!await matchesFile(path,item))throw new Error(`Missing or changed vehicle resource: ${item.path}`);
  console.log(`${item.path}: verified`);
 }else console.log(`${item.path}: ${await acquireFile(path,item)}`);
}
