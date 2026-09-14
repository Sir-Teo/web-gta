import type RAPIER from '@dimforge/rapier3d-compat';
import {Group,Matrix4,type Scene} from 'three';
import type {DffModel} from '../assets/dff';
import type {ColModel} from '../assets/col';
import type {VehicleIdeRecord} from '../assets/vehicleIde';
import type {ModelTexture} from '../assets/modelTextures';
import {modelObject} from '../assets/ModelObjects';
import {prepareCarModel} from '../assets/prepareCarModel';
import {requireAsset} from '../assets/binary';
import {interpolateVehiclePose} from '../render/vehiclePose';
import {nativeVehicleSuspension} from './nativeVehicleSuspension';
import {installNativeVehicleBody} from './nativeVehicleBody';
import {NativeRaycastVehicle,type NativeRaycastPlayerInput} from './NativeRaycastVehicle';
import type {prepareHandling} from './nativeHandling';
import type {CarWheel} from './nativeDriveContacts';
export interface NativeCarAssets {
  vehicle:VehicleIdeRecord;handling:ReturnType<typeof prepareHandling>;model:DffModel;collision:ColModel;textures?:ModelTexture[];
  wheelFrames?:Record<CarWheel,number>;
}
/** Owned ordinary-car assembly. Asset associations must already be resolved.
 * Visuals clone the native wheel atomic and hide damaged variants; full component preprocessing remains pending. */
export function installNativeCar(world:RAPIER.World,scene:Scene,assets:NativeCarAssets,pose:Parameters<typeof installNativeVehicleBody>[3],contact:Parameters<typeof installNativeVehicleBody>[4]){
  scene.updateMatrixWorld(true);requireAsset(scene.matrixWorld.equals(new Matrix4()),'Native car requires an untransformed scene root.');
  const lines=nativeVehicleSuspension(assets.vehicle,assets.handling,assets.model,assets.wheelFrames);
  const prepared=prepareCarModel(assets.model,assets.wheelFrames);
  const physical=installNativeVehicleBody(world,assets.collision,assets.handling,pose,contact),root=new Group();root.name=assets.vehicle.model;
  let visual:ReturnType<typeof modelObject>|undefined,controller:NativeRaycastVehicle|undefined,disposed=false;
  let previous={...physical.body.translation()},previousRotation={...physical.body.rotation()};
  const dispose=()=>{if(disposed)return;disposed=true;root.removeFromParent();controller?.dispose();visual?.dispose();physical.dispose();};
  const update=(alpha:number)=>{
    requireAsset(!disposed,'Native car is disposed.');requireAsset(Number.isFinite(alpha)&&alpha>=0&&alpha<=1,'Invalid vehicle interpolation fraction.');
    interpolateVehiclePose(root,{body:physical.body,previous,previousRotation},alpha);
  };
  try{
    controller=new NativeRaycastVehicle(world,physical.body,assets.handling,lines);
    visual=modelObject(prepared,assets.textures??[],undefined,undefined,{worldLighting:true});root.add(visual.root);update(1);scene.add(root);
  }catch(error){dispose();throw error;}
  return {root,body:physical.body,sources:physical.sources,dispose,update,
    setNight(amount:number){requireAsset(!disposed,'Native car is disposed.');visual!.setNight(amount);},
    snapshot(){return controller!.snapshot();},
    stepPlayer(seconds:number,input:NativeRaycastPlayerInput,alreadySkidding:boolean,options?:Parameters<NativeRaycastVehicle['stepPlayer']>[3]){
      requireAsset(!disposed,'Native car is disposed.');
      const position={...physical.body.translation()},rotation={...physical.body.rotation()};
      const result=controller!.stepPlayer(seconds,input,alreadySkidding,options);previous=position;previousRotation=rotation;return result;
    },
  };
}
