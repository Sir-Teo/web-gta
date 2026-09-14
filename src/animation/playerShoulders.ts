import {Euler,Matrix4,Object3D,Vector3} from 'three';
import type {DffModel} from '../assets/dff';

/** CPed::ShoulderBoneRotation (0x5DF560), after animation/IK.
 * Native ORDER_ZYX | SWAP_XZ extraction and reconstruction cancel their
 * sign/swap conventions, yielding ZYX with the X component halved. */
export function playerShoulderMatrix(clavicle:Matrix4,upperArm:Matrix4,out=new Matrix4()){
 const relative=new Matrix4().copy(clavicle).invert().multiply(upperArm),e=relative.elements;
 const cy=Math.hypot(e[10],e[6]);
 const x=cy>0.0000019073486?Math.atan2(e[6],e[10]):0;
 const y=Math.atan2(-e[2],cy);
 const z=cy>0.0000019073486?Math.atan2(e[1],e[0]):Math.atan2(-e[4],e[5]);
 const position=new Vector3().setFromMatrixPosition(relative);
 relative.makeRotationFromEuler(new Euler(x/2,y,z,'ZYX')).setPosition(position);
 return out.multiplyMatrices(clavicle,relative);
}

/** Explicitly bind only the native player body; generic pedestrians do not run
 * this correction. Call update after sampling the pose and before rendering. */
export function bindPlayerShoulders(model:DffModel,root:Object3D){
 const frames=new Map<number,Object3D>();
 root.traverse(o=>{if(Number.isInteger(o.userData.nativeFrame)){
  if(frames.has(o.userData.nativeFrame))throw new Error('Player shoulders require one model instance.');
  frames.set(o.userData.nativeFrame,o);
 }});
 const bone=(id:number)=>{
  const matches=model.frames.flatMap((f,i)=>f.hanim?.id===id?[i]:[]);
  const object=matches.length===1?frames.get(matches[0]):undefined;
  if(!object?.parent)throw new Error(`Missing or ambiguous player shoulder bone ${id}.`);
  return object;
 };
 const pairs=[[302,32,31],[301,22,21]].map(([helper,arm,clavicle])=>({helper:bone(helper),arm:bone(arm),clavicle:bone(clavicle)}));
 const corrected=new Matrix4(),inverseParent=new Matrix4();
 return {update(){
  root.updateMatrixWorld(true);
  for(const {helper,arm,clavicle} of pairs){
   playerShoulderMatrix(clavicle.matrixWorld,arm.matrixWorld,corrected);
   helper.matrix.copy(inverseParent.copy(helper.parent!.matrixWorld).invert().multiply(corrected));
   helper.matrixAutoUpdate=false;helper.matrixWorldNeedsUpdate=true;helper.updateMatrixWorld(true);
  }
 }};
}
