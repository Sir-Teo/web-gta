import {readSurfaceAudio} from './surfaceAudio';
import {openStaticWorld} from './staticWorldArchive';
import {readSurfaceInfo} from './surfaceInfo';
import {readSurfaceAdhesion} from './surfaceAdhesion';
import {indexNativeSurfaceInfo} from './surfaceIds';
export async function loadWorldRoadMaterials(base:string){
 const source=await openStaticWorld(base);
 const files=await Promise.all(['surfinfo.dat','surface.dat','surfaud.dat'].map(async path=>{const r=source.manifest.resources.find(r=>r.path===path);if(!r)throw new Error(`Missing surface file: ${path}`);return (await source.resource(r)).text();}));
 return {records:indexNativeSurfaceInfo(readSurfaceInfo(files[0]).records).byId,rows:readSurfaceAdhesion(files[1]).rows,audio:readSurfaceAudio(files[2]).byId};
}
