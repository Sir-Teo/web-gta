import RAPIER from '@dimforge/rapier3d-compat';
import {Group,type Scene} from 'three';
import {modelObject} from '../assets/ModelObjects';
import {nativeAmbientState} from '../assets/nativeMaterial';
import {NativeCarReflection} from '../assets/nativeCarEnvMap';
import {installNativeVehicleBody} from './nativeVehicleBody';
import {prepareHandling} from './nativeHandling';
import {rotationFromNativeRows} from './recordingBody';
import {NativeTrainCarriage,type TrainCarriageModel} from './nativeTrain';
import type {openStaticWorldVehicles} from '../assets/staticWorldVehicles';
/* A train carriage in the browser: its model, drawn where CTrain::ProcessControl puts it, and a kinematic body.
 * ProcessControl sets a carriage's matrix outright each frame and CPhysical's collision code moves nothing on the
 * rails, so the body is moved to the carriage's place and pushes what it meets. */
type Asset=Awaited<ReturnType<Awaited<ReturnType<typeof openStaticWorldVehicles>>['load']>>;
/** handling.cfg's rows for the train handlings (cHandlingDataMgr's VT_ indices). */
const TRAIN_HANDLING_IDS:Readonly<Record<string,number>>={TRAM:43,FREIGHT:98,STREAK:99,FREIFLAT:126,STREAKC:127};

/** What ProcessControl reads of a carriage's model. */
export function trainCarriageModel(asset:Asset):TrainCarriageModel{
 const b=asset.collision!.bounds;
 return {model:asset.vehicle.id,boxLength:b.max[1]-b.min[1],boxMinZ:b.min[2],suspensionLowerLimit:asset.handling.values.suspensionLowerLimit};
}

export class WorldTrain {
 readonly root=new Group();readonly modelId:number;readonly body:RAPIER.RigidBody;
 readonly reflection=new NativeCarReflection();
 private readonly physical:ReturnType<typeof installNativeVehicleBody>;
 private visual?:ReturnType<typeof modelObject>;private ambient=nativeAmbientState();
 disposed=false;
 /** What main's script-vehicle host reads of any vehicle: the body under `car`, the heading as WorldCar's (the body's
  * yaw turned half round), health and the burning and wrecked flags, which nothing here changes. */
 readonly car:{body:RAPIER.RigidBody};
 health=1000;wrecked=false;onFire=false;missionCar=true;
 heading(){const q=this.body.rotation();return Math.atan2(-2*(q.x*q.z+q.w*q.y),-(1-2*(q.x*q.x+q.y*q.y)));}
 constructor(world:RAPIER.World,scene:Scene,asset:Asset,readonly carriage:NativeTrainCarriage){
  this.modelId=asset.vehicle.id;
  const id=TRAIN_HANDLING_IDS[asset.vehicle.handling]??98;
  const handling=prepareHandling(asset.handling,id);
  this.physical=installNativeVehicleBody(world,asset.collision!,handling,{position:{x:0,y:-1000,z:0},rotation:{x:0,y:0,z:0,w:1}},{friction:.5,restitution:.05});
  this.body=this.physical.body;this.car={body:this.body};
  this.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);
  try{this.visual=modelObject(asset.model,asset.textures,undefined,undefined,{worldLighting:true,ambient:this.ambient,carEnv:this.reflection.state});this.root.add(this.visual.root);}
  catch{this.visual=undefined;}
  scene.add(this.root);
  this.applyPose(true);
 }
 /** The carriage's matrix, native, onto the body: at once the first time, and as the next kinematic step after. */
 applyPose(now=false){
  const c=this.carriage,p=c.position,q=rotationFromNativeRows(c.right,c.forward),t={x:p[0],y:p[2],z:-p[1]};
  if(now){this.body.setTranslation(t,true);this.body.setRotation(q,true);}
  else{this.body.setNextKinematicTranslation(t);this.body.setNextKinematicRotation(q);}
 }
 update(){const t=this.body.translation(),q=this.body.rotation();this.root.position.set(t.x,t.y,t.z);this.root.quaternion.set(q.x,q.y,q.z,q.w);}
 setLighting(rgb:readonly number[]|undefined,multiplier:number,night:number){
  if(rgb)this.ambient.color.value.set(rgb[0]*multiplier,rgb[1]*multiplier,rgb[2]*multiplier);
  this.ambient.enabled.value=!!rgb;this.visual?.setNight(night);
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.root.removeFromParent();this.visual?.dispose();this.physical.dispose();}
}
