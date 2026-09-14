import type RAPIER from '@dimforge/rapier3d-compat';
import {Group,Matrix4,type Scene} from 'three';
import type {DffModel} from '../assets/dff';
import type {ColModel} from '../assets/col';
import type {VehicleIdeRecord} from '../assets/vehicleIde';
import type {ModelTexture} from '../assets/modelTextures';
import {modelObject} from '../assets/ModelObjects';
import {prepareCarModel} from '../assets/prepareCarModel';
import {bindNativeCarPaint,type NativeCarColors} from '../render/nativeCarPaint';
import {bindNativeCarLightMaterials} from '../render/nativeCarLightMaterials';
import {requireAsset} from '../assets/binary';
import {interpolateVehiclePose} from '../render/vehiclePose';
import {nativeVehicleSuspension} from './nativeVehicleSuspension';
import {nativeSuspensionRestPose} from './nativeSuspensionRestPose';
import {applyNativeWheelRestPose} from '../render/nativeWheelRestPose';
import {bindNativeCarLod} from '../render/nativeCarLod';
import {resolveCarWheelFrames} from '../assets/carWheelFrames';
import {installNativeVehicleBody} from './nativeVehicleBody';
import {NativeRaycastVehicle,type NativeRaycastPlayerInput} from './NativeRaycastVehicle';
import type {prepareHandling} from './nativeHandling';
import type {CarWheel} from './nativeDriveContacts';
export interface NativeCarAssets {
  vehicle:VehicleIdeRecord;handling:ReturnType<typeof prepareHandling>;model:DffModel;collision:ColModel;textures?:ModelTexture[];
  wheelFrames?:Record<CarWheel,number>;colors?:NativeCarColors;lightTexture?:ModelTexture;
}
/** Owned ordinary-car assembly. Asset associations must already be resolved.
 * Visuals clone the native wheel atomic and hide damaged variants; full component preprocessing remains pending. */
export function installNativeCar(world:RAPIER.World,scene:Scene,assets:NativeCarAssets,pose:Parameters<typeof installNativeVehicleBody>[3],contact:Parameters<typeof installNativeVehicleBody>[4]){
  scene.updateMatrixWorld(true);requireAsset(scene.matrixWorld.equals(new Matrix4()),'Native car requires an untransformed scene root.');
  const wheelFrames=assets.wheelFrames??resolveCarWheelFrames(assets.model);
  const lines=nativeVehicleSuspension(assets.vehicle,assets.handling,assets.model,wheelFrames);
  const wheelPose=nativeSuspensionRestPose(lines,assets.handling.values.suspensionForce);
  const prepared=prepareCarModel(assets.model,wheelFrames);
  const physical=installNativeVehicleBody(world,assets.collision,assets.handling,pose,contact),root=new Group();root.name=assets.vehicle.model;
  let lod:ReturnType<typeof bindNativeCarLod>|undefined;
  let paint:ReturnType<typeof bindNativeCarPaint>|undefined;
  let visual:ReturnType<typeof modelObject>|undefined,controller:NativeRaycastVehicle|undefined,disposed=false;
  let previous={...physical.body.translation()},previousRotation={...physical.body.rotation()};
  const dispose=()=>{if(disposed)return;disposed=true;root.removeFromParent();controller?.dispose();visual?.dispose();physical.dispose();};
  const update=(alpha:number)=>{
    requireAsset(!disposed,'Native car is disposed.');requireAsset(Number.isFinite(alpha)&&alpha>=0&&alpha<=1,'Invalid vehicle interpolation fraction.');
    interpolateVehiclePose(root,{body:physical.body,previous,previousRotation},alpha);
  };
  try{
    controller=new NativeRaycastVehicle(world,physical.body,assets.handling,lines);
    visual=modelObject(prepared,assets.textures??[],undefined,undefined,{worldLighting:true});applyNativeWheelRestPose(visual.root,wheelFrames,wheelPose.positions);if(assets.lightTexture)bindNativeCarLightMaterials(visual.materialBindings,assets.lightTexture);paint=bindNativeCarPaint(visual.materialBindings,assets.lightTexture);if(assets.colors)paint.setColors(assets.colors);lod=bindNativeCarLod(visual.root,prepared,wheelFrames);root.add(visual.root);update(1);scene.add(root);
  }catch(error){dispose();throw error;}
  return {root,body:physical.body,sources:physical.sources,dispose,update,
    setViewDistance(distanceSquared:number,generationMultiplier:number){requireAsset(!disposed,'Native car is disposed.');return lod!.update(distanceSquared,generationMultiplier);},
    setColors(colors:NativeCarColors){requireAsset(!disposed,'Native car is disposed.');paint!.setColors(colors);},
    setNight(amount:number){requireAsset(!disposed,'Native car is disposed.');visual!.setNight(amount);},
    snapshot(){return controller!.snapshot();},
    stepPlayer(seconds:number,input:NativeRaycastPlayerInput,alreadySkidding:boolean,options?:Parameters<NativeRaycastVehicle['stepPlayer']>[3]){
      requireAsset(!disposed,'Native car is disposed.');
      const position={...physical.body.translation()},rotation={...physical.body.rotation()};
      const result=controller!.stepPlayer(seconds,input,alreadySkidding,options);previous=position;previousRotation=rotation;return result;
    },
  };
}
