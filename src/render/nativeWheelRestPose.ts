import type {Object3D} from 'three';
import {requireAsset} from '../assets/binary';
import {NATIVE_CAR_WHEELS,type CarWheel} from '../simulation/nativeDriveContacts';
/** Apply native-local Z positions to resolved frame identities. Preserve each
 * dummy's authored basis and X/Y; dynamic wheel animation is a separate stage. */
export function applyNativeWheelRestPose(root:Object3D,frames:Record<CarWheel,number>,positions:Record<CarWheel,number>){
 const targets=NATIVE_CAR_WHEELS.map(wheel=>{
  const matches:Object3D[]=[];root.traverse(object=>{if(object.userData.nativeFrame===frames[wheel])matches.push(object);});
  requireAsset(matches.length===1&&!matches[0].matrixAutoUpdate,'Expected one imported matrix-owned wheel frame.');
  requireAsset(Number.isFinite(positions[wheel])&&Math.abs(positions[wheel])<=1e7,'Invalid initial wheel position.');
  return {frame:matches[0],position:positions[wheel]};
 });
 requireAsset(new Set(targets.map(t=>t.frame)).size===4,'Wheel positions require distinct frames.');
 for(const {frame,position} of targets){frame.matrix.elements[14]=position;frame.matrixWorldNeedsUpdate=true;}
 root.updateMatrixWorld(true);
}
