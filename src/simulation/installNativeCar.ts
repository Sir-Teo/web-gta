import {assertNativeVehicleTerrainSupport} from './nativeVehicleTerrainSupport';
import {stepWheelAnimation} from './nativeWheelAnimation';
import {bindNativeWheelAnimation,type WheelAnimationPoses} from '../render/nativeWheelAnimation';
import {NATIVE_CAR_WHEELS} from './nativeDriveContacts';
import {nativeAmbientState} from '../assets/nativeMaterial';
import type RAPIER from '@dimforge/rapier3d-compat';
import {Group,Matrix4,Mesh,Vector3,type Scene} from 'three';
import {DOOR_NODES} from './nativeDoor';
import type {DffModel} from '../assets/dff';
import type {ColModel} from '../assets/col';
import type {VehicleIdeRecord} from '../assets/vehicleIde';
import type {ModelTexture} from '../assets/modelTextures';
import {modelObject} from '../assets/ModelObjects';
import {prepareCarModel} from '../assets/prepareCarModel';
import {chooseVehicleExtras,vehicleExtraFrames} from '../vehicle/nativeVehicleExtras';
import {bindNativeCarPaint,type NativeCarColors} from '../render/nativeCarPaint';
import {bindNativeCarLightMaterials,setCarLightState} from '../render/nativeCarLightMaterials';
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
import type {VehicleAnimGroupData} from '../assets/vehicleAnimGroups';
export interface NativeCarAssets {
  vehicle:VehicleIdeRecord;handling:ReturnType<typeof prepareHandling>;model:DffModel;collision:ColModel;textures?:ModelTexture[];
  wheelFrames?:Record<CarWheel,number>;colors?:NativeCarColors;lightTexture?:ModelTexture;
  /** CVehicleModelInfo's extra component choice: the instance's random and CWeather's rainy state. */
  extraRandom?:()=>number;raining?:boolean;
  /** ChooseVehicleColour's carcols variation and its four palette indices. */
  colourIndices?:readonly [number,number,number,number];colourVariation?:number;
  /** CVehicleModelInfo's plate text and GetMapRegionPlateDesign's plateback (CCustomCarPlateMgr). */
  plate?:{text:string;design:number};
  /** The handling `^` row selected by the vehicle's anim group column. */
  animGroup?:VehicleAnimGroupData;
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
  const basePrepared=prepareCarModel(assets.model,wheelFrames);
  // CVehicleModelInfo::CreateInstance: PreprocessHierarchy takes every `extra` atomic out of the clump and this
  // instance adds back at most the two its comps rules choose, so the rest of the model's extras never render.
  const extraFrames=vehicleExtraFrames(assets.model.frames);
  const chosenExtras=extraFrames.length?chooseVehicleExtras(assets.vehicle.components,extraFrames.length,assets.extraRandom,assets.raining):[];
  const shownExtraFrames=new Set(chosenExtras.map(index=>extraFrames[index]));
  const prepared={...basePrepared,atomics:basePrepared.atomics.map((a,i)=>{
    const name=assets.model.frames[a.frame].name;
    if(extraFrames.includes(a.frame)&&!shownExtraFrames.has(a.frame))return {...a,flags:0};
    return name.includes('_dam')?{...a,flags:assets.model.atomics[i]?.flags??a.flags}:a;
  })};
  const damagedFrames=new Map<string,import('three').Object3D>();
  // CAutomobile::SetDoorDamage/SetPanelDamage/SetBumperDamage visibility: doors show `_dam` only when damaged
  // (an opened door keeps its previous atomic); panels and bumpers show `_dam` from their first stage and vanish
  // at opened-damaged; not-present hides both.
  let componentStates:Record<string,number>={};
  const applyDamage=()=>{for(const [name,node] of damagedFrames){const base=name.replace(/_(ok|dam)$/,''),state=componentStates[base]??0,door=/^(door_|bonnet|boot)/.test(base),missing=state===4||!door&&state===3,damaged=door?state===2||state===3:state>0;node.visible=!missing&&(name.endsWith('_dam')?damaged:!damaged);}};
  const doorFrames:(import('three').Object3D|undefined)[]=[],doorPositions:Vector3[]=[];
  const physical=installNativeVehicleBody(world,assets.collision,assets.handling,pose,contact),root=new Group();root.name=assets.vehicle.model;
  const ambient=nativeAmbientState();
  let lod:ReturnType<typeof bindNativeCarLod>|undefined;
  let paint:ReturnType<typeof bindNativeCarPaint>|undefined;
  let lights:ReturnType<typeof bindNativeCarLightMaterials>|undefined;
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
    visual=modelObject(prepared,assets.textures??[],undefined,undefined,{worldLighting:true,ambient});applyNativeWheelRestPose(visual.root,wheelFrames,wheelPose.positions);wheelAnimation=bindNativeWheelAnimation(visual.root,wheelFrames);if(assets.lightTexture)lights=bindNativeCarLightMaterials(visual.materialBindings,assets.lightTexture);paint=bindNativeCarPaint(visual.materialBindings,assets.lightTexture);if(assets.colors)paint.setColors(assets.colors);lod=bindNativeCarLod(visual.root,prepared,wheelFrames);visual.root.traverse(o=>{if(/_(ok|dam)$/.test(o.name)&&prepared.frames.some(f=>f.name===o.name.replace(/_(ok|dam)$/,'_dam')))damagedFrames.set(o.name,o);});applyDamage();
    for(const name of DOOR_NODES){const frame=visual.root.getObjectByName(name);doorFrames.push(frame);doorPositions.push(frame?new Vector3().setFromMatrixPosition(frame.matrix):new Vector3());}
    // The model's Z-up to Y-up turn never changes.
    visual.root.updateMatrix();visual.root.matrixAutoUpdate=false;
    root.add(visual.root);update(1);scene.add(root);
  }catch(error){dispose();throw error;}
  const axisVectors=[new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)];
  const baseByMaterial=new Map<object,{opaque:boolean;opacity:number}>();
  /** CVisibilityPlugins::SetClumpAlpha: every material's own alpha scaled by the clump alpha (0 to 1). */
  const setAlpha=(alpha:number)=>{
    if(!visual)return;const a=Math.max(0,Math.min(1,alpha));
    for(const b of visual.materialBindings){
      let base=baseByMaterial.get(b.material);if(!base){base={opaque:!b.material.transparent,opacity:Number.isFinite(b.material.opacity)?b.material.opacity:1};baseByMaterial.set(b.material,base);}
      b.material.opacity=base.opacity*a;b.material.transparent=a<1||!base.opaque;
    }
  };
  return {root,setComponentDamage(states:Record<string,number>){componentStates={...states};applyDamage();},body:physical.body,sources:physical.sources,dispose,update,setAlpha,materialBindings:()=>visual?.materialBindings??[],
    /** Native frame-local positions of the eDoors dummies, or undefined when the model lacks the frame. */
    doorPosition(index:number){return doorFrames[index]?doorPositions[index]:undefined;},
    /** CDoor::UpdateFrameMatrix: SetRotateKeepPos about the hinge axis in native frame space. */
    setDoorAngle(index:number,axis:number,angle:number){const frame=doorFrames[index];if(!frame)return;frame.matrix.makeRotationAxis(axisVectors[axis],angle).setPosition(doorPositions[index]);frame.matrixWorldNeedsUpdate=true;},
    /** CBouncingPanel::ProcessPanel output: the frame's rest matrix with native basis entries [column,row,value] overwritten. */
    setFrameBasis(name:string,entries:readonly [number,number,number][]){const frame=visual!.root.getObjectByName(name),index=frame?.userData.nativeFrame;if(!frame||!Number.isInteger(index))return false;frame.matrix.fromArray(assets.model.frames[index].matrix);for(const [column,row,value] of entries)frame.matrix.elements[column*4+row]=value;frame.matrixWorldNeedsUpdate=true;return true;},
    hasFrame(name:string){return !!visual!.root.getObjectByName(name);},
    /** RwFrameGetLTM(frame)->pos: the named frame's world position, renderer space. */
    frameWorldPosition(name:string){const frame=visual!.root.getObjectByName(name);if(!frame)return undefined;visual!.root.updateWorldMatrix(true,false);frame.updateWorldMatrix(true,false);return new Vector3().setFromMatrixPosition(frame.matrixWorld);},
    /** RwFrameGetMatrix(frame)->pos: the named frame's position relative to its parent, in native units. */
    nativeFramePosition(name:string){const index=visual!.root.getObjectByName(name)?.userData.nativeFrame;return Number.isInteger(index)?new Vector3().fromArray(assets.model.frames[index].matrix,12):undefined;},
    /** Detached copy of a component's currently visible atomics in native frame space, for flying components. */
    cloneComponent(name:string){const frame=visual!.root.getObjectByName(name);if(!frame)return;frame.updateWorldMatrix(true,true);const copy=new Group();frame.traverse(o=>{if(o!==frame&&o instanceof Mesh&&o.visible&&(o.parent===frame||o.parent?.visible)){const mesh=o.clone(false);mesh.matrixAutoUpdate=false;mesh.matrix.copy(new Matrix4().copy(frame.matrixWorld).invert().multiply(o.matrixWorld));copy.add(mesh);}});return copy.children.length?{object:copy,matrixWorld:frame.matrixWorld.clone()}:undefined;},
    setViewDistance(distanceSquared:number,generationMultiplier:number){requireAsset(!disposed,'Native car is disposed.');return lod!.update(distanceSquared,generationMultiplier);},
    setColors(colors:NativeCarColors){requireAsset(!disposed,'Native car is disposed.');paint!.setColors(colors);},
    /** Active-light switching: brake pedal brightens rear lamps, night brightens fronts. */
    setLightState(brake:boolean,headlights:boolean){if(lights)setCarLightState(lights,{brake,headlights});},
    setNight(amount:number){requireAsset(!disposed,'Native car is disposed.');visual!.setNight(amount);},
    setAmbient(rgb:readonly number[]|undefined,multiplier=1,contactMultiplier=1){
      requireAsset(!disposed,'Native car is disposed.');
      requireAsset(Number.isFinite(multiplier)&&multiplier>=0&&Number.isFinite(contactMultiplier)&&contactMultiplier>=0&&(!rgb||rgb.length===3&&rgb.every(v=>Number.isFinite(v)&&v>=0&&Number.isFinite(v*multiplier))),'Invalid native car ambient lighting.');
      if(rgb)ambient.color.value.set(rgb[0]*multiplier,rgb[1]*multiplier,rgb[2]*multiplier);
      ambient.enabled.value=!!rgb;ambient.directMultiplier.value=contactMultiplier;
    },
    assertTerrainSupport(handles:Iterable<number>){requireAsset(!disposed,'Native car is disposed.');return assertNativeVehicleTerrainSupport(world,handles,physical.body,lines);},
    snapshot(){return controller!.snapshot();},
    wheelSnapshot(){return structuredClone(wheelCurrent);},
    /** A car on rails (STATUS_SIMPLE) is placed rather than simulated: the render interpolates from where it was. */
    placeOnRails(position:{x:number;y:number;z:number},rotation:{x:number;y:number;z:number;w:number},velocity:{x:number;y:number;z:number}){
      requireAsset(!disposed,'Native car is disposed.');
      previous={...physical.body.translation()};previousRotation={...physical.body.rotation()};
      physical.body.setTranslation(position,false);physical.body.setRotation(rotation,false);physical.body.setLinvel(velocity,false);physical.body.setAngvel({x:0,y:0,z:0},false);
    },
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
