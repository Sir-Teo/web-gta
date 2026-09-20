/** IKChainManager_c, IKChain_c, BoneNode_c and CTaskSimpleIKLookAt (gta-reversed ead3051): a ped turns his head
 * toward a target. The look-at chain runs from the head (effector offset 0, 0.05, 0) to the neck, so it holds the
 * head bone alone; every frame the bone turns about the axis between its effector direction and the direction to
 * the target by a quarter of the angle between them (bone speed 1 × acos(dot) × 0.25), its Euler angles are
 * clamped to the joint limits, and the animated head is slerped toward it by the task's blend, which rises to 1
 * over the blend time, holds until blendTime before the end, then falls to 0. CPedIntelligence::
 * LookAtInterestingEntities starts one on 1 frame in 100 for an on-screen ped that is not looking, at a random
 * interesting entity within 15 units, for 3 to 5 s with a 500 ms blend and speed 0.25. */
export const LOOK_AT_SPEED=0.25,LOOK_AT_BLEND_MS=500,LOOK_AT_RANGE=15,LOOK_AT_MIN_MS=3000,LOOK_AT_MAX_MS=5000,LOOK_AT_CHANCE=100;
export const HEAD_EFFECTOR_OFFSET:readonly [number,number,number]=[0,0.05,0];
/** BoneNodeManager_c::ms_boneInfos for the head lives in the exe (0x8D26D0); these limits are authored: the turn
 * about the bone's own axis (x, the head's yaw) ±80°, and ±35° and ±25° about the other two, from the animated
 * pose. */
export const HEAD_LIMITS_DEG={x:80,y:35,z:25} as const;
export interface LookAtTask {
 /** CTaskSimpleIKChain: the end time, the blend target and the time it is reached, the current blend, and whether
  * the task is blending out. */
 endTime:number;targetBlend:number;targetTime:number;blend:number;blendMs:number;blendingOut:boolean;
}
/** CTaskSimpleIKLookAt's start: blend to 1 over `blendMs`, end after `durationMs`. */
export function startLookAt(nowMs:number,durationMs:number,blendMs=LOOK_AT_BLEND_MS):LookAtTask{
 return {endTime:nowMs+durationMs,targetBlend:1,targetTime:nowMs+blendMs,blend:0,blendMs,blendingOut:false};
}
/** CTaskSimpleIKChain::ProcessPed's blend: past endTime - blendMs the target drops to 0 at endTime; the blend
 * chases its target with the original's step, `(target - blend) × min(1, step / (targetTime - step - now))`.
 * Returns false once the task is over (blend 0 past the end). */
export function stepLookAt(task:LookAtTask,nowMs:number,stepMs:number){
 if(nowMs>=task.endTime-task.blendMs&&!task.blendingOut){task.targetBlend=0;task.targetTime=task.endTime;task.blendingOut=true;}
 if(nowMs<=task.targetTime){
  const denominator=task.targetTime-stepMs-nowMs;
  task.blend+=(task.targetBlend-task.blend)*(denominator>0?Math.min(1,stepMs/denominator):1);
 }else task.blend=task.targetBlend;
 task.blend=Math.max(0,Math.min(1,task.blend));
 return !(task.blendingOut&&nowMs>=task.endTime);
}
/** CPedIntelligence::LookAtInterestingEntities' roll: on screen, not looking, one frame in a hundred. */
export function shouldStartLookAt(onScreen:boolean,looking:boolean,random:()=>number){
 return onScreen&&!looking&&Math.floor(random()*LOOK_AT_CHANCE)===50;
}
export function lookAtDurationMs(random:()=>number){return LOOK_AT_MIN_MS+Math.floor(random()*(LOOK_AT_MAX_MS-LOOK_AT_MIN_MS));}
export type Quat=[number,number,number,number];
export type V3=[number,number,number];
const dot=(a:V3,b:V3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=(v:V3):V3=>{const l=Math.hypot(v[0],v[1],v[2]);return l>0?[v[0]/l,v[1]/l,v[2]/l]:[0,0,0];};
/** Rotate a unit quaternion (x, y, z, w) by `angle` radians about a unit axis, post-concatenated (RtQuatRotate). */
export function rotateQuat(q:Quat,axis:V3,angle:number):Quat{
 const h=angle/2,s=Math.sin(h),r:Quat=[axis[0]*s,axis[1]*s,axis[2]*s,Math.cos(h)];
 // q' = r * q (the rotation applied after q, in q's parent space)
 const [x1,y1,z1,w1]=r,[x2,y2,z2,w2]=q;
 return [w1*x2+x1*w2+y1*z2-z1*y2,w1*y2-x1*z2+y1*w2+z1*x2,w1*z2+x1*y2-y1*x2+z1*w2,w1*w2-x1*x2-y1*y2-z1*z2];
}
export function applyQuat(q:Quat,v:V3):V3{
 const [x,y,z,w]=q,ix=w*v[0]+y*v[2]-z*v[1],iy=w*v[1]+z*v[0]-x*v[2],iz=w*v[2]+x*v[1]-y*v[0],iw=-x*v[0]-y*v[1]-z*v[2];
 return [ix*w+iw*-x+iy*-z-iz*-y,iy*w+iw*-y+iz*-x-ix*-z,iz*w+iw*-z+ix*-y-iy*-x];
}
/** IKChain_c::MoveBonesToTarget for the one-bone look-at chain, in the bone's parent (neck) space: `orientation` is
 * the head's current local rotation, `effector` the effector offset in head space, `target` the target point in
 * neck space. The head turns about (effectorDir × targetDir) by `speed × acos(dot)`; nothing happens within 0.997
 * of alignment or for degenerate directions. */
export function moveHeadToTarget(orientation:Quat,effector:V3,target:V3,speed:number):Quat{
 const effectorDir=norm(applyQuat(orientation,effector));
 const targetDir=norm(target);
 if(!effectorDir.some(Boolean)||!targetDir.some(Boolean))return orientation;
 const d=Math.max(-1,Math.min(1,dot(targetDir,effectorDir)));
 if(d>=0.997)return orientation;
 const axis=norm(cross(effectorDir,targetDir));if(!axis.some(Boolean))return orientation;
 return rotateQuat(orientation,axis,Math.acos(d)*speed);
}
/** BoneNode_c::QuatToEuler and EulerToQuat (Tait-Bryan XYZ, degrees) around BoneNode_c::Limit: the angles clamp
 * to the pose ± the limits, and the head's roll range shrinks toward the pose as the pitch nears 45°. */
export function quatToEulerDeg(q:Quat):V3{
 const [x,y,z,w]=q,sinPitch=2*(x*z-y*w);
 const py=Math.asin(Math.max(-1,Math.min(1,-sinPitch)));
 let px:number,pz:number;
 if(Math.abs(Math.abs(sinPitch)-1)<1e-4){px=Math.atan2(-2*(y*z-x*w),1-2*(x*x+z*z));pz=0;}
 else{px=Math.atan2(2*(x*w+y*z),1-2*(x*x+y*y));pz=Math.atan2(2*(z*w+x*y),1-2*(y*y+z*z));}
 return [px*180/Math.PI,py*180/Math.PI,pz*180/Math.PI];
}
export function eulerDegToQuat(e:V3):Quat{
 const hx=e[0]*Math.PI/360,hy=e[1]*Math.PI/360,hz=e[2]*Math.PI/360;
 const cx=Math.cos(hx),sx=Math.sin(hx),cy=Math.cos(hy),sy=Math.sin(hy),cz=Math.cos(hz),sz=Math.sin(hz);
 const cc=cx*cz,cs=cx*sz,sc=sx*cz,ss=sx*sz;
 const q:Quat=[sc*cy-cs*sy,cc*sy+ss*cy,cs*cy-sc*sy,cc*cy+ss*sy];
 const m=Math.hypot(...q)||1;return [q[0]/m,q[1]/m,q[2]/m,q[3]/m];
}
export function limitHead(orientation:Quat,pose:V3,limits:{x:number;y:number;z:number}=HEAD_LIMITS_DEG):Quat{
 const a=quatToEulerDeg(orientation);
 const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
 a[0]=clamp(a[0],pose[0]-limits.x,pose[0]+limits.x);
 a[1]=clamp(a[1],pose[1]-limits.y,pose[1]+limits.y);
 const factor=Math.max(0,Math.abs(a[0])/-45+1);
 a[2]=clamp(a[2],pose[2]-limits.z*factor,pose[2]+limits.z*factor);
 return eulerDegToQuat(a);
}
/** RtQuatSlerp for BoneNode_c::BlendKeyframe: the animated orientation toward the IK one by `blend`. */
export function slerpQuat(a:Quat,b:Quat,t:number):Quat{
 let cosHalf=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];let bb=b;
 if(cosHalf<0){cosHalf=-cosHalf;bb=[-b[0],-b[1],-b[2],-b[3]];}
 if(cosHalf>0.9995){const r:Quat=[a[0]+(bb[0]-a[0])*t,a[1]+(bb[1]-a[1])*t,a[2]+(bb[2]-a[2])*t,a[3]+(bb[3]-a[3])*t];const m=Math.hypot(...r)||1;return [r[0]/m,r[1]/m,r[2]/m,r[3]/m];}
 const half=Math.acos(cosHalf),s=Math.sin(half),wa=Math.sin((1-t)*half)/s,wb=Math.sin(t*half)/s;
 return [a[0]*wa+bb[0]*wb,a[1]*wa+bb[1]*wb,a[2]*wa+bb[2]*wb,a[3]*wa+bb[3]*wb];
}
