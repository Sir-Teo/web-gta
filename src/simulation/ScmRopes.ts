import type {Vec3} from '../core/math';
import type {ScmObject,ScmObjects} from '../engine/ScmObjects';
import {CRANE_ARM_MODELS,MAX_ROPES,ROPE_CRANE_MAGNET1,ROPE_CRANE_MAGNO,ROPE_CRANE_TROLLEY,ROPE_REMOVE_BELOW_Z,ROPE_UPDATE_RANGE,
 blendLoadMatrix,craneArmRope,forceUpVector,pointAbove,registerRope,ropeHookModel,ropeLoadFactor,stepRopeNodes,
 tautRopeSpeeds,updateWeightInRope,windRope,type Rope,type RopeMatrix} from './nativeRope';
/* CRopes for the script's world: the ropes the cranes' arms hang (CObject::ProcessControlLogic registering one for each
 * crane arm every frame), their hooks, and CRopes::Update over them, on the script objects' own records. A hook is a
 * script object of its own (CRope::CreateHookObjectForRope's CObject): the object host makes it a body that falls, and
 * the rope holds it at the end of its reach. The pieces of CRope are in nativeRope.ts. */
export type RopeRef={kind:'object'|'vehicle'|'ped';handle:number};
/** eObjectType's OBJECT_TYPE_DECORATION, the hook's type. */
const OBJECT_TYPE_DECORATION=5;
/** The four containers that keep the rope's ground over them (MI_OBJECTFORMAGNOCRANE1-3 and 5; not the barrel). */
const CONTAINERS=new Set(['KMB_CONTAINER_RED','KMB_CONTAINER_YEL','KMB_CONTAINER_BLUE','KMB_CONTAINER_OPEN']);
export interface ScmRopesHost {
 /** The camera's place, native. */
 cameraPosition?():Vec3|undefined;
 /** CWorld::FindGroundZFor3DCoord under a native point. */
 groundBelow?(p:Vec3):number|undefined;
 /** The model's collision bounds, native, once read. */
 objectBounds?(model:number|string):{max:{z:number}}|null|undefined;
 /** The winch's mission audio event (104) on the rope's holder. */
 winchSound?(holder:RopeRef|undefined):void;
}
/** The crane controls a frame: which crane the player works (CRopes::PlayerControlsCrane) and the pad's raise (Square),
 * lower (Cross) and release (Circle) buttons, 0 to 255. */
export interface RopeControls {playerControlsCrane:number;raise:number;lower:number;release:number}
export class ScmRopes {
 /** CRopes::aRopes. */
 readonly ropes:(Rope<RopeRef>|undefined)[]=Array.from({length:MAX_ROPES},()=>undefined);
 /** ENABLE_CRANE_CONTROLS' three flags (iOS 0x10079d214-216): raising, lowering and letting go allowed. CTheScripts::Init
  * sets all three. */
 enable:[boolean,boolean,boolean]=[true,true,true];
 /** CTimer::m_FrameCounter, for the rope's every-8th-frame ground search. */
 private frame=0;
 constructor(private readonly objects:ScmObjects,private readonly host:ScmRopesHost){}
 /** CRopes::FindRope by its id (the holder's handle stands for the original's pointer). */
 find(id:number){return this.ropes.find(r=>r&&r.type&&r.id===id);}
 /** A frame: each crane arm registers its rope (CObject::ProcessControlLogic), then CRopes::Update. */
 step(seconds:number,nowMs:number,controls:RopeControls){
  if(!(seconds>0))return;
  const ts=seconds*50;this.frame=(this.frame+1)>>>0;
  for(const o of this.objects.values()){
   if(typeof o.model!=='string')continue;
   const model=o.model.toUpperCase();
   if(model!==CRANE_ARM_MODELS.magno&&model!==CRANE_ARM_MODELS.trolley&&model!==CRANE_ARM_MODELS.quarry)continue;
   const rope=this.find(o.handle),arm=craneArmRope(model,o.position,this.objects.matrix(o.handle),rope);
   if(!arm)continue;
   const registered=registerRope<RopeRef>(this.ropes,o.handle,arm.type,arm.top,false,arm.wound,true,{kind:'object',handle:o.handle},false,20000,nowMs);
   if(registered&&!this.hookObject(registered))this.createHook(registered);
  }
  for(const rope of this.ropes)if(rope?.type)this.update(rope,ts,nowMs,controls);
 }
 /** The ropes the camera is near enough to see (CRope::Render's 120 across), node by node. */
 visible(camera:Vec3,range:number){
  const out:Rope<RopeRef>[]=[];
  for(const rope of this.ropes)if(rope?.type&&Math.hypot(rope.segments[0].x-camera.x,rope.segments[0].y-camera.y)<range)out.push(rope);
  return out;
 }
 private object(ref:RopeRef|undefined):ScmObject|undefined{
  return ref?.kind==='object'&&this.objects.exists(ref.handle)?this.objects.at(ref.handle):undefined;
 }
 /** The hook's object, the reference cleared once the object has gone (CEntity::RegisterReference). */
 private hookObject(rope:Rope<RopeRef>){
  const hook=this.object(rope.hook);if(!hook)rope.hook=undefined;
  return hook;
 }
 /** CRope::CreateHookObjectForRope: a decoration object of the hook's model at the last node, not static and attached
  * (so it never settles), with nothing on it. */
 private createHook(rope:Rope<RopeRef>){
  const model=ropeHookModel(rope.type);if(!model)return;
  let hook:ScmObject;
  try{hook=this.objects.create(model,{...rope.segments[31]},{external:false,missionCleanup:false});}catch{return;}
  hook.objectType=OBJECT_TYPE_DECORATION;hook.isStatic=false;hook.attachedToEntity=true;
  rope.hook={kind:'object',handle:hook.handle};rope.carried=undefined;rope.pickupDelay=0;
 }
 private top(o:ScmObject){return this.host.objectBounds?.(o.model)?.max.z??0;}
 private matrixOf(o:ScmObject):RopeMatrix{const m=this.objects.matrix(o.handle);return {right:m.right,forward:m.forward,up:m.up};}
 /** CRope::Update (iOS 0x10025d76c) for one rope. */
 private update(rope:Rope<RopeRef>,ts:number,nowMs:number,controls:RopeControls){
  const top=rope.segments[0],camera=this.host.cameraPosition?.();
  if(camera&&Math.hypot(camera.x-top.x,camera.y-top.y)>=ROPE_UPDATE_RANGE)return;
  const hook=this.hookObject(rope);let carried=this.object(rope.carried);
  if(rope.carried&&!carried)rope.carried=undefined;
  const loadHoldsRope=!!carried&&typeof carried.model==='string'&&CONTAINERS.has(carried.model.toUpperCase());
  stepRopeNodes(rope,ts,nowMs,this.frame,{below:p=>this.host.groundBelow?.(p)??rope.groundZ,hookZ:hook?.position.z,loadHoldsRope});
  if(rope.type>=ROPE_CRANE_MAGNET1&&rope.type<=ROPE_CRANE_TROLLEY){
   if(windRope(rope,ts,{playerControlsCrane:controls.playerControlsCrane,enable:this.enable,raise:controls.raise,lower:controls.lower}))
    this.host.winchSound?.(rope.holder);
   const end=carried??hook;
   if(!carried&&hook)hook.usesCollision=true;
   if(end){
    const out=updateWeightInRope(rope,end.position,ts);
    if(out){
     end.position=out;
     // The top of a crane stands still; a helicopter's winch would move with the helicopter at that point.
     const holder=rope.type>=ROPE_CRANE_MAGNO?undefined:this.object(rope.holder),topSpeed=holder?{...holder.velocity}:{x:0,y:0,z:0};
     const d={x:out.x-top.x,y:out.y-top.y,z:out.z-top.z},l=Math.hypot(d.x,d.y,d.z)||1,n={x:d.x/l,y:d.y/l,z:d.z/l};
     const speeds=tautRopeSpeeds(end.velocity,topSpeed,n,ropeLoadFactor(carried?{mass:carried.mass,model:String(carried.model).toUpperCase()}:undefined));
     end.velocity=speeds.body;
     if(holder&&!holder.isStatic)holder.velocity={x:holder.velocity.x+speeds.holder.x,y:holder.velocity.y+speeds.holder.y,z:holder.velocity.z+speeds.holder.z};
     const upward={x:-n.x,y:-n.y,z:-n.z},m=this.matrixOf(end);
     end.matrix=carried?blendLoadMatrix(m,upward):forceUpVector(m,upward);
     end.heading=Math.atan2(-end.matrix.forward.x,end.matrix.forward.y);
    }
    // The hook rides on its load: its matrix and speed, at the top of the load's bounds.
    if(carried&&hook){
     const m=this.matrixOf(carried);
     hook.matrix={right:{...m.right},forward:{...m.forward},up:{...m.up}};hook.heading=carried.heading;
     hook.velocity={...carried.velocity};hook.position=pointAbove(carried.position,m,this.top(carried));
    }
   }
  }
  if(!rope.registered&&rope.segments[0].z<ROPE_REMOVE_BELOW_Z)this.remove(rope);
  rope.registered=false;
 }
 /** CRope::ReleasePickedUpObject: the load is let go (no longer attached or carried), the hook takes collision back, and
  * nothing is picked up for 60 frames. */
 release(rope:Rope<RopeRef>){
  const carried=this.object(rope.carried);
  if(carried){carried.attachedToEntity=false;carried.carriedByRope=false;}
  rope.carried=undefined;
  const hook=this.hookObject(rope);if(hook)hook.usesCollision=true;
  rope.pickupDelay=60;
 }
 /** CRope::Remove: the slot freed, the load let go and the hook deleted. */
 private remove(rope:Rope<RopeRef>){
  rope.type=0;
  if(rope.carried)this.release(rope);
  const hook=this.hookObject(rope);if(hook)this.objects.remove(hook.handle);
  rope.hook=undefined;
 }
 /** CRopes::IsCarriedByRope. */
 isCarried(ref:RopeRef){return this.ropes.some(r=>r?.type&&r.carried?.kind===ref.kind&&r.carried.handle===ref.handle);}
}
