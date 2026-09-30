import type RAPIER from '@dimforge/rapier3d-compat';
/* Removed Rapier bodies and colliders answer as tombstones.
 *
 * A RigidBody or Collider object outlives its removal from the world: the game keeps references to it (a police unit's
 * car, a driven car, a ped) and a call through one after the removal makes Rapier's WASM trap. That trap leaves the
 * world mid-borrow, and from then on every physics call in every frame throws "recursive use of an object", so one
 * stale reference anywhere froze the whole game for good (seen in a mission sweep: a disposed police car read by
 * WorldPolice.presence).
 *
 * World.removeRigidBody and World.removeCollider are wrapped so that, once removed, the object's own methods shadow
 * the prototype's: poses read as they last were, speeds as zero, questions as no, and setters do nothing. The first
 * use from each call site is reported (a warning with the stack), so the stale reference is still found and fixed; it
 * just no longer takes the game down. */
type Vec={x:number;y:number;z:number};type Quat=Vec&{w:number};
const ZERO:Vec={x:0,y:0,z:0};
const reported=new Set<string>();
/** Where stale uses are reported; tests replace it. */
export const tombstoneLog={warn:(message:string)=>console.warn(message),count:0};
function report(kind:string,method:string){
 tombstoneLog.count++;
 const stack=new Error().stack?.split('\n').slice(3,6).join(' | ')??'';
 const key=`${kind}.${method} ${stack}`;if(reported.has(key))return;reported.add(key);
 tombstoneLog.warn(`Removed Rapier ${kind} used (${method}): ${stack}`);
}
/** The answer a removed object's method gives, by the method's name. */
function answerFor(name:string,pose:{translation:Vec;rotation:Quat}):unknown{
 if(name==='translation'||name==='nextTranslation'||name==='worldCom'||name==='translationWrtParent')return {...pose.translation};
 if(name==='rotation'||name==='nextRotation'||name==='rotationWrtParent')return {...pose.rotation};
 if(name==='linvel'||name==='angvel'||name==='velocityAtPoint'||name==='userForce'||name==='userTorque'||name==='localCom'||name==='halfExtents')return {...ZERO};
 if(/^(is|contains|intersects)/.test(name))return false;
 if(/^(set|add|apply|reset|lock|enable|restrict|sleep|wakeUp|recompute|clear|propagate|finalize|ensure)/.test(name))return undefined;
 if(/^(mass|invMass|effectiveInvMass|gravityScale|linearDamping|angularDamping|numColliders|friction|restitution|density|volume|radius|halfHeight|roundRadius|contactSkin|softCcdPrediction|dominanceGroup|additionalSolverIterations|collisionGroups|solverGroups|activeHooks|activeEvents|activeCollisionTypes|contactForceEventThreshold|frictionCombineRule|restitutionCombineRule|heightfieldNRows|heightfieldNCols)$/.test(name))return 0;
 return null;
}
function entomb(object:object,kind:string,prototype:object,pose:{translation:Vec;rotation:Quat},keep:Record<string,unknown>){
 for(const name of Object.getOwnPropertyNames(prototype)){
  if(name==='constructor'||name in keep)continue;
  const descriptor=Object.getOwnPropertyDescriptor(prototype,name);if(!descriptor||typeof descriptor.value!=='function')continue;
  const answer=answerFor(name,pose);
  Object.defineProperty(object,name,{configurable:true,writable:true,value:()=>{report(kind,name);return answer&&typeof answer==='object'?{...answer as object}:answer;}});
 }
 for(const [name,value] of Object.entries(keep))Object.defineProperty(object,name,{configurable:true,writable:true,value});
 Object.defineProperty(object,'removed',{configurable:true,value:true});
}
/** The pose to keep, read while the object is still in the world. */
const poseOf=(object:{translation():Vec;rotation():Quat})=>{try{return {translation:{...object.translation()},rotation:{...object.rotation()}};}catch{return {translation:{...ZERO},rotation:{x:0,y:0,z:0,w:1}};}};
let installed=false;
/** Wraps World.removeRigidBody and World.removeCollider (once per page). */
export function installRapierTombstones(rapier:typeof RAPIER){
 if(installed)return;installed=true;
 const world=rapier.World.prototype as unknown as {removeRigidBody(body:RAPIER.RigidBody):void;removeCollider(collider:RAPIER.Collider,wakeUp:boolean):void};
 const removeBody=world.removeRigidBody,removeCollider=world.removeCollider;
 const entombCollider=(collider:RAPIER.Collider,pose=poseOf(collider))=>{
  let shape:unknown;try{shape=collider.shape;}catch{/* gone already */}
  entomb(collider,'collider',rapier.Collider.prototype,pose,{isValid:()=>false,parent:()=>null,handle:collider.handle,...(shape?{shape}:{})});
 };
 world.removeRigidBody=function(this:unknown,body:RAPIER.RigidBody){
  if((body as {removed?:boolean}).removed)return;
  const pose=poseOf(body);let bodyType:unknown=0;try{bodyType=body.bodyType();}catch{/* gone already */}
  const colliders:{collider:RAPIER.Collider;pose:ReturnType<typeof poseOf>}[]=[];
  try{for(let i=0;i<body.numColliders();i++){const c=body.collider(i);colliders.push({collider:c,pose:poseOf(c)});}}catch{/* none readable */}
  removeBody.call(this,body);
  entomb(body,'body',rapier.RigidBody.prototype,pose,{isValid:()=>false,bodyType:()=>bodyType,handle:body.handle});
  for(const {collider,pose} of colliders)if(!(collider as {removed?:boolean}).removed)entombCollider(collider,pose);
 };
 world.removeCollider=function(this:unknown,collider:RAPIER.Collider,wakeUp:boolean){
  if((collider as {removed?:boolean}).removed)return;
  const pose=poseOf(collider);removeCollider.call(this,collider,wakeUp);entombCollider(collider,pose);
 };
}
