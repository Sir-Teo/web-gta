import type {ImgEntry} from './img';
import {readImgEntry} from './img';
import {readIpl} from './ipl';
import type {IplCarGenerator} from './iplCarGenerator';
import {requireAsset} from './binary';
export interface WorldCarGenerator extends IplCarGenerator {id:string;source:string;sourceIndex:number}
/** Index the one native world's generators. External IPLs override equal archive
 * basenames, matching placement import precedence; record order/identity is stable. */
export async function readWorldCarGenerators(archive:Blob,entries:readonly ImgEntry[],files:readonly {path:string;file:Blob}[]){
 const output:WorldCarGenerator[]=[],overrides=new Set<string>();
 const add=(source:string,bytes:Uint8Array)=>{readIpl(bytes).carGenerators.forEach((generator,sourceIndex)=>output.push({...generator,id:`${source}:${sourceIndex}`,source,sourceIndex}));requireAsset(output.length<=200000,'World exceeds the 200,000 vehicle generator limit.');};
 for(const input of [...files].sort((a,b)=>a.path.localeCompare(b.path))){if(!input.path.toLowerCase().endsWith('.ipl'))continue;const name=input.path.replace(/\\/g,'/').split('/').at(-1)!.toLowerCase();requireAsset(!overrides.has(name),`Ambiguous external generator IPL: ${name}`);overrides.add(name);add(input.path,new Uint8Array(await input.file.arrayBuffer()));}
 for(const entry of entries){if(entry.name.toLowerCase().endsWith('.ipl')&&!overrides.has(entry.name.toLowerCase()))add(`gta3.img/${entry.name}`,await readImgEntry(archive,entry));}
 return output;
}
export function carGeneratorsInRegion(records:readonly WorldCarGenerator[],region:{x:number;y:number;radius:number}){
 requireAsset([region.x,region.y,region.radius].every(Number.isFinite)&&region.radius>0,'Invalid vehicle generator region.');
 const squared=region.radius**2;return records.filter(g=>(g.position[0]-region.x)**2+(g.position[1]-region.y)**2<=squared);
}
