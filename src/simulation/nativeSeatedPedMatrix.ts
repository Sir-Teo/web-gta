import {Quaternion,Vector3} from 'three';
import type {Vec3} from '../core/math';
import {bikeLeanDrop} from './nativeBikeLean';
// Offset commands can repeat in a script frame. Return independent native vectors while reusing math temporaries.
const q=new Quaternion(),twist=new Quaternion(),point=new Vector3(),up=new Vector3(),right=new Vector3(),forward=new Vector3();
const rollAxis=new Vector3(0,0,1),pitchAxis=new Vector3(1,0,0),yawAxis=new Vector3(0,1,0);
const native=(v:Vector3)=>({x:v.x,y:-v.z,z:v.y});
/** CPed::SetPedPositionInCar (PC 0x5DF910), for the ped's actual matrix (GET_OFFSET_FROM_CHAR_IN_WORLD_COORDS).
 * GET_CHAR_COORDINATES and GET_CHAR_HEADING separately select the vehicle while the ped is seated. */
export function nativeSeatedPedMatrix(position:Vec3,rotation:{x:number;y:number;z:number;w:number},local:Vec3,
 options:{headingOffset?:number;bikeLean?:number;boundsMinZ?:number}={}){
 q.copy(rotation);up.set(0,1,0).applyQuaternion(q);
 if(options.bikeLean!==undefined){const lean=options.bikeLean;q.multiply(twist.setFromAxisAngle(rollAxis,-lean)).multiply(twist.setFromAxisAngle(pitchAxis,-.05*Math.abs(lean)));}
 point.set(local.x,local.z,-local.y).applyQuaternion(q).add(position);
 if(options.bikeLean!==undefined)point.addScaledVector(up,bikeLeanDrop(options.bikeLean,options.boundsMinZ??0));
 if(options.headingOffset)q.multiply(twist.setFromAxisAngle(yawAxis,options.headingOffset));
 right.set(1,0,0).applyQuaternion(q);forward.set(0,0,-1).applyQuaternion(q);up.set(0,1,0).applyQuaternion(q);
 return {position:native(point),right:native(right),forward:native(forward),up:native(up)};
}
