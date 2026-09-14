import {stepWheelAnimation} from './nativeWheelAnimation';
import {bindNativeWheelAnimation,type WheelAnimationPoses} from '../render/nativeWheelAnimation';
import {NATIVE_CAR_WHEELS} from './nativeDriveContacts';
import {nativeAmbientState} from '../assets/nativeMaterial';
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
  let wheelCurrent=Object.fromEntries(NATIVE_CAR_WHEELS.map(wheel=>[wheel,{rotation:0,speed:0,steering:0,height:wheelPose.positions[wheel]}])) as WheelAnimationPoses;
  let wheelPrevious=structuredClone(wheelCurrent),wheelAnimation:ReturnType<typeof bindNativeWheelAnimation>|undefined;
  const prepared=prepareCarModel(assets.model,wheelFrames);
  const physical=installNativeVehicleBody(world,assets.collision,assets.handling,pose,contact),root=new Group();root.name=assets.vehicle.model;
  const ambient=nativeAmbientState();
  let lod:ReturnType<typeof bindNativeCarLod>|undefined;
  let paint:ReturnType<typeof bindNativeCarPaint>|undefined;
  let visual:ReturnType<typeof modelObject>|undefined,controller:NativeRaycastVehicle|undefined,disposed=false;
  let previous={...physical.body.translation()},previousRotation={...physical.body.rotation()};
  const dispose=()=>{if(disposed)return;disposed=true;root.removeFromParent();controller?.dispose();visual?.dispose();physical.dispose();};
  const update=(alpha:number)=>{
    requireAsset(!disposed,'Native car is disposed.');requireAsset(Number.isFinite(alpha)&&alpha>=0&&alpha<=1,'Invalid vehicle interpolation fraction.');
    wheelAnimation?.update(wheelPrevious,wheelCurrent,alpha);
    interpolateVehiclePose(root,{body:physical.body,previous,previousRotation},alpha);
  };
  try{
    controller=new NativeRaycastVehicle(world,physical.body,assets.handling,lines);
    visual=modelObject(prepared,assets.textures??[],undefined,undefined,{worldLighting:true,ambient});applyNativeWheelRestPose(visual.root,wheelFrames,wheelPose.positions);wheelAnimation=bindNativeWheelAnimation(visual.root,wheelFrames);if(assets.lightTexture)bindNativeCarLightMaterials(visual.materialBindings,assets.lightTexture);paint=bindNativeCarPaint(visual.materialBindings,assets.lightTexture);if(assets.colors)paint.setColors(assets.colors);lod=bindNativeCarLod(visual.root,prepared,wheelFrames);root.add(visual.root);update(1);scene.add(root);
  }catch(error){dispose();throw error;}
  return {root,body:physical.body,sources:physical.sources,dispose,update,
    setViewDistance(distanceSquared:number,generationMultiplier:number){requireAsset(!disposed,'Native car is disposed.');return lod!.update(distanceSquared,generationMultiplier);},
    setColors(colors:NativeCarColors){requireAsset(!disposed,'Native car is disposed.');paint!.setColors(colors);},
    setNight(amount:number){requireAsset(!disposed,'Native car is disposed.');visual!.setNight(amount);},
    setAmbient(rgb:readonly number[]|undefined,multiplier=1,contactMultiplier=1){
      requireAsset(!disposed,'Native car is disposed.');
      requireAsset(Number.isFinite(multiplier)&&multiplier>=0&&Number.isFinite(contactMultiplier)&&contactMultiplier>=0&&(!rgb||rgb.length===3&&rgb.every(v=>Number.isFinite(v)&&v>=0&&Number.isFinite(v*multiplier))),'Invalid native car ambient lighting.');
      if(rgb)ambient.color.value.set(rgb[0]*multiplier,rgb[1]*multiplier,rgb[2]*multiplier);
      ambient.enabled.value=!!rgb;ambient.directMultiplier.value=contactMultiplier;
    },
    snapshot(){return controller!.snapshot();},
    wheelSnapshot(){return structuredClone(wheelCurrent);},
    stepPlayer(seconds:number,input:NativeRaycastPlayerInput,alreadySkidding:boolean,options?:Parameters<NativeRaycastVehicle['stepPlayer']>[3]){
      requireAsset(!disposed,'Native car is disposed.');
      const position={...physical.body.translation()},rotation={...physical.body.rotation()};
      const result=controller!.stepPlayer(seconds,input,alreadySkidding,options);
      const next={} as WheelAnimationPoses;
      for(const wheel of NATIVE_CAR_WHEELS){const line=lines[wheel];next[wheel]=stepWheelAnimation(wheelCurrent[wheel],{
        timeStep:Math.fround(seconds*50),state:result.state.wheels[wheel],forwardSpeed:result.contacts[wheel]?.forwardSpeed??0,radius:line.radius,
        contactCount:result.state.drivetrain.contacts[wheel],driven:assets.handling.values.driveType==='4'||(wheel.startsWith('front')?assets.handling.values.driveType==='F':assets.handling.values.driveType==='R'),
        acceleration:result.tires.acceleration,steering:result.steering![wheel],startHeight:line.start.z,springLength:line.springLength,compression:result.sampled.compression[wheel],
      });}
      wheelPrevious=wheelCurrent;wheelCurrent=next;previous=position;previousRotation=rotation;return result;
    },
  };
}
