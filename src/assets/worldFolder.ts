import {PLAYER_CLASSIC_FILES} from './readPlayerBaseBody';
import { requireAsset } from './binary';
import { readIdeAssociations, readIdeParents, mergeIdeParents, mergeIdeAssociations } from './ide';
import { readImgIndex } from './img';
import { relatedIplEntries } from './relatedIpls';
import type { SceneRequest } from './scene';
import { WORLD_REGIONS } from './worldRegions';
import type {SceneEnvironmentFiles} from './sceneEnvironment';
import type {SceneRegion} from './sceneRegion';
import {indexDistrictSources,discoverIndexedDistricts} from './discoverDistricts';
import {indexContentFolderPaths,type WorldFolderFile} from './contentFolderPaths';
import {selectNativeVegetationFiles} from './nativeVegetationFolder';

export type {WorldFolderFile} from './contentFolderPaths';
/** A selected content depot supplies exact relative paths, never basename guesses.
 * File paths are carried explicitly because structured cloning File does not
 * consistently preserve webkitRelativePath across browsers. */
function selectRegion(regionId:string,selection?:SceneRegion){
  const region=WORLD_REGIONS.find(r=>r.id===regionId);
  requireAsset(region,'Choose a named map region to load from the content folder.');
  const selected:SceneRegion=selection?{...selection}:{x:region.x,y:region.y,radius:region.radius,includeCollisionBounds:region.includeCollisionBounds};
  requireAsset([selected.x,selected.y,selected.radius].every(Number.isFinite)&&Math.abs(selected.x)<=1e7&&Math.abs(selected.y)<=1e7&&selected.radius>0&&selected.radius<=1e7&&
    (selected.includeCollisionBounds===undefined||typeof selected.includeCollisionBounds==='boolean'),'Invalid content folder region.');
  requireAsset(selected.lodRadius===undefined||Number.isFinite(selected.lodRadius)&&selected.lodRadius>=selected.radius&&selected.lodRadius<=3000,'Invalid distant scene radius.');
  requireAsset(selected.interior===undefined||Number.isInteger(selected.interior)&&selected.interior>=0&&selected.interior<=255,'Invalid content folder area.');
  return {region,selected};
}
/** One immutable File selection. Reselect the folder to observe changed bytes.
 * The closure retains metadata, never decoded model or texture buffers. */
export async function prepareWorldFolder(files:WorldFolderFile[]){
  const byPath=indexContentFolderPaths(files);
  const required=(path:string)=>{const file=byPath.get(path.toLowerCase());requireAsset(file,`Content folder is missing ${path}.`);return file;};
  const file=required('gta3.img'),entries=await readImgIndex(file);
  const ideFiles=[...byPath].filter(([path])=>path.startsWith('ide/')&&path.endsWith('.ide'));
  requireAsset(ideFiles.length>0&&ideFiles.length<=100&&ideFiles.reduce((sum,[,f])=>sum+f.size,0)<=4*1024*1024,'Content IDE files exceed the 100-file or 4 MiB limit, or are missing.');
  const definitions:{path:string;records:ReturnType<typeof readIdeAssociations>}[]=[],parentRecords:[string,string][]=[];
  for(const [path,file] of ideFiles){
    const text=new TextDecoder('windows-1252').decode(await file.arrayBuffer());
    definitions.push({path,records:readIdeAssociations(text)});parentRecords.push(...readIdeParents(text));
  }
  const indexes=new Map<boolean,Promise<Awaited<ReturnType<typeof indexDistrictSources>>>>();
  let indexBuilds=0;
  const districtIndex=(bounds:boolean)=>{
    let pending=indexes.get(bounds);
    if(!pending){indexBuilds++;pending=indexDistrictSources(file,entries,byPath,definitions,bounds);indexes.set(bounds,pending);}
    return pending;
  };
  // Shared objects outside a district folder, included when every definition of their ID agrees on all parsed
  // fields: the same for every request, so derived once instead of re-serializing every IDE record per window.
  let unambiguous:ReturnType<typeof readIdeAssociations>|undefined;
  const unambiguousDefinitions=()=>{
    if(unambiguous)return unambiguous;
    const global=new Map<number,Map<string,ReturnType<typeof readIdeAssociations>[number]>>();
    for(const d of definitions.flatMap(d=>d.records)){
      if(!global.has(d.id))global.set(d.id,new Map());
      global.get(d.id)!.set(JSON.stringify({...d,model:d.model.toLowerCase(),dictionary:d.dictionary.toLowerCase()}),d);
    }
    unambiguous=[];for(const variants of global.values())if(variants.size===1)unambiguous.push([...variants.values()][0]);
    return unambiguous;
  };
  const plan=async(regionId:string,selection?:SceneRegion,discover=false):Promise<SceneRequest & {environment:SceneEnvironmentFiles;sourceDistricts:string[]}>=>{
  const {region,selected}=selectRegion(regionId,selection);
  let districts:string[];
  if(discover){
    const bounds=!!selected.includeCollisionBounds;
    const pending=districtIndex(bounds);
    let index:Awaited<typeof pending>;
    try{index=await pending;}catch(error){if(indexes.get(bounds)===pending)indexes.delete(bounds);throw error;}
    districts=discoverIndexedDistricts(index,{...selected,radius:selected.lodRadius??selected.radius});
  }else districts=[region.district,...(region.neighbors??[])];
  // leveldes contains unrelated test assets with conflicting city definitions.
  // Selecting its shared seabed must not promote the entire folder into scope.
  const folders=new Set(districts.filter(d=>!d.toLowerCase().startsWith('leveldes/')).map(d=>`ide/${d.split('/')[0].toLowerCase()}/`));
  const selectedDefinitions=new Set(districts.map(d=>`ide/${d.toLowerCase()}.ide`));
  if(!discover)for(const district of districts)required(`ide/${district}.ide`);
  const scoped=definitions.filter(d=>selectedDefinitions.has(d.path)||[...folders].some(f=>d.path.startsWith(f))||d.path.startsWith('ide/generic/')||['ide/leveldes/levelmap.ide','ide/leveldes/seabed.ide','ide/interior/propext.ide'].includes(d.path)).flatMap(d=>d.records);
  // Some shared objects live outside the district folder. Include them only
  // when every supplied definition for their ID agrees on all parsed fields.
  const present=new Set(scoped.map(d=>d.id));
  for(const definition of unambiguousDefinitions())if(!present.has(definition.id))scoped.push(definition);
  // Validate dictionary conflicts before grouping; readScene also rejects ID conflicts.
  mergeIdeAssociations(scoped);
  const source=(district:string)=>{
    const staticPlacementFile=required(`ipl/${district}.ipl`);
    const streams=relatedIplEntries(staticPlacementFile.name,entries).map(i=>({...entries[i]}));
    return streams.length?{file,staticPlacementFile,placementEntry:streams[0],additionalPlacementEntries:streams.slice(1)}:{file,placementFile:staticPlacementFile};
  };
  // A static sunny row appropriate to this preset; not native weather scheduling.
  const weather=region.district.startsWith('SF/')?5:region.district.startsWith('vegas/')?10:region.id==='verdant-meadows'?18:region.district.startsWith('country/')?14:1;
  const environment:SceneEnvironmentFiles={surfaceInfo:byPath.get('surfinfo.dat'),surfaceAudio:byPath.get('surfaud.dat'),lighting:byPath.get('timecycp.dat')??byPath.get('timecyc.dat'),water:byPath.get('water.dat'),particle:byPath.get('particle.txd'),weather};
  const vegetation=selectNativeVegetationFiles(byPath);if(vegetation)environment.vegetation=vegetation;
  const body=PLAYER_CLASSIC_FILES.map(name=>byPath.get(`player/${name}`)),animations=byPath.get('animations/ped.ifp');
  if(animations&&body.every((file):file is File=>!!file))environment.player={body,animations};
  const bankLookup=byPath.get('audio/config/banklkup.dat'),packageLookup=byPath.get('audio/config/pakfiles.dat'),feet=byPath.get('audio/sfx/feet');
  if(bankLookup&&packageLookup&&feet)environment.footsteps={bankLookup,packageLookup,feet};
  const archiveNames=new Set(entries.map(entry=>entry.name.toLowerCase()));
  const supplemental=(extension:string)=>[...byPath].filter(([path,file])=>path===`supplemental/${file.name.toLowerCase()}`&&path.endsWith(extension)&&!archiveNames.has(file.name.toLowerCase())).map(([,file])=>file);
  const modelFiles=supplemental('.dff'),textureFiles=supplemental('.txd'),additionalCollisionFiles=supplemental('.col');
  return {...source(districts[0]),sourceDistricts:districts,modelFiles:modelFiles.length?modelFiles:undefined,textureFiles:textureFiles.length?textureFiles:undefined,additionalCollisionFiles:additionalCollisionFiles.length?additionalCollisionFiles:undefined,additionalDistricts:districts.slice(1).map(source),associations:scoped.map(definition=>({...definition})),parents:[...mergeIdeParents(parentRecords)],interior:selected.interior??0,allArchiveCollisions:true,environment,region:selected};
  };
  // Basename-only source references cannot distinguish duplicate external IPL
  // filenames in different directories. Such folders still load without reuse.
  const placementNames=[...byPath].filter(([path])=>path.startsWith('ipl/')&&path.endsWith('.ipl')).map(([,file])=>file.name.toLowerCase());
  const datasetIdentity=new Set(placementNames).size===placementNames.length?crypto.randomUUID():undefined;
  /** Starts building the district index before the first request needs it; a failure is left for plan() to report. */
  const prepareIndex=(bounds:boolean)=>{const pending=districtIndex(bounds);pending.catch(()=>{if(indexes.get(bounds)===pending)indexes.delete(bounds);});};
  return {plan,prepareIndex,datasetIdentity,get indexBuilds(){return indexBuilds;}};
}
export async function planWorldFolder(files:WorldFolderFile[],regionId:string,selection?:SceneRegion,discover=false){
 selectRegion(regionId,selection);
 return (await prepareWorldFolder(files)).plan(regionId,selection,discover);
}
