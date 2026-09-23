import {Matrix4,Quaternion,Vector3,type Object3D} from 'three';
/* IKChain_c and BoneNode_c (source/game_sa/Ragdoll, reversed): the solver behind g_ikChainMan.PointArm.
 *
 * - SetupBones walks from the effector bone up the parent links to (not including) the pivot bone; each BoneNode_c
 *   starts from the animation keyframe's rotation and translation and keeps its own orientation from then on.
 * - Update: the pivot's world matrix, CalcWldMat down the chain, MoveBonesToTarget, then BlendKeyframe(m_Blend)
 *   slerps every keyframe toward the node's orientation.
 * - MoveBonesToTarget, from the effector up: the effector offset carried by the effector's matrix, plus the effector
 *   bone's position relative to this bone, is turned toward the target about their cross product (expressed in the
 *   parent's frame) by bone speed × acos(dot) × chain speed; nothing turns once dot ≥ 0.997. Limit clamps the
 *   node's Tait-Bryan XYZ angles (QuatToEuler) between PoseRots − Min and PoseRots + Max; CalcWldMat then carries
 *   the change down to the effector.
 * - BoneNodeManager_c::ms_boneInfos (limits, pose rotations) lives in the executable (0x8D26D0) and is not in the
 *   reversed source. The limits here are authored: see ARM_LIMITS. */

export type EulerDeg=[number,number,number];
/** QuatToEuler (0x617080): Tait-Bryan XYZ in degrees. */
export function quatToEulerDeg(q:Quaternion):EulerDeg{
 const {x,y,z,w}=q,sinPitch=2*(x*z-y*w),deg=180/Math.PI;
 const py=Math.asin(Math.max(-1,Math.min(1,-sinPitch)))*deg;
 if(Math.abs(sinPitch-1)<1e-4)return [Math.atan2(-2*(y*z-x*w),1-2*(x*x+z*z))*deg,py,0];
 return [Math.atan2(2*(x*w+y*z),1-2*(x*x+y*y))*deg,py,Math.atan2(2*(z*w+x*y),1-2*(y*y+z*z))*deg];
}
/** EulerToQuat (0x6171F0). */
export function eulerDegToQuat(e:EulerDeg,out=new Quaternion()){
 const r=Math.PI/360,cx=Math.cos(e[0]*r),sx=Math.sin(e[0]*r),cy=Math.cos(e[1]*r),sy=Math.sin(e[1]*r),cz=Math.cos(e[2]*r),sz=Math.sin(e[2]*r);
 const cc=cx*cz,cs=cx*sz,sc=sx*cz,ss=sx*sz;
 return out.set(sc*cy-cs*sy,cc*sy+ss*cy,cs*cy-sc*sy,cc*cy+ss*sy).normalize();
}
/** A limit range per axis in degrees around the node's starting angles: [min below, max above]. */
export interface BoneLimits {x:[number,number];y:[number,number];z:[number,number]}
/** Authored stand-ins for ms_boneInfos along the arm chain. The measured rigs bend the elbow about the forearm's local
 * Z only (idle −7°, the aim clips' ready frame −107°), so the forearm is a Z hinge between straight and fully bent;
 * the clavicle only shrugs a little; the upper arm and wrist are free enough to point the gun. */
export const ARM_LIMITS:Readonly<Record<'clavicle'|'upperArm'|'foreArm'|'hand',BoneLimits>>={
 clavicle:{x:[10,10],y:[10,10],z:[10,10]},
 upperArm:{x:[180,180],y:[90,90],z:[180,180]},
 foreArm:{x:[0,0],y:[0,0],z:[160,160]},
 hand:{x:[45,45],y:[45,45],z:[45,45]},
};
const FOREARM_Z_RANGE:[number,number]=[-160,0];

class BoneNode {
 orientation=new Quaternion();position=new Vector3();world=new Matrix4();parent?:BoneNode;children:BoneNode[]=[];
 min:EulerDeg;max:EulerDeg;speed=1;
 constructor(readonly object:Object3D,limits:BoneLimits,hinge?:[number,number]){
  const scale=new Vector3();object.matrix.decompose(this.position,this.orientation,scale);
  const pose=quatToEulerDeg(this.orientation);
  this.min=[pose[0]-limits.x[0],pose[1]-limits.y[0],hinge?hinge[0]:pose[2]-limits.z[0]];
  this.max=[pose[0]+limits.x[1],pose[1]+limits.y[1],hinge?hinge[1]:pose[2]+limits.z[1]];
 }
 /** CalcWldMat (0x616CD0): this node and everything below it. */
 calcWorld(parentWorld:Matrix4){
  this.world.compose(this.position,this.orientation,ONE).premultiply(parentWorld);
  for(const child of this.children)child.calcWorld(this.world);
 }
 /** Limit (0x617650); the head's Z scaling does not apply to arm bones. */
 limit(){
  const e=quatToEulerDeg(this.orientation);
  for(let i=0;i<3;i++)e[i]=Math.max(this.min[i],Math.min(this.max[i],e[i]));
  eulerDegToQuat(e,this.orientation);
 }
 get worldPosition(){return scratch.setFromMatrixPosition(this.world);}
}
const ONE=new Vector3(1,1,1),scratch=new Vector3();

/** One arm's IKChain_c: bones from the effector (index 0) to the one below the pivot. */
export class NativeIkChain {
 readonly bones:BoneNode[];
 blend=0;
 private readonly parentRotation=new Quaternion();
 constructor(readonly pivot:Object3D,chain:{object:Object3D;limits:BoneLimits;hinge?:[number,number]}[],readonly effectorOffset=new Vector3(0,.05,0),readonly speed=.5){
  this.bones=chain.map(c=>new BoneNode(c.object,c.limits,c.hinge));
  for(let i=0;i<this.bones.length-1;i++){this.bones[i].parent=this.bones[i+1];this.bones[i+1].children.push(this.bones[i]);}
 }
 /** Update (0x6184B0) without the keyframe blend: the pivot, the world matrices, then MoveBonesToTarget. */
 moveToTarget(target:Vector3){
  const pivot=this.pivot.matrixWorld,last=this.bones[this.bones.length-1];
  last.calcWorld(pivot);
  const root=this.bones[0],effector=new Vector3(),toRoot=new Vector3(),toTarget=new Vector3(),axis=new Vector3(),turn=new Quaternion();
  for(const bone of this.bones){
   effector.copy(this.effectorOffset).transformDirection(root.world).multiplyScalar(this.effectorOffset.length());
   const bonePosition=bone.worldPosition.clone();
   toRoot.copy(effector).add(root.worldPosition).sub(bonePosition);if(toRoot.length()<=1e-5)continue;toRoot.normalize();
   toTarget.copy(target).sub(bonePosition);if(toTarget.length()<=1e-5)continue;toTarget.normalize();
   const dot=toTarget.dot(toRoot);if(dot>=.997)continue;
   const parentWorld=bone.parent?bone.parent.world:pivot;
   // The cross product in world space, carried into the parent's frame, turns the node's parent-relative rotation.
   this.parentRotation.setFromRotationMatrix(parentWorld).invert();
   axis.crossVectors(toRoot,toTarget).applyQuaternion(this.parentRotation);if(axis.lengthSq()<1e-12)continue;
   turn.setFromAxisAngle(axis.normalize(),bone.speed*Math.acos(Math.max(-1,Math.min(1,dot)))*this.speed);
   bone.orientation.premultiply(turn);
   bone.limit();
   bone.calcWorld(parentWorld);
  }
 }
 /** BlendKeyframe (0x616E30) for every node: the animation's rotation slerped toward the node's by `blend`. */
 blendKeyframes(){
  const position=new Vector3(),rotation=new Quaternion(),scale=new Vector3();
  for(const bone of this.bones){
   bone.object.matrix.decompose(position,rotation,scale);
   rotation.slerp(bone.orientation,this.blend);
   bone.object.matrix.compose(position,rotation,scale);bone.object.matrixWorldNeedsUpdate=true;
  }
 }
}
/** The arm chain PointArm builds: CTaskSimpleIKPointArm's effector hand, offset (0, 0.05, 0), pivot BONE_NECK. */
export function armChain(bone:(id:number)=>Object3D|undefined,arm:'right'|'left',speed:number){
 const ids=arm==='right'?[24,23,22,21]:[34,33,32,31],neck=bone(4);
 const objects=ids.map(bone);if(!neck||objects.some(o=>!o))return undefined;
 const limits=[ARM_LIMITS.hand,ARM_LIMITS.foreArm,ARM_LIMITS.upperArm,ARM_LIMITS.clavicle];
 return new NativeIkChain(neck,objects.map((object,i)=>({object:object!,limits:limits[i],...(i===1?{hinge:FOREARM_Z_RANGE}:{})})),new Vector3(0,.05,0),speed);
}
/** CTaskSimpleIKChain::ProcessPed's blend step (0x633D98), including the original's lerp: it moves the remaining
 * distance by stepMs / (targetTime − stepMs − now), so a target renewed every frame is only ever approached. */
export function stepIkBlend(blend:number,target:number,nowMs:number,targetTimeMs:number,stepMs:number){
 if(nowMs<=targetTimeMs){const denominator=targetTimeMs-stepMs-nowMs;return blend+(target-blend)*(denominator>0?Math.min(1,stepMs/denominator):1);}
 return target;
}
