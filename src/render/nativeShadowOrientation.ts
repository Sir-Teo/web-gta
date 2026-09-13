import {Matrix4,Quaternion,Vector3} from 'three';
import type {Vec3} from '../core/math';
/** StoreRealTimeShadow azimuth and SetLightProperties frame rotations. Input is
 * the runtime Y-up visible-sun vector. Elevation is intentionally not consumed. */
export function nativeShadowOrientation(sun:Vec3){
 if(![sun.x,sun.y,sun.z].every(Number.isFinite)||Math.hypot(sun.x,sun.z)<1e-10)throw new Error('Invalid native shadow sun direction.');
 // Native sun = (x,-z,y). SetLightProperties replaces with Ry(azimuth), then
 // post-concatenates Rx(-90): column-vector equivalent Rx(-90) * Ry(azimuth).
 const azimuth=Math.atan2(-sun.x,sun.z),s=Math.sin(azimuth),c=Math.cos(azimuth);
 const nativeRight=new Vector3(c,-s,0),nativeUp=new Vector3(0,0,-1),nativeAt=new Vector3(s,c,0);
 const convert=(v:Vector3)=>new Vector3(v.x,v.z,-v.y);
 const forward=convert(nativeAt),up=convert(nativeUp),left=convert(nativeRight);
 // RenderWare camera right is screen-left; Three's basis is screen-right/up/back.
 const rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(left.clone().negate(),up,forward.clone().negate())).normalize();
 return {azimuth,rotation,forward,up,nativeAt};
}
