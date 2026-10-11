import type {Vec3} from '../core/math';
import type {ScmObject,ScmObjects} from '../engine/ScmObjects';
import {CRANE_ARM_MODELS,MAX_ROPES,ROPE_CRANE_MAGNET1,ROPE_CRANE_MAGNO,ROPE_CRANE_TROLLEY,ROPE_MAGNET,ROPE_PICKUP_DELAY,ROPE_PICKUP_RANGE,
 ROPE_REMOVE_BELOW_Z,ROPE_UPDATE_RANGE,blendLoadMatrix,craneArmRope,findRopePickup,forceUpVector,heightAfterPickup,pointAbove,
 registerRope,ropeControlsApply,ropeHookModel,ropeLoadFactor,ropePicksUpObject,stepRopeNodes,tautRopeSpeeds,turnContainer,
 updateWeightInRope,windRope,type Rope,type RopeCandidate,type RopeMatrix} from './nativeRope';
/* CRopes for the script's world: the ropes the cranes' arms hang (CObject::ProcessControlLogic registering one for each
 * crane arm every frame), their hooks, and CRopes::Update over them. A hook is a script object of its own
 * (CRope::CreateHookObjectForRope's CObject): the object host makes it a body that falls, and the rope holds it at the
 * end of its reach. What it carries is a script object or a vehicle, which the host moves. The pieces of CRope are in
 * nativeRope.ts. */
export type RopeRef={kind:'object'|'vehicle'|'ped';handle:number};
/** eObjectType's OBJECT_TYPE_DECORATION, the hook's type. */
const OBJECT_TYPE_DECORATION=5;
/** The four containers that keep the rope's ground over them (MI_OBJECTFORMAGNOCRANE1-3 and 5; not the barrel). */
const CONTAINERS=new Set(['KMB_CONTAINER_RED','KMB_CONTAINER_YEL','KMB_CONTAINER_BLUE','KMB_CONTAINER_OPEN']);
/** A body on a rope as CRope::Update reads and moves it, native: its place, speed (units a 50th of a second), rows, mass,
 * model and the top of its collision bounds (in its own axes). */
export interface RopeBody {
 position:Vec3;velocity:Vec3;matrix:RopeMatrix;mass:number;model:number|string;top:number;
 setPosition(p:Vec3):void;setVelocity(v:Vec3):void;setMatrix(m:RopeMatrix):void;
 /** CPhysical::GetSpeed: the speed of a point (an offset from its place), turn included. */
 pointSpeed?(offset:Vec3):Vec3;
}
/** A vehicle as the rope reads it: its body, and what lets a load go (bRenderScorched: blown up; a bike someone rides). */
export interface RopeVehicle extends RopeBody {scorched:boolean;riddenBike:boolean}
export interface ScmRopesHost {
 /** The camera's place, native. */
 cameraPosition?():Vec3|undefined;
 /** CWorld::FindGroundZFor3DCoord under a native point. */
 groundBelow?(p:Vec3):number|undefined;
 /** The model's collision bounds, native, once read. */
 objectBounds?(model:number|string):{max:{z:number}}|null|undefined;
 /** The winch's mission audio event (104) on the rope's holder. */
 winchSound?(holder:RopeRef|undefined):void;
 /** The vehicles within a radius of a point as the pickup scan reads them (the pool's last first); `entity` is the
  * host's own. */
 vehicleCandidates?(point:Vec3,radius:number):RopeCandidate<unknown>[];
 /** The script's handle for a vehicle the hook takes (made a mission vehicle's handle if it had none). */
 vehicleHandle?(entity:unknown,model:number|string):number|undefined;
 /** A vehicle on a rope by its handle; nothing once it has gone. */
 vehicle?(handle:number):RopeVehicle|undefined;
 /** The vehicle is taken (STATUS_SIMPLE becomes STATUS_PHYSICS) or let go. */
 vehicleCarried?(handle:number,carried:boolean):void;
}
/** The crane controls a frame: which crane the player works (CRopes::PlayerControlsCrane) and the pad's raise (Square),
 * lower (Cross) and release (Circle) buttons, 0 to 255, and the winch's stick (VEHICLE_TURRETUP and DOWN, -128 to 128). */
export interface RopeControls {playerControlsCrane:number;raise:number;lower:number;release:number;winch?:number}
/** The ids of the helicopters' winch ropes: the vehicle's handle past this (the original's id is an address in the
 * vehicle, which no object's handle can be). */
const WINCH_ROPE_ID=0x40000000;
/** CVehicle::UpdateWinch's rope top under the helicopter: the RC magnet's 0.2 under its origin, the others' 0.6. */
const WINCH_DROP_RC=-.2,WINCH_DROP=-.6;
export class ScmRopes {
 /** CRopes::aRopes. */
 readonly ropes:(Rope<RopeRef>|undefined)[]=Array.from({length:MAX_ROPES},()=>undefined);
 /** ENABLE_CRANE_CONTROLS' three flags (iOS 0x10079d214-216): raising, lowering and letting go allowed. CTheScripts::Init
  * sets all three. */
 enable:[boolean,boolean,boolean]=[true,true,true];
 /** CTimer::m_FrameCounter, for the rope's every-8th-frame ground search. */
 private frame=0;
 /** The release button as it was last frame: the hook lets go when it is first pressed. */
 private releaseHeld=false;
 /** CVehicle's m_ropeType (2 bits at +0x61a on iOS) for the helicopters ATTACH_WINCH_TO_HELI gave a winch, by handle. */
 readonly winches=new Map<number,number>();
 /** ATTACH_WINCH_TO_HELI (iOS 0x1001f8a70, CVehicle::InitWinch 0x100481c94): the winch's rope type, none for 0. */
 attachWinch(handle:number,type:number){if(type&3)this.winches.set(handle,type&3);else this.winches.delete(handle);}
 /** The rope a helicopter's winch hangs, once it has one. */
 winchRope(handle:number){return this.find(WINCH_ROPE_ID+handle);}
 constructor(private readonly objects:ScmObjects,private readonly host:ScmRopesHost){}
 /** CRopes::FindRope by its id (the holder's handle stands for the original's pointer). */
 find(id:number){return this.ropes.find(r=>r&&r.type&&r.id===id);}
 /** A frame: each crane arm registers its rope (CObject::ProcessControlLogic), then CRopes::Update. */
 step(seconds:number,nowMs:number,controls:RopeControls){
  if(!(seconds>0))return;
  const ts=seconds*50;this.frame=(this.frame+1)>>>0;
  const releasePressed=controls.release>0&&!this.releaseHeld;this.releaseHeld=controls.release>0;
  for(const o of this.objects.values()){
   if(typeof o.model!=='string')continue;
   const model=o.model.toUpperCase();
   if(model!==CRANE_ARM_MODELS.magno&&model!==CRANE_ARM_MODELS.trolley&&model!==CRANE_ARM_MODELS.quarry)continue;
   const rope=this.find(o.handle),arm=craneArmRope(model,o.position,this.objects.matrix(o.handle),rope);
   if(!arm)continue;
   const registered=registerRope<RopeRef>(this.ropes,o.handle,arm.type,arm.top,false,arm.wound,true,{kind:'object',handle:o.handle},false,20000,nowMs);
   if(registered&&!this.hookObject(registered))this.createHook(registered);
  }
  // CHeli::ProcessControl's CVehicle::UpdateWinch (iOS 0x100481ca4): the winch's rope under the helicopter, the top
  // lowered by the wound remainder as the crane arms' is.
  for(const [handle,type] of this.winches){
   const body=this.host.vehicle?.(handle);if(!body){this.winches.delete(handle);continue;}
   const id=WINCH_ROPE_ID+handle,rope=this.find(id),wound=rope?Math.trunc(rope.height*32)&0xff:0;
   const drop=(type===ROPE_MAGNET?WINCH_DROP_RC:WINCH_DROP)+(rope?rope.length*rope.height-wound*rope.spacing:0);
   const registered=registerRope<RopeRef>(this.ropes,id,type,pointAbove(body.position,body.matrix,drop),false,wound,true,{kind:'vehicle',handle},true,20000,nowMs);
   if(registered&&!this.hookObject(registered))this.createHook(registered);
  }
  for(const rope of this.ropes)if(rope?.type)this.update(rope,ts,nowMs,controls,releasePressed);
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
 /** A script object as a body on the rope. */
 private objectBody(o:ScmObject):RopeBody{
  const self=this;
  return {get position(){return o.position;},get velocity(){return o.velocity;},get matrix(){return self.matrixOf(o);},mass:o.mass,model:o.model,
   get top(){return self.top(o);},
   setPosition:p=>{o.position=p;},setVelocity:v=>{o.velocity=v;},
   setMatrix:m=>{o.matrix=m;o.heading=Math.atan2(-m.forward.x,m.forward.y);}};
 }
 /** The rope's holder as a body: a helicopter, or an object that is not static. */
 private holderBody(rope:Rope<RopeRef>):RopeBody|undefined{
  const h=rope.holder;if(!h)return undefined;
  if(h.kind==='vehicle')return this.host.vehicle?.(h.handle);
  const o=this.object(h);return o&&!o.isStatic?this.objectBody(o):undefined;
 }
 /** What hangs on the rope as a body, the reference cleared once it has gone. */
 private carriedBody(rope:Rope<RopeRef>):RopeBody|RopeVehicle|undefined{
  const c=rope.carried;if(!c)return undefined;
  const body=c.kind==='object'?(()=>{const o=this.object(c);return o?this.objectBody(o):undefined;})():c.kind==='vehicle'?this.host.vehicle?.(c.handle):undefined;
  if(!body)rope.carried=undefined;
  return body;
 }
 /** CRope::Update (iOS 0x10025d76c) for one rope. */
 private update(rope:Rope<RopeRef>,ts:number,nowMs:number,controls:RopeControls,releasePressed:boolean){
  const top=rope.segments[0],camera=this.host.cameraPosition?.();
  if(camera&&Math.hypot(camera.x-top.x,camera.y-top.y)>=ROPE_UPDATE_RANGE)return;
  const hookObject=this.hookObject(rope),hook=hookObject&&this.objectBody(hookObject);let carried=this.carriedBody(rope);
  const loadHoldsRope=rope.carried?.kind==='vehicle'||!!carried&&typeof carried.model==='string'&&CONTAINERS.has(carried.model.toUpperCase());
  stepRopeNodes(rope,ts,nowMs,this.frame,{below:p=>this.host.groundBelow?.(p)??rope.groundZ,hookZ:hook?.position.z,loadHoldsRope});
  if(rope.type>=ROPE_CRANE_MAGNET1&&rope.type<=ROPE_CRANE_TROLLEY){
   if(windRope(rope,ts,{playerControlsCrane:controls.playerControlsCrane,enable:this.enable,raise:controls.raise,lower:controls.lower,stick:controls.winch}))
    this.host.winchSound?.(rope.holder);
   const end=carried??hook;
   if(!carried&&hookObject)hookObject.usesCollision=true;
   if(end){
    const out=updateWeightInRope(rope,end.position,ts);
    if(out){
     end.setPosition(out);
     // The top of a crane stands still; a helicopter's winch moves with the helicopter at that point.
     const holder=rope.type>=ROPE_CRANE_MAGNO&&rope.type<=ROPE_CRANE_TROLLEY?undefined:this.holderBody(rope);
     const topSpeed=holder?holder.pointSpeed?.({x:top.x-holder.position.x,y:top.y-holder.position.y,z:top.z-holder.position.z})??{...holder.velocity}:{x:0,y:0,z:0};
     const d={x:out.x-top.x,y:out.y-top.y,z:out.z-top.z},l=Math.hypot(d.x,d.y,d.z)||1,n={x:d.x/l,y:d.y/l,z:d.z/l};
     const speeds=tautRopeSpeeds(end.velocity,topSpeed,n,ropeLoadFactor(carried?{mass:carried.mass,model:typeof carried.model==='string'?carried.model.toUpperCase():carried.model}:undefined));
     end.setVelocity(speeds.body);
     if(holder){const v=holder.velocity;holder.setVelocity({x:v.x+speeds.holder.x,y:v.y+speeds.holder.y,z:v.z+speeds.holder.z});}
     const upward={x:-n.x,y:-n.y,z:-n.z};
     end.setMatrix(carried?blendLoadMatrix(end.matrix,upward):forceUpVector(end.matrix,upward));
    }
    // The hook rides on its load: its matrix and speed, at the top of the load's bounds.
    if(carried&&hook){
     const m=carried.matrix;
     hook.setMatrix({right:{...m.right},forward:{...m.forward},up:{...m.up}});
     hook.setVelocity({...carried.velocity});hook.setPosition(pointAbove(carried.position,m,carried.top));
    }
   }
   // The load let go (the worked crane's release button, ENABLE_CRANE_CONTROLS' third flag allowing it; a vehicle blown
   // up, or a bike someone rides), or with nothing on the hook and no wait left, the next load found.
   if(carried){
    const vehicle=rope.carried?.kind==='vehicle'?carried as RopeVehicle:undefined;
    if(releasePressed&&this.enable[2]&&ropeControlsApply(rope.type,controls.playerControlsCrane)||vehicle&&(vehicle.scorched||vehicle.riddenBike))this.release(rope);
   }else if(rope.pickupDelay>0)rope.pickupDelay--;
   else if(hookObject)this.pickUp(rope,hookObject);
  }
  if(!rope.registered&&rope.segments[0].z<ROPE_REMOVE_BELOW_Z)this.remove(rope);
  rope.registered=false;
 }
 /** The scan of CRope::Update for what the rope's crane takes near enough the hook's point to be within reach: the
  * vehicles, then the objects. */
 private candidates(rope:Rope<RopeRef>,hook:ScmObject){
  const point=rope.segments[31],out:RopeCandidate<RopeRef|{kind:'host';entity:unknown}>[]=[];
  for(const c of this.host.vehicleCandidates?.(point,ROPE_PICKUP_RANGE+5)??[])out.push({...c,entity:{kind:'host',entity:c.entity}});
  for(const o of this.objects.values()){
   if(o===hook||typeof o.model!=='string'||!ropePicksUpObject(rope.type,o.model))continue;
   const top=this.top(o);
   if(Math.hypot(o.position.x-point.x,o.position.y-point.y,o.position.z-point.z)>ROPE_PICKUP_RANGE+Math.abs(top))continue;
   out.push({entity:{kind:'object',handle:o.handle},kind:'object',model:o.model,position:o.position,matrix:this.matrixOf(o),top,
    magnetic:o.magnetic!==false,attached:!!o.attachedTo});
  }
  return out;
 }
 /** CRope::Update's pickup (iOS 0x10025eb18 for an object, 0x10025eb90 for a vehicle): the load hangs on the hook, which
  * goes to the top of its bounds without collision; a hook above the load lets out what reaches it. An object moves (no
  * longer static) and is attached, and a container taken by a side face is turned that face up; a vehicle goes from
  * STATUS_SIMPLE to STATUS_PHYSICS. */
 private pickUp(rope:Rope<RopeRef>,hookObject:ScmObject){
  const found=findRopePickup(rope.type,rope.segments[31],this.candidates(rope,hookObject));if(!found)return;
  const entity=found.candidate.entity,m=found.candidate.matrix;
  if(entity.kind==='host'){
   const handle=this.host.vehicleHandle?.(entity.entity,found.candidate.model);if(handle===undefined)return;
   rope.carried={kind:'vehicle',handle};this.host.vehicleCarried?.(handle,true);
  }else{
   const o=this.object(entity);if(!o)return;
   rope.carried={kind:'object',handle:o.handle};o.carriedByRope=true;
   if(o.isStatic)o.isStatic=false;
   o.attachedToEntity=true;
   if(found.turns){o.matrix=turnContainer(m,found.turns);o.heading=Math.atan2(-o.matrix.forward.x,o.matrix.forward.y);}
  }
  hookObject.position=pointAbove(found.candidate.position,m,found.candidate.top);hookObject.usesCollision=false;
  rope.height=heightAfterPickup(rope.height,rope.segments[31].z,found.point.z,rope.length,rope.spacing);
 }
 /** GRAB_ENTITY_ON_ROPE_FOR_OBJECT (iOS 0x1001f84cc, GetObjectCarriedWithRope 0x1002d9de4): what hangs on the rope. */
 carriedBy(id:number){return this.find(id)?.carried;}
 /** CRope::ReleasePickedUpObject: the load is let go (no longer attached or carried), the hook takes collision back, and
  * nothing is picked up for 60 frames. */
 release(rope:Rope<RopeRef>){
  const c=rope.carried,carried=this.object(c);
  if(carried){carried.attachedToEntity=false;carried.carriedByRope=false;}
  if(c?.kind==='vehicle')this.host.vehicleCarried?.(c.handle,false);
  rope.carried=undefined;
  const hook=this.hookObject(rope);if(hook)hook.usesCollision=true;
  rope.pickupDelay=ROPE_PICKUP_DELAY;
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
