import type {openStaticWorld} from './staticWorldArchive';
import {readVehicleIde} from './vehicleIde';
import {readHandling} from './handling';
import {readCarColors} from './carColors';
import {readModel,ModelReadCache} from './readModel';
import {requireAsset} from './binary';
/** Shared native asset catalog for every vehicle type. Physics preparation belongs to its type-specific controller. */
export async function openStaticWorldVehicles(source:Awaited<ReturnType<typeof openStaticWorld>>){
 const file=async(name:string)=>{const resource=source.manifest.resources.find(r=>r.path===`vehicles/${name}`);requireAsset(resource,`Missing native vehicle resource: ${name}`);return source.resource(resource!);};
 const [ide,handlingFile,colorsFile,shared]=await Promise.all(['vehicles.ide','handling.cfg','carcols.dat','vehicle.txd'].map(file));
 const definitions=readVehicleIde(await ide.text()).records,handling=readHandling(await handlingFile.text()),colors=readCarColors(await colorsFile.text());
 const cache=new ModelReadCache(source.file,source.entries,[shared]),entries=new Map(source.entries.map(e=>[e.name.toLowerCase(),e]));
 return {definitions,handling,colors,async load(modelId:number){
  const matches=definitions.filter(v=>v.id===modelId);requireAsset(matches.length===1,'Vehicle ID is missing or ambiguous.');const vehicle=matches[0];
  const entry=entries.get(vehicle.model.toLowerCase()+'.dff'),textureEntry=entries.get(vehicle.dictionary.toLowerCase()+'.txd');requireAsset(entry&&textureEntry,`Missing vehicle model or dictionary: ${vehicle.model}`);
  const asset=await readModel({file:source.file,entry,textureEntry,parents:[[vehicle.dictionary.toLowerCase(),'vehicle']]},cache);
  const names=new Set(asset.textures.map(t=>t.name.toLowerCase()));
  const missingTextures=[...new Set(asset.model.geometries.flatMap(g=>g.materials.map(m=>m.texture).filter(n=>n&&!names.has(n.toLowerCase()))))];
  const records=handling.records.filter(record=>record.name===vehicle.handling);requireAsset(records.length===1,`Unresolved vehicle handling association: ${vehicle.handling}`);
  return {...asset,vehicle,handling:records[0],supplements:handling.supplements.filter(row=>row.tokens[0]===vehicle.handling),missingTextures};
 }};
}
