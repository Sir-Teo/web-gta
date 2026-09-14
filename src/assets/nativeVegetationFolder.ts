import {indexContentFolderPaths,type WorldFolderFile} from './contentFolderPaths';
import {requireAsset} from './binary';
import {readNativeGrassAssets,NATIVE_GRASS_FILES} from './nativeGrassAssets';
import {readPlants,readProcObjects} from './vegetation';
import {readObjectData,indexObjectData} from './objectData';
import {readSurfaceInfo} from './surfaceInfo';
import {indexNativeSurfaceInfo} from './surfaceIds';
import {initializeNativePlants,nativeVegetationEligibility} from '../world/nativeVegetation';

export const NATIVE_VEGETATION_PATHS=['plants.dat','procobj.dat','object.dat','surfinfo.dat',...['plant1.txd',...NATIVE_GRASS_FILES].map(name=>`models/grass/${name}`)];
/** Optional handoff: never advertise a partial package as installable. */
export function selectNativeVegetationFiles(paths:ReadonlyMap<string,File>):WorldFolderFile[]|undefined{
 if(!NATIVE_VEGETATION_PATHS.every(path=>paths.has(path)))return;
 return NATIVE_VEGETATION_PATHS.map(path=>({path:`vegetation/${path}`,file:paths.get(path)!}));
}
/** Validate a bounded structured-clone payload before environment owners run. */
export function validateNativeVegetationFiles(value:unknown):asserts value is WorldFolderFile[]{
 requireAsset(Array.isArray(value)&&value.length===NATIVE_VEGETATION_PATHS.length&&value.every(entry=>entry&&typeof entry.path==='string'&&entry.file instanceof File),'Invalid local vegetation files.');
 const paths=indexContentFolderPaths(value);
 requireAsset(NATIVE_VEGETATION_PATHS.every(path=>paths.has(path)),'Incomplete local vegetation files.');
 requireAsset(value.every(entry=>entry.file.size>0&&entry.file.size<=16*1024*1024)&&value.reduce((sum,entry)=>sum+entry.file.size,0)<=32*1024*1024,'Invalid local vegetation package size.');
}
/** Complete local package, validated before returning any installable state.
 * Reads only vegetation resources; the world archive is not opened here. */
export async function readNativeVegetationFolder(files:readonly WorldFolderFile[]){
 const paths=indexContentFolderPaths(files);
 const selected=NATIVE_VEGETATION_PATHS.map(path=>{
  const file=paths.get(path);requireAsset(!!file,`Vegetation folder is missing ${path}.`);
  requireAsset(file.size>0&&file.size<=16*1024*1024,`Invalid vegetation resource size: ${path}`);return {path,file};
 });
 requireAsset(selected.reduce((sum,entry)=>sum+entry.file.size,0)<=32*1024*1024,'Vegetation package exceeds 32 MiB.');
 const bytes=new Map<string,Uint8Array>();for(const {path,file} of selected)bytes.set(path,new Uint8Array(await file.arrayBuffer()));
 const text=(path:string)=>new TextDecoder('windows-1252').decode(bytes.get(path)!);
 const plantRecords=readPlants(text('plants.dat')),proceduralObjects=readProcObjects(text('procobj.dat')),objectRecords=readObjectData(text('object.dat'));
 const surfaces=initializeNativePlants(plantRecords),surfaceInfo=indexNativeSurfaceInfo(readSurfaceInfo(text('surfinfo.dat')).records).byId;
 for(const [id] of surfaceInfo)requireAsset(!nativeVegetationEligibility(id,surfaceInfo).plants||surfaces.has(id),`Missing grass properties for surface ${id}.`);
 const grass=readNativeGrassAssets(new Map(['plant1.txd',...NATIVE_GRASS_FILES].map(name=>[name,bytes.get(`models/grass/${name}`)!])));
 return {grass,surfaces,surfaceInfo,objects:indexObjectData(objectRecords),plantRecords,proceduralObjects,objectRecords};
}
