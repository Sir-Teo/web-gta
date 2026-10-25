import {Quaternion,Vector3} from 'three';
import type {Vec3} from '../core/math';
import {bikeLeanDrop} from './nativeBikeLean';
// Script coordinate checks are frequent. Reuse math temporaries while returning an independent point to each caller.
const rotationScratch=new Quaternion(),twistScratch=new Quaternion(),upScratch=new Vector3(),forwardScratch=new Vector3();
const rollAxis=new Vector3(0,0,1),pitchAxis=new Vector3(1,0,0),yawAxis=new Vector3(0,1,0);
/** CPed::SetPedPositionInCar (PC 0x5DF910): transform the native seat point by the vehicle/lean matrix,
 * then apply the seat's facing to the orientation. Script heading comes from the final matrix's forward vector. */
export function nativeSeatedPedPose(position:Vec3,rotation:{x:number;y:number;z:number;w:number},local:Vec3,
 options:{headingOffset?:number;bikeLean?:number;boundsMinZ?:number}={}){
 const q=rotationScratch.copy(rotation),up=upScratch.set(0,1,0).applyQuaternion(q);
 if(options.bikeLean!==undefined){const lean=options.bikeLean;q.multiply(twistScratch.setFromAxisAngle(rollAxis,-lean)).multiply(twistScratch.setFromAxisAngle(pitchAxis,-.05*Math.abs(lean)));}
 const point=new Vector3(local.x,local.z,-local.y).applyQuaternion(q).add(position);
 if(options.bikeLean!==undefined)point.addScaledVector(up,bikeLeanDrop(options.bikeLean,options.boundsMinZ??0));
 if(options.headingOffset)q.multiply(twistScratch.setFromAxisAngle(yawAxis,options.headingOffset));
 const forward=forwardScratch.set(0,0,-1).applyQuaternion(q),heading=(Math.atan2(-forward.x,-forward.z)*180/Math.PI+360)%360;
 return {position:point,heading};
}
