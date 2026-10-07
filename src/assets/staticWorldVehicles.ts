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
import {decodeNamedTextures,type ModelTexture} from './modelTextures';
import {readTxd} from './txd';
import {firstTextureOf} from '../vehicle/nativeVehicleRemap';
import {generatePlateText,plateDesignForRegion,plateModelTextures} from '../vehicle/nativeCarPlates';
import {VehicleColourRotation} from '../vehicle/nativeVehicleColours';
import {requireAsset} from './binary';
import {readIdeAssociations} from './ide';
import {readCarMods,vehicleRemaps,vehicleUpgradePlace} from '../vehicle/nativeVehicleUpgrades';
/** Shared native asset catalog for every vehicle type. Physics preparation belongs to its type-specific controller. */
export async function openStaticWorldVehicles(source:Awaited<ReturnType<typeof openStaticWorld>>){
 const file=async(name:string)=>{const resource=source.manifest.resources.find(r=>r.path===`vehicles/${name}`);requireAsset(resource,`Missing native vehicle resource: ${name}`);return source.resource(resource!);};
 const [ide,handlingFile,colorsFile,shared,carGroupsFile,populationFile,carModsFile]=await Promise.all(['vehicles.ide','handling.cfg','carcols.dat','vehicle.txd','cargrp.dat','popcycle.dat','carmods.dat'].map(file));
 const definitions=readVehicleIde(await ide.text()).records,handling=readHandling(await handlingFile.text()),colors=readCarColors(await colorsFile.text());
 const carGroups=resolveCarGroups(readCarGroups(await carGroupsFile.text()),definitions);
 const rawPopulationCycle=readPopulationCycle(await populationFile.text()),populationCycle=preparePopulationCycle(rawPopulationCycle);
 const flyingHandling=indexFlyingHandling(handling.supplements);
 const cache=new ModelReadCache(source.file,source.entries,[shared]),entries=new Map(source.entries.map(e=>[e.name.toLowerCase(),e]));
 // CCustomCarPlateMgr::Initialise: the plate charset and the three platebacks from vehicle.txd; one plate text per model
 // (CVehicleModelInfo::SetCarCustomPlate), drawn with the CRT random like CGeneral::GetRandomNumber.
 const sharedBytes=new Uint8Array(await shared.arrayBuffer()),plateSet=decodeNamedTextures(['platecharset','plateback1','plateback2','plateback3','vehiclelightson128'],sharedBytes,undefined,['vehicle']);
 // CVehicleModelInfo::SetupCommonData: ms_pLightsOnTexture, the lit lamp that replaces vehiclelights128.
 const lightsOnTexture=plateSet.find(t=>t.name.toLowerCase()==='vehiclelightson128');
 const plateCharset=plateSet.find(t=>t.name.toLowerCase()==='platecharset'),plateBacks=[1,2,3].map(i=>plateSet.find(t=>t.name.toLowerCase()===`plateback${i}`)).filter((t):t is NonNullable<typeof t>=>!!t);
 const plateTexts=new Map<number,string>(),plateRandom=()=>Math.floor(Math.random()*32768)/32767;
 // CVehicleModelInfo::ChooseVehicleColour's per-model rotation, shared by every vehicle built from this catalog.
 const colourRotation=new VehicleColourRotation();
 // CVehicleModelInfo::LoadVehicleUpgrades: carmods.dat, its names resolved to veh_mods.ide's model ids.
 const upgrades=await (async()=>{
  const modsResource=source.manifest.resources.find(r=>r.path==='ide/veh_mods/veh_mods.ide');requireAsset(modsResource,'Missing native vehicle upgrade definitions.');
  const associations=readIdeAssociations(await (await source.resource(modsResource!)).text());
  const ids=new Map(associations.map(r=>[r.model.toLowerCase(),r.id] as const)),dictionaries=new Map(associations.map(r=>[r.id,r.dictionary.toLowerCase()] as const));
  const partAssets=new Map<number,Promise<{model:Awaited<ReturnType<typeof readModel>>['model'];textures:ModelTexture[]}|undefined>>();
  const carMods=readCarMods(await carModsFile.text());
  const remaps=vehicleRemaps(source.entries.map(e=>e.name),new Set(definitions.filter(d=>d.id>=400&&d.id<=630).map(d=>d.model.toLowerCase())));
  const remapTextures=new Map<string,Promise<ModelTexture|undefined>>();
  return {carMods,
   /** An upgrade's model and textures (veh_mods.ide: its dictionary is vehicle.txd, or a car's own, which falls back
    * on vehicle.txd as the car's does), read once. */
   partAsset:(id:number)=>{
    let found=partAssets.get(id);
    if(!found){
     const name=[...ids].find(([,value])=>value===id)?.[0],entry=name?entries.get(`${name}.dff`):undefined,dictionary=dictionaries.get(id);
     const request=!entry||!dictionary?undefined:dictionary==='vehicle'?{file:source.file,entry,textureFile:shared}:{file:source.file,entry,textureEntry:entries.get(`${dictionary}.txd`),parents:[[dictionary,'vehicle']] as [string,string][]};
     found=request?readModel(request,cache).then(asset=>({model:asset.model,textures:asset.textures})):Promise.resolve(undefined);
     partAssets.set(id,found);
    }
    return found;
   },
   /** A paintjob's texture: CVehicle::PreRender's GetFirstTexture of the remap dictionary, read once. */
   remapTexture:(name:string)=>{
    const key=name.toLowerCase();let found=remapTextures.get(key);
    if(!found){
     const entry=entries.get(`${key}.txd`);
     found=entry?cache.dictionary(entry).then(bytes=>{
      const natives=cache.decode.dictionaries.get(bytes)??readTxd(bytes);cache.decode.dictionaries.set(bytes,natives);
      const first=firstTextureOf(natives);return first?decodeNamedTextures([first.name],bytes,cache.decode,[key])[0]:undefined;
     }):Promise.resolve(undefined);
     remapTextures.set(key,found);
    }
    return found;
   },
   /** An upgrade's model id by name (CModelInfo::GetModelInfo), and back. */
   idOf:(name:string)=>ids.get(name.toLowerCase()),
   nameOf:(id:number)=>{for(const [name,value] of ids)if(value===id)return name;return undefined;},
   /** CAtomicModelInfo's CarMod and bUsesVehDummy for an upgrade's model id. */
   placeOf:(id:number)=>{for(const [name,value] of ids)if(value===id)return vehicleUpgradePlace(name);return undefined;},
   /** CVehicleModelInfo::m_anUpgrades of a vehicle model by name: the upgrades' model ids. */
   upgradesOf:(model:string)=>(carMods.mods.get(model.toLowerCase())??[]).map(name=>ids.get(name)).filter((id):id is number=>id!==undefined),
   /** CVehicleModelInfo::m_anRemapTxds of a vehicle model by name: its paintjobs' texture dictionaries. */
   remapsOf:(model:string)=>remaps.get(model.toLowerCase())??[]};
 })();
 return {definitions,handling,colors,flyingHandling,carGroups,colourRotation,lightsOnTexture,upgrades,rawPopulationCycle,populationCycle,populationCarModelsAt(zoneType:number,day:number,hour:number){return populationCarModels(populationCycleAt(populationCycle,zoneType,day,hour),carGroups);},async load(modelId:number,options:{plateRegion?:number;plateText?:string}={}){
  const matches=definitions.filter(v=>v.id===modelId);requireAsset(matches.length===1,'Vehicle ID is missing or ambiguous.');const vehicle=matches[0];
  const flight=flyingHandling.get(vehicle.handling);if(vehicle.type==='plane'||vehicle.type==='heli')requireAsset(flight,`Unresolved flying handling: ${vehicle.handling}`);
  const entry=entries.get(vehicle.model.toLowerCase()+'.dff'),textureEntry=entries.get(vehicle.dictionary.toLowerCase()+'.txd');requireAsset(entry&&textureEntry,`Missing vehicle model or dictionary: ${vehicle.model}`);
  const asset=await readModel({file:source.file,entry,textureEntry,parents:[[vehicle.dictionary.toLowerCase(),'vehicle']]},cache);
  let plate:{text:string;design:number}|undefined;
  if(plateCharset&&plateBacks.length===3&&asset.textures.some(t=>t.name.toLowerCase()==='carplate')){
   // A script generator's special plate (CCarGenerator::DoInternalProcessing's plate text) replaces the model's own.
   const text=options.plateText??plateTexts.get(modelId)??generatePlateText(plateRandom)!;if(options.plateText===undefined)plateTexts.set(modelId,text);
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
  // CPlane::ProcessFlyingCarStuff flies the Hydra's hover on the Hunter's flying handling (iOS 0x100469e9c).
  const vtolFlyingHandling=modelId===520?flyingHandling.get('HUNTER'):undefined;
  return {...asset,plate,collision,repaired,vehicle,handling:records[0],flyingHandling:flight,vtolFlyingHandling,animGroup:readVehicleAnimGroups(handling.supplements).get(records[0].values.animationGroup),supplements:handling.supplements.filter(row=>row.tokens[0]===vehicle.handling),missingTextures};
 }};
}
