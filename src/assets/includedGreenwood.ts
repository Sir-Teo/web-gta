import {readDff} from './dff';
import {decodeModelTextures,decodeNamedTextures} from './modelTextures';
import {readVehicleIde} from './vehicleIde';
import {readHandling} from './handling';
import {readVehicleAnimGroups} from './vehicleAnimGroups';
import {readCarColors,resolveCarColors} from './carColors';
import {requireAsset} from './binary';
import {prepareHandling} from '../simulation/nativeHandling';
import type {NativeCarAssets} from '../simulation/installNativeCar';

export const GREENWOOD_FILES=['greenwoo.dff','greenwoo.txd','vehicle.txd','vehicles.ide','handling.cfg','carcols.dat'] as const;
export type GreenwoodFiles=Record<typeof GREENWOOD_FILES[number],Uint8Array>;
/** Assemble original resources without serializing an engine-specific converted model. */
export function decodeIncludedGreenwood(files:GreenwoodFiles,variation=0):NativeCarAssets {
 const text=(name:typeof GREENWOOD_FILES[number])=>new TextDecoder().decode(files[name]);
 const matches=readVehicleIde(text('vehicles.ide')).records.filter(r=>r.id===492);
 requireAsset(matches.length===1,'Greenwood definition is missing or ambiguous.');
 const vehicle=matches[0];
 requireAsset(vehicle.model==='greenwoo'&&vehicle.dictionary==='greenwoo'&&vehicle.handling==='GREENWOO'&&vehicle.type==='car'&&!vehicle.issues.length,'Unexpected Greenwood asset association.');
 const parsed=readHandling(text('handling.cfg')),records=parsed.records.filter(r=>r.name===vehicle.handling);
 requireAsset(records.length===1&&!records[0].issues.length,'Greenwood handling is missing or unresolved.');
 // VT_GREENWOOD in the pinned gta-reversed cHandlingDataMgr.h enum. Model ID 492 is unrelated.
 const handling=prepareHandling(records[0],68),model=readDff(files['greenwoo.dff']);
 requireAsset(model.embeddedCollisions?.length===1,'Greenwood requires one embedded collision model.');
 const textures=decodeModelTextures(model,[files['greenwoo.txd'],files['vehicle.txd']],undefined,['greenwoo','vehicle']);
 const names=new Set(textures.map(t=>t.name.toLowerCase()));
 for(const geometry of model.geometries)for(const material of geometry.materials)
  requireAsset(!material.texture||names.has(material.texture.toLowerCase()),`Missing Greenwood texture: ${material.texture}`);
 const lightTexture=textures.find(t=>t.name.toLowerCase()==='vehiclelights128');
 requireAsset(lightTexture,'Greenwood light texture is missing.');
 // CVehicleModelInfo::SetupCommonData's ms_pLightsOnTexture from the same vehicle.txd.
 const lightsOnTexture=decodeNamedTextures(['vehiclelightson128'],files['vehicle.txd'],undefined,['vehicle'])[0];
 return {vehicle,handling,model,collision:model.embeddedCollisions![0],textures:lightsOnTexture?[...textures,lightsOnTexture]:textures,lightTexture,lightsOnTexture,colors:resolveCarColors(readCarColors(text('carcols.dat')),vehicle.model,variation).colors,animGroup:readVehicleAnimGroups(parsed.supplements).get(handling.values.animationGroup)};
}
/** Relative URLs keep Pages project paths intact; no external server is needed at runtime. */
export async function loadIncludedGreenwood(baseUrl:string,variation=0,signal?:AbortSignal):Promise<NativeCarAssets> {
 const base=new URL(baseUrl,location.href);
 const response=await fetch(new URL('manifest.json',base),{signal});
 requireAsset(response.ok,'Greenwood manifest download failed.');
 const manifest=await response.json();
 requireAsset(manifest.version===1&&manifest.model==='greenwoo','Unsupported Greenwood manifest.');
 const entries=await Promise.all(GREENWOOD_FILES.map(async name=>{
  const entry=manifest.files?.[name];
  requireAsset(entry&&Number.isInteger(entry.bytes)&&entry.bytes>0&&entry.bytes<=8*1024*1024&&/^[a-f0-9]{64}$/.test(entry.sha256),'Invalid Greenwood resource manifest.');
  const response=await fetch(new URL(name,base),{signal});
  requireAsset(response.ok&&response.body,`Greenwood resource download failed: ${name}`);
  const reader=response.body!.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;requireAsset(size<=entry.bytes,`Oversized Greenwood resource: ${name}`);chunks.push(value);}}
  catch(error){await reader.cancel();throw error;}finally{reader.releaseLock();}
  requireAsset(size===entry.bytes,`Incomplete Greenwood resource: ${name}`);
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
  requireAsset(digest===entry.sha256,`Changed Greenwood resource: ${name}`);return [name,bytes] as const;
 }));
 return decodeIncludedGreenwood(Object.fromEntries(entries) as GreenwoodFiles,variation);
}
