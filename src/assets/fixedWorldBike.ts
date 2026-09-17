import {requireAsset} from './binary';
import {readVehicleAnimGroups} from './vehicleAnimGroups';
import {chooseVehicleColors} from './carColors';
import {prepareHandling} from '../simulation/nativeHandling';
import {resolveBikeWheelFrames,type BikeWheelFrames} from './bikeWheelFrames';
import type {openStaticWorldVehicles} from './staticWorldVehicles';
import type {WorldCarGenerator} from './worldCarGenerators';
import type {NativeCarAssets} from '../simulation/installNativeCar';
/** Native handling-table IDs for bike handlings: the row index in handling.cfg (the 162–174 bike interval). */
export const FIXED_BIKE_HANDLING_IDS:Readonly<Record<string,number>>={
 BIKE:162,MOPED:163,DIRTBIKE:164,FCR900:165,NRG500:166,HPV1000:167,BF400:168,WAYFARER:169,QUADBIKE:170,BMX:171,
 CHOPPERB:172,MTB:173,FREEWAY:174,
};
export interface NativeBikeAssets extends Omit<NativeCarAssets,'wheelFrames'> {wheelFrames:BikeWheelFrames;}
export async function loadFixedWorldBike(catalog:Awaited<ReturnType<typeof openStaticWorldVehicles>>,generator:Pick<WorldCarGenerator,'modelId'|'primaryColor'|'secondaryColor'>):Promise<NativeBikeAssets>{
 const asset=await catalog.load(generator.modelId),id=FIXED_BIKE_HANDLING_IDS[asset.vehicle.handling];
 requireAsset((asset.vehicle.type==='bike'||asset.vehicle.type==='bmx'||asset.vehicle.type==='quad')&&id!==undefined,'Generator does not resolve to a supported bike.');
 requireAsset(!asset.vehicle.issues.length&&!asset.handling.issues.length&&!asset.missingTextures.length&&asset.collision,'Unresolved native bike resources.');
 const wheelFrames=resolveBikeWheelFrames(asset.model);
 // Browser session policy: first native paint variant for unspecified colors.
 const colors=chooseVehicleColors(catalog.colors,asset.vehicle.model,0).colors.map(rgb=>[...rgb]) as [[number,number,number],[number,number,number],[number,number,number],[number,number,number]];
 if(generator.primaryColor!==-1&&generator.secondaryColor!==-1)for(const [slot,index] of [generator.primaryColor,generator.secondaryColor].entries()){
  const rgb=catalog.colors.palette[index]?.rgb;requireAsset(rgb,`Unresolved generator paint index ${index}.`);colors[slot]=[...rgb!];
 }
 // Bike TXDs carry no vehiclelights128 texture; headlight rendering stays unfinished until the bike lamp pass.
 const lightTexture=asset.textures.find(t=>t.name.toLowerCase()==='vehiclelights128');
 const handling=prepareHandling(asset.handling,id);
 return {vehicle:asset.vehicle,handling,model:asset.model,collision:asset.collision!,textures:asset.textures,wheelFrames,colors,lightTexture,animGroup:readVehicleAnimGroups(catalog.handling.supplements).get(handling.values.animationGroup)};
}
