import {Quaternion,Vector3} from 'three';
import type {NativeCharacter} from '../../src/render/NativeCharacter';
import type {bindAnimation} from '../../src/animation/bind';
/** Capture sampled root-node inputs and the rendered result; native replay owns blend calculations. */
export function captureVehicleRootPose(view:NativeCharacter,pose:Parameters<NativeCharacter['updateVehicle']>[1]){
 const internal=view as unknown as {shadowRootBone?:import('three').Object3D;vehicleBindings:Map<string,ReturnType<typeof bindAnimation>>},root=internal.shadowRootBone;
 if(!root||pose.blend!==undefined&&pose.blend!==1||pose.overlays?.some(a=>a.amount>0)||pose.overlay?.amount)return;
 const sample=(clip:string,seconds:number,amount:number)=>{
  const result={amount,rotation:[0,0,0,1],translation:null as number[]|null,valid:false};
  internal.vehicleBindings.get(clip)?.visitPose(seconds,false,(target,rotation,translation)=>{if(target===root){result.rotation=rotation.toArray();result.translation=translation?.toArray()??null;result.valid=true;}});
  return result;
 };
 const base=sample(pose.clip,pose.seconds,1);if(!base.valid)return;
 const layers=(pose.partials??[]).map(a=>sample(a.clip,a.seconds,a.amount)),rotation=new Quaternion(),translation=new Vector3(),scale=new Vector3();root.matrix.decompose(translation,rotation,scale);
 return {input:{base,layers,rest:[0,0,0],root:2},actual:{rotation:rotation.toArray(),translation:translation.toArray()}};
}
