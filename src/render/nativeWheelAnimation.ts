import {Matrix4,type Object3D} from 'three';
import {requireAsset} from '../assets/binary';
import {NATIVE_CAR_WHEELS,type CarWheel} from '../simulation/nativeDriveContacts';
import type {WheelAnimationPose} from '../simulation/nativeWheelAnimation';
export type WheelAnimationPoses=Record<CarWheel,WheelAnimationPose>;
/** Preserve original wheel geometry, scale and frame translation. Compose native
 * Z-axis steering and X-axis rolling around each wheel center; no primitive wheels. */
/** `scale`: CAutomobile::PreRender's scale on a wheel's frame (width along its axle, diameter), none when undefined. */
export function bindNativeWheelAnimation(root:Object3D,indices:Record<CarWheel,number>,scale?:(wheel:CarWheel)=>{width:number;diameter:number}|undefined){
 const targets=NATIVE_CAR_WHEELS.map(wheel=>{
  const matches:Object3D[]=[];root.traverse(object=>{if(object.userData.nativeFrame===indices[wheel])matches.push(object);});
  requireAsset(matches.length===1&&!matches[0].matrixAutoUpdate,'Expected one imported wheel frame.');
  const frame=matches[0],basis=frame.matrix.clone(),x=basis.elements[12],y=basis.elements[13];basis.setPosition(0,0,0);return {wheel,frame,basis,x,y};
 });
 requireAsset(new Set(targets.map(t=>t.frame)).size===4,'Wheel animation requires distinct frame identities.');
 const steeringMatrix=new Matrix4(),rollingMatrix=new Matrix4(),scaleMatrix=new Matrix4();
 return {update(previous:WheelAnimationPoses,current:WheelAnimationPoses,alpha:number){
  requireAsset(Number.isFinite(alpha)&&alpha>=0&&alpha<=1,'Invalid wheel interpolation.');
  for(const {wheel} of targets)for(const pose of [previous[wheel],current[wheel]])requireAsset(pose&&[pose.rotation,pose.steering,pose.height].every(Number.isFinite),'Invalid wheel pose.');
  for(const {wheel,frame,basis,x,y} of targets){
   const a=previous[wheel],b=current[wheel],lerp=(x:number,y:number)=>x+(y-x)*alpha;
   steeringMatrix.makeRotationZ(lerp(a.steering,b.steering));rollingMatrix.makeRotationX(lerp(a.rotation,b.rotation));
   frame.matrix.copy(steeringMatrix).multiply(rollingMatrix).multiply(basis);
   const s=scale?.(wheel);if(s)frame.matrix.multiply(scaleMatrix.makeScale(s.width,s.diameter,s.diameter));
   frame.matrix.setPosition(x,y,lerp(a.height,b.height));frame.matrixWorldNeedsUpdate=true;
  }
 }};
}
