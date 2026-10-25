import {Matrix4,Quaternion,Vector3,type Object3D} from 'three';
import {requireAsset} from '../assets/binary';
import type {DffModel} from '../assets/dff';
/** CBike::PreRender's fork quaternion (iOS 0x100455644–0x1004556f4).
 * CFileLoader::LoadVehicleObject reads the rake degrees from vehicles.ide's misc column for bike/bmx. */
export function bikeForkRotation(rakeDegrees:number,steerAngle:number,target=new Matrix4()){
 requireAsset(Number.isFinite(rakeDegrees)&&Number.isFinite(steerAngle),'Invalid bike steering angle.');
 const rake=rakeDegrees*Math.PI/180,axis=new Vector3(0,Math.sin(rake),-Math.cos(rake));
 return target.makeRotationFromQuaternion(new Quaternion().setFromAxisAngle(axis,-steerAngle));
}
export function bindBikeSteering(root:Object3D,model:Pick<DffModel,'frames'>,rakeDegrees:number){
 const index=model.frames.findIndex(f=>f.name==='forks_front'),matches:Object3D[]=[];
 requireAsset(index>=0,'Bike steering requires the native front fork.');
 root.traverse(f=>{if(f.userData.nativeFrame===index)matches.push(f);});
 requireAsset(matches.length===1&&!matches[0].matrixAutoUpdate,'Expected one imported bike fork.');
 const fork=matches[0],position=new Vector3().setFromMatrixPosition(fork.matrix);
 return {update(steerAngle:number){
  // Native SetUnity + the steering quaternion overwrites the fork's rest basis, then restores its translation.
  bikeForkRotation(rakeDegrees,steerAngle,fork.matrix).setPosition(position);fork.matrixWorldNeedsUpdate=true;
 }};
}
