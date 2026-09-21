import {readPopulationCycle,preparePopulationCycle,populationCycleAt,populationCarModels} from './populationCycle';
import {readCarGroups,resolveCarGroups} from './carGroups';
import {indexFlyingHandling} from './flyingHandling';
import type {openStaticWorld} from './staticWorldArchive';
import {readVehicleIde} from './vehicleIde';
import {readHandling} from './handling';
import {readCarColors} from './carColors';
import {readModel,ModelReadCache} from './readModel';
import {boxCollisionFallback} from './col';
import {readVehicleAnimGroups} from './vehicleAnimGroups';
import {decodeNamedTextures} from './modelTextures';
import {generatePlateText,plateDesignForRegion,plateModelTextures} from '../vehicle/nativeCarPlates';
import {requireAsset} from './binary';
/** Shared native asset catalog for every vehicle type. Physics preparation belongs to its type-specific controller. */
export async function openStaticWorldVehicles(source:Awaited<ReturnType<typeof openStaticWorld>>){
 const file=async(name:string)=>{const resource=source.manifest.resources.find(r=>r.path===`vehicles/${name}`);requireAsset(resource,`Missing native vehicle resource: ${name}`);return source.resource(resource!);};
 const [ide,handlingFile,colorsFile,shared,carGroupsFile,populationFile]=await Promise.all(['vehicles.ide','handling.cfg','carcols.dat','vehicle.txd','cargrp.dat','popcycle.dat'].map(file));
 const definitions=readVehicleIde(await ide.text()).records,handling=readHandling(await handlingFile.text()),colors=readCarColors(await colorsFile.text());
 const carGroups=resolveCarGroups(readCarGroups(await carGroupsFile.text()),definitions);
 const rawPopulationCycle=readPopulationCycle(await populationFile.text()),populationCycle=preparePopulationCycle(rawPopulationCycle);
 const flyingHandling=indexFlyingHandling(handling.supplements);
 const cache=new ModelReadCache(source.file,source.entries,[shared]),entries=new Map(source.entries.map(e=>[e.name.toLowerCase(),e]));
 // CCustomCarPlateMgr::Initialise: the plate charset and the three platebacks from vehicle.txd; one plate text per model
 // (CVehicleModelInfo::SetCarCustomPlate), drawn with the CRT random like CGeneral::GetRandomNumber.
 const sharedBytes=new Uint8Array(await shared.arrayBuffer()),plateSet=decodeNamedTextures(['platecharset','plateback1','plateback2','plateback3'],sharedBytes,undefined,['vehicle']);
 const plateCharset=plateSet.find(t=>t.name.toLowerCase()==='platecharset'),plateBacks=[1,2,3].map(i=>plateSet.find(t=>t.name.toLowerCase()===`plateback${i}`)).filter((t):t is NonNullable<typeof t>=>!!t);
 const plateTexts=new Map<number,string>(),plateRandom=()=>Math.floor(Math.random()*32768)/32767;
 return {definitions,handling,colors,flyingHandling,carGroups,rawPopulationCycle,populationCycle,populationCarModelsAt(zoneType:number,day:number,hour:number){return populationCarModels(populationCycleAt(populationCycle,zoneType,day,hour),carGroups);},async load(modelId:number,options:{plateRegion?:number}={}){
  const matches=definitions.filter(v=>v.id===modelId);requireAsset(matches.length===1,'Vehicle ID is missing or ambiguous.');const vehicle=matches[0];
  const flight=flyingHandling.get(vehicle.handling);if(vehicle.type==='plane'||vehicle.type==='heli')requireAsset(flight,`Unresolved flying handling: ${vehicle.handling}`);
  const entry=entries.get(vehicle.model.toLowerCase()+'.dff'),textureEntry=entries.get(vehicle.dictionary.toLowerCase()+'.txd');requireAsset(entry&&textureEntry,`Missing vehicle model or dictionary: ${vehicle.model}`);
  const asset=await readModel({file:source.file,entry,textureEntry,parents:[[vehicle.dictionary.toLowerCase(),'vehicle']]},cache);
  let plate:{text:string;design:number}|undefined;
  if(plateCharset&&plateBacks.length===3&&asset.textures.some(t=>t.name.toLowerCase()==='carplate')){
   const text=plateTexts.get(modelId)??generatePlateText(plateRandom)!;plateTexts.set(modelId,text);
   const design=plateDesignForRegion(options.plateRegion??0),made=plateModelTextures(text,plateCharset,plateBacks,design);
   asset.textures=asset.textures.map(t=>t.name.toLowerCase()==='carplate'?made.carplate:t.name.toLowerCase()==='carpback'&&made.carpback?made.carpback:t);
   plate={text,design};
  }
  const names=new Set(asset.textures.map(t=>t.name.toLowerCase()));
  const missingTextures=[...new Set(asset.model.geometries.flatMap(g=>g.materials.map(m=>m.texture).filter(n=>n&&!names.has(n.toLowerCase()))))];
  const records=handling.records.filter(record=>record.name===vehicle.handling);requireAsset(records.length===1,`Unresolved vehicle handling association: ${vehicle.handling}`);
  // Corrupt-depot repair: a vehicle whose COL entry was skipped gets a box
  // fallback from its (repaired) model geometry instead of failing the load.
  let collision=asset.collision;
  const repaired:string[]=[];
  if(!collision){
   const positions=asset.model.geometries.flatMap(g=>[...g.positions]);
   collision=boxCollisionFallback(vehicle.model,new Float32Array(positions));
   repaired.push(`Synthesized box collision for corrupt ${vehicle.model} collision data.`);
  }
  return {...asset,plate,collision,repaired,vehicle,handling:records[0],flyingHandling:flight,animGroup:readVehicleAnimGroups(handling.supplements).get(records[0].values.animationGroup),supplements:handling.supplements.filter(row=>row.tokens[0]===vehicle.handling),missingTextures};
 }};
}
