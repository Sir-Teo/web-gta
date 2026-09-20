import type {ScenePart} from './scene';
import type {DffModel} from './dff';
import type {ModelTexture} from './modelTextures';
/** CStreaming keeps a model resident while any entity in range uses it and never reloads it for the next sector.
 * The streaming worker mirrors that for its window messages: the main thread names the models it still holds, the
 * worker sends those parts without their decoded geometry and rasters, and the main thread puts its own copies back
 * before the window installs. Placements, collision and definitions still travel, as they are the window's own. */
export interface ResidentModel {model:DffModel;textures:ModelTexture[]}
const EMPTY_MODEL:DffModel={frames:[],geometries:[],atomics:[],warnings:[]};
/** The worker side: parts whose model the main thread holds lose their payload and carry `resident`. */
export function stripResidentParts(parts:ScenePart[],resident:ReadonlySet<string>){
 let stripped=0;
 const out=parts.map(part=>{
  if(!resident.has(part.name.toLowerCase()))return part;
  stripped++;return {...part,model:EMPTY_MODEL,textures:[],resident:true};
 });
 return {parts:out,stripped};
}
/** The main thread side: a resident part gets the copy the previous window installed. A part the cache lacks is
 * reported so the caller can ask for the window again in full. */
export function rehydrateResidentParts(parts:ScenePart[],cache:ReadonlyMap<string,ResidentModel>){
 const missing:string[]=[];
 for(const part of parts){
  if(!part.resident)continue;
  const held=cache.get(part.name.toLowerCase());
  if(!held){missing.push(part.name);continue;}
  part.model=held.model;part.textures=held.textures;delete part.resident;
 }
 return missing;
}
/** The models an installed window holds, keyed by name, for the next request's resident list. */
export function residentModelsOf(parts:readonly ScenePart[]){
 const out=new Map<string,ResidentModel>();
 for(const part of parts)if(!part.resident&&part.model.geometries.length)out.set(part.name.toLowerCase(),{model:part.model,textures:part.textures});
 return out;
}
