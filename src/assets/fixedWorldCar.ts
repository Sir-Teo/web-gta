import {requireAsset} from './binary';
import {readVehicleAnimGroups} from './vehicleAnimGroups';
import {chooseVehicleColors} from './carColors';
import {prepareHandling} from '../simulation/nativeHandling';
import {resolveCarWheelFrames} from './carWheelFrames';
import {prepareCarModel} from './prepareCarModel';
import type {openStaticWorldVehicles} from './staticWorldVehicles';
import type {WorldCarGenerator} from './worldCarGenerators';
import type {NativeCarAssets} from '../simulation/installNativeCar';
/** Explicit tVehicleType IDs for ordinary cars referenced by the original IPLs.
 * Includes GREENWOO/WASHING file-name aliases; never subtract a model-ID base. */
export const FIXED_CAR_HANDLING_IDS:Readonly<Record<string,number>>={
 AMBULAN:16,
 BAGGAGE:63,
 BANDITO:125,
 BARRACKS:30,
 BFINJECT:23,
 BOBCAT:21,
 BUFFALO:2,
 BULLET:101,
 CADRONA:88,
 CAMPER:62,
 CEMENT:85,
 CLOVER:102,
 COACH:34,
 DOZER:64,
 ELEGANT:78,
 FLASH:122,
 FORKLIFT:91,
 GLENDALE:52,
 GREENWOO:68,
 HOTDOG:143,
 JESTER:117,
 LINERUN:3,
 MAJESTIC:83,
 MOWER:129,
 MRWHOOP:22,
 NEWSVAN:137,
 PACKER:40,
 PATRIOT:54,
 PEREN:4,
 PETROL:80,
 POLICE_LA:148,
 POLICE_SF:147,
 POLICE_VG:149,
 POLRANGER:150,
 ENFORCER:25,
 FBIRANCH:66,
 RHINO:29,
 SWATVAN:152,
 FBITRUCK:89,
 RDTRAIN:81,
 ROMERO:39,
 SADLER:103,
 SANDKING:70,
 SECURICA:26,
 SUPERGT:77,
 SWEEPER:131,
 TAMPA:108,
 TOWTRUCK:86,
 TRACTOR:92,
 TUG:138,
 UTILITY:111,
 WALTON:58,
 WASHING:20,
 ZR350:57
};
export async function loadFixedWorldCar(catalog:Awaited<ReturnType<typeof openStaticWorldVehicles>>,generator:Pick<WorldCarGenerator,'modelId'|'primaryColor'|'secondaryColor'>):Promise<NativeCarAssets>{
 const asset=await catalog.load(generator.modelId),id=FIXED_CAR_HANDLING_IDS[asset.vehicle.handling];
 requireAsset(asset.vehicle.type==='car'&&id!==undefined,'Generator does not resolve to a supported ordinary car.');
 requireAsset(!asset.vehicle.issues.length&&!asset.handling.issues.length&&!asset.missingTextures.length&&asset.collision,'Unresolved native car resources.');
 const wheelFrames=resolveCarWheelFrames(asset.model);prepareCarModel(asset.model,wheelFrames);
 // Browser session policy: first native paint variant for unspecified colors.
 // This is deliberately separate from the unfinished native population RNG.
 const colors=chooseVehicleColors(catalog.colors,asset.vehicle.model,0).colors.map(rgb=>[...rgb]) as [[number,number,number],[number,number,number],[number,number,number],[number,number,number]];
 if(generator.primaryColor!==-1&&generator.secondaryColor!==-1)for(const [slot,index] of [generator.primaryColor,generator.secondaryColor].entries()){
  const rgb=catalog.colors.palette[index]?.rgb;requireAsset(rgb,`Unresolved generator paint index ${index}.`);colors[slot]=[...rgb!];
 }
 const lightTexture=asset.textures.find(t=>t.name.toLowerCase()==='vehiclelights128');
 requireAsset(lightTexture,'Native car light texture is missing.');
 const handling=prepareHandling(asset.handling,id);
 return {vehicle:asset.vehicle,handling,model:asset.model,collision:asset.collision!,textures:asset.textures,wheelFrames,colors,lightTexture,animGroup:readVehicleAnimGroups(catalog.handling.supplements).get(handling.values.animationGroup)};
}
