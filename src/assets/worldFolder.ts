import { requireAsset } from './binary';
import { readIdeAssociations, readIdeParents, mergeIdeParents, mergeIdeAssociations } from './ide';
import { readImgIndex } from './img';
import { relatedIplEntries } from './relatedIpls';
import type { SceneRequest } from './scene';
import { WORLD_REGIONS } from './worldRegions';
import type {SceneEnvironmentFiles} from './sceneEnvironment';

export interface WorldFolderFile { path:string; file:File; }
/** A selected content depot supplies exact relative paths, never basename guesses.
 * File paths are carried explicitly because structured cloning File does not
 * consistently preserve webkitRelativePath across browsers. */
export async function planWorldFolder(files:WorldFolderFile[],regionId:string):Promise<SceneRequest & {environment:SceneEnvironmentFiles}> {
  const region=WORLD_REGIONS.find(r=>r.id===regionId);
  requireAsset(region,'Choose a named map region to load from the content folder.');
  requireAsset(files.length>0&&files.length<=10000,'Content folder requires 1–10,000 files.');
  const byPath=new Map<string,File>();let root:string|undefined;
  for(const {path,file} of files){
    const segments=path.replace(/\\/g,'/').split('/');
    requireAsset(segments.length>=2&&segments.every(s=>s&&s!=='.'&&s!=='..'),'Invalid content folder path.');
    root??=segments[0];requireAsset(root===segments[0],'Select one content folder.');
    const relative=segments.slice(1).join('/').toLowerCase();
    requireAsset(!byPath.has(relative),`Duplicate content path: ${relative}.`);
    byPath.set(relative,file);
  }
  const required=(path:string)=>{const file=byPath.get(path.toLowerCase());requireAsset(file,`Content folder is missing ${path}.`);return file;};
  const file=required('gta3.img'),entries=await readImgIndex(file);
  const ideFiles=[...byPath].filter(([path])=>path.startsWith('ide/')&&path.endsWith('.ide'));
  requireAsset(ideFiles.length>0&&ideFiles.length<=100&&ideFiles.reduce((sum,[,f])=>sum+f.size,0)<=4*1024*1024,'Content IDE files exceed the 100-file or 4 MiB limit, or are missing.');
  const definitions=[],parentRecords:[string,string][]=[];
  for(const [path,file] of ideFiles){
    const text=new TextDecoder('windows-1252').decode(await file.arrayBuffer());
    definitions.push({path,records:readIdeAssociations(text)});parentRecords.push(...readIdeParents(text));
  }
  const districts=[region.district,...(region.neighbors??[])];
  const folders=new Set(districts.map(d=>`ide/${d.split('/')[0].toLowerCase()}/`));
  for(const district of districts)required(`ide/${district}.ide`);
  const scoped=definitions.filter(d=>[...folders].some(f=>d.path.startsWith(f))||d.path.startsWith('ide/generic/')||['ide/leveldes/levelmap.ide','ide/leveldes/seabed.ide','ide/interior/propext.ide'].includes(d.path)).flatMap(d=>d.records);
  // Some shared objects live outside the district folder. Include them only
  // when every supplied definition for their ID agrees on all parsed fields.
  const present=new Set(scoped.map(d=>d.id)),global=new Map<number,Map<string,typeof scoped[number]>>();
  for(const d of definitions.flatMap(d=>d.records)){
    if(!global.has(d.id))global.set(d.id,new Map());
    global.get(d.id)!.set(JSON.stringify({...d,model:d.model.toLowerCase(),dictionary:d.dictionary.toLowerCase()}),d);
  }
  for(const [id,variants] of global)if(!present.has(id)&&variants.size===1)scoped.push([...variants.values()][0]);
  // Validate dictionary conflicts before grouping; readScene also rejects ID conflicts.
  mergeIdeAssociations(scoped);
  const source=(district:string)=>{
    const staticPlacementFile=required(`ipl/${district}.ipl`);
    const streams=relatedIplEntries(staticPlacementFile.name,entries).map(i=>entries[i]);
    return streams.length?{file,staticPlacementFile,placementEntry:streams[0],additionalPlacementEntries:streams.slice(1)}:{file,placementFile:staticPlacementFile};
  };
  // A static sunny row appropriate to this preset; not native weather scheduling.
  const weather=region.district.startsWith('SF/')?5:region.district.startsWith('vegas/')?10:region.id==='verdant-meadows'?18:region.district.startsWith('country/')?14:1;
  const environment:SceneEnvironmentFiles={surfaceAudio:byPath.get('surfaud.dat'),lighting:byPath.get('timecycp.dat')??byPath.get('timecyc.dat'),water:byPath.get('water.dat'),particle:byPath.get('particle.txd'),weather};
  return {...source(districts[0]),additionalDistricts:districts.slice(1).map(source),associations:scoped,parents:[...mergeIdeParents(parentRecords)],interior:0,allArchiveCollisions:true,environment,region:{x:region.x,y:region.y,radius:region.radius,includeCollisionBounds:region.includeCollisionBounds}};
}
