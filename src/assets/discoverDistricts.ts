import {buildDistrictIndex,queryDistrictIndex,type IndexedDistrict} from './districtIndex';
import {requireAsset} from './binary';
import {readIpl,type IplInstance} from './ipl';
import type {IdeAssociation} from './ide';
import {readImgEntry,type ImgEntry} from './img';
import {relatedIplEntries} from './relatedIpls';
import {readSceneCollisionSources} from './sceneCollisionSources';
import type {SceneRegion} from './sceneRegion';

/** Local worker-side source discovery. The folder's available IPLs define the
 * search scope; no network, inferred file paths, or missing-terrain substitutes. */
export async function indexDistrictSources(file:File,entries:ImgEntry[],byPath:ReadonlyMap<string,File>,
 definitions:readonly {path:string;records:IdeAssociation[]}[],includeCollisionBounds:boolean){
 const files=[...byPath].filter(([path])=>path.startsWith('ipl/')&&path.endsWith('.ipl'));
 requireAsset(files.length>0&&files.length<=100,'District discovery requires 1–100 IPL files.');
 let bytes=files.reduce((sum,[,f])=>sum+f.size,0),instances=0;
 requireAsset(bytes<=128*1024*1024,'District discovery IPL sources exceed 128 MiB.');
 const names=new Set(entries.map(entry=>entry.name.toLowerCase()));
 const additionalCollisionFiles=[...byPath].filter(([path,f])=>path===`supplemental/${f.name.toLowerCase()}`&&path.endsWith('.col')&&!names.has(f.name.toLowerCase())).map(([,f])=>f);
 const collisions=includeCollisionBounds?await readSceneCollisionSources({file,allArchiveCollisions:true,additionalCollisionFiles},entries):undefined;
 const byModel=new Map(collisions?.models?.map(model=>[model.name.toLowerCase(),model]));
 const global=new Map<number,Set<string>>();
 const add=(map:Map<number,Set<string>>,definition:IdeAssociation)=>{if(!map.has(definition.id))map.set(definition.id,new Set());map.get(definition.id)!.add(definition.model.toLowerCase());};
 for(const source of definitions)for(const definition of source.records)add(global,definition);
 const sources=[];
 for(const [path,staticFile] of files){
  const id=path.slice(4,-4),folder=id.split('/')[0],variants=new Map<number,Set<string>>();
  for(const source of definitions)if(source.path.startsWith(`ide/${folder}/`)||source.path.startsWith('ide/generic/')||['ide/interior/propext.ide','ide/leveldes/levelmap.ide','ide/leveldes/seabed.ide'].includes(source.path))for(const definition of source.records)add(variants,definition);
  for(const [id,names] of global)if(!variants.has(id)&&names.size===1)variants.set(id,names);
  const nameFor=(p:IplInstance)=>p.modelName?.toLowerCase()??(variants.get(p.modelId)?.size===1?[...variants.get(p.modelId)!][0]:undefined);
  const placements=readIpl(new Uint8Array(await staticFile.arrayBuffer())).instances;
  instances+=placements.length;requireAsset(instances<=250000,'District discovery exceeds the placement limit.');
  for(const index of relatedIplEntries(staticFile.name,entries)){
   const entry=entries[index];bytes+=entry.length;requireAsset(bytes<=128*1024*1024,'District discovery IPL sources exceed 128 MiB.');
   const streamed=readIpl(await readImgEntry(file,entry)).instances;instances+=streamed.length;requireAsset(instances<=250000,'District discovery exceeds the placement limit.');for(const placement of streamed)placements.push(placement);
  }
  sources.push({id,placements,boundsFor:(p:IplInstance)=>{const name=nameFor(p);return name?byModel.get(name)?.bounds:undefined;}});
 }
 return buildDistrictIndex(sources);
}
export function discoverIndexedDistricts(index:IndexedDistrict[],region:SceneRegion){
 const matches=queryDistrictIndex(index,region);
 requireAsset(matches.length>0,'No supplied district overlaps the requested area.');
 requireAsset(matches.length<=16,'Requested area overlaps more than 16 districts; reduce the radius.');
 return matches.map(match=>match.id);
}

export async function discoverDistricts(file:File,entries:ImgEntry[],byPath:ReadonlyMap<string,File>,definitions:readonly {path:string;records:IdeAssociation[]}[],region:SceneRegion){
 queryDistrictIndex([],region);
 return discoverIndexedDistricts(await indexDistrictSources(file,entries,byPath,definitions,!!region.includeCollisionBounds),region);
}
