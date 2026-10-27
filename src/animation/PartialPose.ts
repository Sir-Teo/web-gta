import {Object3D,Quaternion,Vector3} from 'three';
import type {bindAnimation,LocalPoseVisitor} from './bind';
type Binding=ReturnType<typeof bindAnimation>;
export interface PartialPoseLayer {binding:Binding;seconds:number;amount:number}
/** Track-aware association pose sum following RpAnimBlend's skinned frame callback.
 * Partial tracks reduce the full-body contribution only on the bones they name.
 * Quaternion terms use hemisphere correction and a final normalization. */
export class PartialPose {
 /** A skinned ped's root has the velocity frame callback and BonePos zero.
  * Vehicle associations here do not extract movement; their root translations sum once. */
 constructor(private root?:Object3D){}
 private frames=new Map<Object3D,{partial:number;rotation:Quaternion;translation:Vector3;translationBlend:number;rest:Vector3;scale:Vector3}>();
 private amount=1;private partial=false;
 private accumulate:LocalPoseVisitor=(target,rotation,translation,rest,scale)=>{
  let frame=this.frames.get(target);
  if(!frame){frame={partial:0,rotation:new Quaternion(0,0,0,0),translation:new Vector3(),translationBlend:0,rest:new Vector3(),scale:new Vector3()};this.frames.set(target,frame);}
  const weight=this.partial?this.amount:this.amount*(1-frame.partial),q=frame.rotation;
  if(weight>0){
   const signed=(q.dot(rotation)>=0?1:-1)*weight;
   q.set(q.x+rotation.x*signed,q.y+rotation.y*signed,q.z+rotation.z*signed,q.w+rotation.w*signed);
   if(translation)frame.translation.addScaledVector(translation,weight);
  }
  if(translation)frame.translationBlend+=this.amount;
  frame.rest.copy(rest);frame.scale.copy(scale);
 };
 sample(base:Binding,seconds:number,layers:readonly PartialPoseLayer[]){
  for(const frame of this.frames.values()){frame.partial=0;frame.rotation.set(0,0,0,0);frame.translation.set(0,0,0);frame.translationBlend=0;}
  // Register tracks before sampling so the base knows each bone's partial sum.
  for(const layer of layers)if(layer.amount>0)for(const target of layer.binding.poseTargets){
   if(!this.frames.has(target))this.frames.set(target,{partial:0,rotation:new Quaternion(0,0,0,0),translation:new Vector3(),translationBlend:0,rest:new Vector3(),scale:new Vector3()});
   this.frames.get(target)!.partial+=layer.amount;
  }
  this.partial=true;
  for(const layer of layers)if(layer.amount>0){this.amount=layer.amount;layer.binding.visitPose(layer.seconds,false,this.accumulate);}
  this.partial=false;this.amount=1;base.visitPose(seconds,false,this.accumulate);
  for(const [target,frame] of this.frames){
   if(frame.rotation.lengthSq()===0)continue;
   frame.rotation.normalize();
   if(target!==this.root)frame.translation.multiplyScalar(frame.translationBlend).addScaledVector(frame.rest,1-frame.translationBlend);
   target.matrix.compose(frame.translation,frame.rotation,frame.scale);target.matrixWorldNeedsUpdate=true;
  }
  // Preserve the binding's animated mesh bounds policy without sampling over the pose sum.
  base.markAnimated();
 }
}
