import RAPIER from '@dimforge/rapier3d-compat';
import {Group,Matrix4,Quaternion,Vector3,type Scene} from 'three';
import {installNativeCollisionMatrix} from './nativeCollision';
import {rotationFromNativeRows} from './recordingBody';
import {nativePoolBallStep,type PoolPoint,type PoolTable} from './nativePoolBall';
import {nativePoolContactFriction,nativePoolGroundFriction,type PoolFrictionState} from './nativePoolFriction';
import {POOL_BALL_ROLLING_SOLVER_GROUPS,POOL_BALL_FALLING_SOLVER_GROUPS,SCRIPT_OBJECT_SOLVER_GROUPS,SCRIPT_OBJECT_MESH_SOLVER_GROUPS} from './solverGroups';
import {objectIntersectsWorld,objectQueryGeometry,type ObjectQueryGeometry} from './nativeObjectIntersection';
import {colChunkNames,readCol,type ColModel} from '../assets/col';
import {readImgEntry,type ImgEntry} from '../assets/img';
import {orderedConcurrent} from '../assets/orderedConcurrent';
/** Native Z-up model space into the renderer's axes: the colliders are baked in the model's own frame, and the body
 * then carries the object's turn and position. */
const NATIVE_AXES=new Matrix4().makeRotationX(-Math.PI/2),FROM_RENDERER=new Matrix4().makeRotationX(Math.PI/2);
const POSE=new Quaternion();
/* Turning a record into a transform needs no new objects: the same few are reused every time, because this
 * runs once per script object per frame and the script's objects mostly stand still. */
const TURN=new Quaternion(),TILT=new Quaternion(),UP=new Vector3(0,1,0),EAST=new Vector3(1,0,0),NORTH=new Vector3(0,0,1);
/** Position, heading, the three rotation angles and the scale. */
const TRANSFORM_FIELDS=8;
import {nativeAmbientState} from '../assets/nativeMaterial';
import {setNativeScorched} from '../assets/nativeScorched';
import {placementFade} from '../render/placementFade';
import {openStaticWorld} from '../assets/staticWorldArchive';
import {ModelReadCache,readModel} from '../assets/readModel';
import {modelObject} from '../assets/ModelObjects';
import type {IdeAssociation} from '../assets/ide';
import type {ScenePart} from '../assets/scene';
import type {ScmObject} from '../engine/ScmObjects';
import type {NativeAnimation} from '../assets/ifp';
import {animationTime,sampleTrack,type TrackPose} from '../animation/sample';
/** How long a failed script-object read is remembered before it is tried again. */
const SCRIPT_OBJECT_RETRY_MS=2000;
/* The objects a script makes, drawn where the runtime says they are.
 *
 * ScmObjects already holds everything CObject carries for the script — position, heading, the full rotation,
 * the scale, whether it uses collision — and says in as many words that a host mirrors each record into the
 * world it draws. This is that host. It owns no state of its own beyond the models it has loaded and the group
 * each object is drawn in: every frame it is handed the runtime's own records and puts each one where it says.
 *
 * A model the archive does not carry draws nothing, as CStreaming renders nothing for a model it cannot load,
 * and the object still exists for every question the script asks about it. */
const UNIT=new Vector3(1,1,1);
/** An object clump's frames under a clip, as FrameUpdateCallBackNonSkinned poses them: each frame's matrix is
 * rebuilt from the key's rotation and, when the track has one, its translation (else the frame's own position),
 * with no scale. Tracks are matched to frames by name; one naming no frame is left out. Nothing when none match. */
function bindObjectAnimation(root:import('three').Object3D,clip:NativeAnimation){
 const frames=new Map<string,import('three').Object3D>();
 root.traverse(o=>{if(Number.isInteger(o.userData.nativeFrame)){const k=o.name.trim().toLowerCase();if(!frames.has(k))frames.set(k,o);}});
 const bindings=clip.tracks.flatMap(track=>{
  const target=track.times.length?frames.get(track.name.trim().toLowerCase()):undefined;if(!target)return [];
  const rest=target.matrix.clone(),pose:TrackPose={rotation:new Quaternion(),translation:null};
  return [{track,target,rest,position:new Vector3().setFromMatrixPosition(rest),pose}];
 });
 if(!bindings.length)return undefined;
 return {
  sample(seconds:number){
   const time=animationTime(clip,seconds,false);
   for(const b of bindings){sampleTrack(b.track,time,b.pose);b.target.matrix.compose(b.pose.translation??b.position,b.pose.rotation,UNIT);b.target.matrixWorldNeedsUpdate=true;}
   root.updateMatrixWorld(true);
  },
  restore(){for(const b of bindings){b.target.matrix.copy(b.rest);b.target.matrixWorldNeedsUpdate=true;}root.updateMatrixWorld(true);},
 };
}
export class ScriptObjectViews{
 private readonly views=new Map<number,{group:Group;dispose:()=>void;model:number|string;applied:Float64Array;shown:boolean;
  physical?:ReturnType<typeof installNativeCollisionMatrix>;collisionOn:boolean;col?:ColModel;poolGravity?:boolean;poolPending?:{move:PoolPoint;turn:PoolPoint};
  asset:{model:import('../assets/dff').DffModel;textures:import('../assets/modelTextures').ModelTexture[]};root:import('three').Object3D;
  /** The object's own materials, and the fade alpha last put on them. */
  materials:import('three').Material[];alpha?:number;
  renderPolicy?:ReturnType<typeof placementFade>;policyArea?:number;
  anim?:{name:string;binding?:ReturnType<typeof bindObjectAnimation>;time:number};
  /** While the object is a moving CPhysical: what was last written into its record from the body (to tell the
   * script's own writes apart) and CObject::ProcessControl's settling state. */
  /** CEntity::m_bIsStaticWaitingForCollision: the moving body is held, the world's collision not in where it is. */
  waiting?:boolean;
  dyn?:{pos:{x:number;y:number;z:number};vel:{x:number;y:number;z:number};turn:{x:number;y:number;z:number};heading:number;rot:{x:number;y:number;z:number};
   force:{x:number;y:number;z:number};torque:{x:number;y:number;z:number};still:number;clock:number;isStatic:boolean;staticRevision?:number;
   /** The matrix this host last wrote into the record: another one there was set by the runtime (a rope). */
   matrix?:ScmObject['matrix']}}>();
 /** OBJECT.DAT's turn mass, elasticity and air resistance (as damping) for a model; the mass is the record's. */
 /** CObject::ProcessControl reports nonzero closing displacement for moving lock doors. Native axes. */
 onDoorMovement?:(position:{x:number;y:number;z:number})=>void;
 poolTable?:()=>PoolTable|undefined;
 onPoolCushion?:(position:PoolPoint)=>void;
 private readonly poolSteps=new Map<ScmObject,{position:PoolPoint;seconds:number}>();
 /** Snapshot each pool ball immediately before Rapier contacts. Scripts may have written a shot since rendering. */
 beforePhysics(objects:readonly ScmObject[],seconds:number){
  this.poolSteps.clear();if(this.disposed||seconds<=0)return;
  for(const object of objects){
   if(!object.poolBall)continue;
   const view=this.views.get(object.handle);if(!view?.physical)continue;
   this.poolCollision(view,object.poolBall.applyGravity);
   if(view.collisionOn!==ScriptObjectViews.collides(object)){const sleeping=view.physical.body.isSleeping();view.collisionOn=ScriptObjectViews.collides(object);for(let i=0;i<view.physical.body.numColliders();i++)view.physical.body.collider(i).setEnabled(view.collisionOn);if(sleeping)view.physical.body.sleep();}
   const moving=ScriptObjectViews.moves(object);
   if(!moving){if(view.dyn)this.stopMoving(object,view);continue;}
   if(!view.dyn)this.startMoving(object,view);
   const waiting=!!this.collisionLoaded&&!this.collisionLoaded(object.position.x,-object.position.y);
   if(waiting!==!!view.waiting){view.waiting=waiting;view.physical.body.setEnabled(!waiting);}
   if(waiting)continue;
   this.syncMoving(object,view,0);
   const body=view.physical.body,p=body.translation();
   body.setGravityScale(object.poolBall.applyGravity?1:0,false);
   body.setEnabledTranslations(true,object.poolBall.applyGravity||object.velocity.z!==0,true,false);
   if(!body.isSleeping()&&!object.isStatic){
    const info=this.physicsOf?.(object.model),mass=Math.min(object.mass,99999),turn=object.turnMass??info?.turnMass??mass;
    const s=nativePoolGroundFriction(this.poolFrictionState(view),{x:p.x,y:-p.z,z:p.y},view.col?.bounds.radius??0,seconds*50,mass,turn);
    body.setLinvel({x:s.velocity.x*50,y:s.velocity.z*50,z:-s.velocity.y*50},false);body.setAngvel({x:s.turn.x*50,y:s.turn.z*50,z:-s.turn.y*50},false);view.poolPending=undefined;
   }
   this.poolSteps.set(object,{position:{x:p.x,y:-p.z,z:p.y},seconds});
  }
 }
 /** Native boundary decisions over the displacement Rapier actually integrated, preserving its ball contacts.
  * This is an authored post-contact correction; native physics splits the step before processing contacts. */
 afterPhysics(){
  const table=this.poolTable?.();
  for(const [object,step] of this.poolSteps){
   const view=this.views.get(object.handle),pool=object.poolBall;if(!view?.dyn||!view.physical||!pool)continue;
   const body=view.physical.body,p=body.translation(),dt=step.seconds*50;
   if(table&&!body.isSleeping()){
    const travel={x:(p.x-step.position.x)/dt,y:(-p.z-step.position.y)/dt,z:(p.y-step.position.z)/dt};
    const result=nativePoolBallStep(step.position,travel,pool.applyGravity,table,dt,view.col?.bounds.radius??0);
    if(result.impact){
     body.setTranslation({x:result.position.x,y:result.position.z,z:-result.position.y},true);
     const v=body.linvel(),axis=result.impact.axis;
     if(result.applyGravity){const limit=.03/step.seconds;if(axis==='x')v.x=Math.max(-limit,Math.min(limit,v.x));else v.z=Math.max(-limit,Math.min(limit,v.z));}
     else if(axis==='x'){if(v.x*result.impact.normal.x<0)v.x=-v.x;}else if(-v.z*result.impact.normal.y<0)v.z=-v.z;
     body.setLinvel(v,true);object.lastWeaponDamage=object.lastWeaponDamage===-1?54:50;
     const info=this.physicsOf?.(object.model),mass=Math.min(object.mass,99999),turn=object.turnMass??info?.turnMass??mass,hit=result.impact;
     const friction=nativePoolContactFriction(this.poolFrictionState(view),{x:Math.fround(hit.position.x-hit.center.x),y:Math.fround(hit.position.y-hit.center.y),z:Math.fround(hit.position.z-hit.center.z)},hit.normal,hit.friction,mass,turn);
     view.poolPending={move:friction.frictionMove,turn:friction.frictionTurn};
     this.onPoolCushion?.(result.impact.position);
    }else if(result.stopped){
     body.setTranslation({x:result.position.x,y:result.position.z,z:-result.position.y},false);
     body.setLinvel({x:0,y:0,z:0},false);body.setAngvel({x:0,y:0,z:0},false);body.sleep();
    }
    if(pool.applyGravity!==result.applyGravity){pool.applyGravity=result.applyGravity;this.poolCollision(view,pool.applyGravity);body.setGravityScale(pool.applyGravity?1:0,true);body.setEnabledTranslations(true,true,true,true);}
   }
   this.syncMoving(object,view,0);
  }
  this.poolSteps.clear();
 }
 private poolFrictionState(view:NonNullable<ReturnType<ScriptObjectViews['views']['get']>>):PoolFrictionState{
  const v=view.physical!.body.linvel(),w=view.physical!.body.angvel();return{velocity:{x:v.x/50,y:-v.z/50,z:v.y/50},turn:{x:w.x/50,y:-w.z/50,z:w.y/50},frictionMove:view.poolPending?.move??{x:0,y:0,z:0},frictionTurn:view.poolPending?.turn??{x:0,y:0,z:0}};
 }
 private poolCollision(view:NonNullable<ReturnType<ScriptObjectViews['views']['get']>>,applyGravity:boolean){
  if(!view.physical||view.poolGravity===applyGravity)return;
  const body=view.physical.body,sleeping=body.isSleeping();view.poolGravity=applyGravity;
  for(let i=0;i<body.numColliders();i++)body.collider(i).setSolverGroups(applyGravity?POOL_BALL_FALLING_SOLVER_GROUPS:POOL_BALL_ROLLING_SOLVER_GROUPS);
  if(sleeping)body.sleep();
 }
 physicsOf?:(model:number|string)=>{turnMass?:number;elasticity:number;damping:number}|undefined;
 /** A clip from a script's animation block, which PLAY_OBJECT_ANIM names. */
 animation?:(block:string,name:string)=>Promise<NativeAnimation|undefined>;
 /** Which script object each of the colliders belongs to. */
 private readonly owners=new Map<number,number>();
 /** Which archive COL collection holds each model, and where in it: CColStore's files, read by their chunk headers. */
 private collisionIndex?:Promise<Map<string,{entry:ImgEntry;start:number;end:number}>>;
 private readonly collisions=new Map<string,Promise<ColModel|undefined>>();
 private readonly intersectionModels=new Map<string,ObjectQueryGeometry|null|undefined>();
 private readonly models=new Map<string,Promise<{model:import('../assets/dff').DffModel;textures:import('../assets/modelTextures').ModelTexture[]}|undefined>>();
 private readonly loading=new Set<number>();
 private readonly byId=new Map<number,IdeAssociation>();
 private readonly byName=new Map<string,IdeAssociation>();
 private source?:ReturnType<typeof openStaticWorld>;
 private cache?:ModelReadCache;
 private disposed=false;
 private readonly ambient=nativeAmbientState();
 error?:string;
 /** `world` gives each object its model's collision (CObject is a CPhysical the world collides with): a kinematic
  * body the record moves, whose colliders are on while the object uses collision. */
 constructor(private readonly scene:Scene,private readonly base:string,associations:readonly IdeAssociation[],private readonly world?:RAPIER.World){
  for(const record of associations){
   if(!this.byId.has(record.id))this.byId.set(record.id,record);
   const name=record.model.toLowerCase();
   if(!this.byName.has(name))this.byName.set(name,record);
  }
 }
 get drawn(){return this.views.size;}
 /** The script object a collider belongs to, for a shot or blast that met it. */
 objectForCollider(collider:number){return this.owners.get(collider);}
 /** Minus the lowest z of the object's COL bounding box, once its collision is in. */
 baseOffset(handle:number){const b=this.views.get(handle)?.col?.bounds;return b?-b.min[2]:undefined;}
 /** The COL bounding sphere's radius, once the collision is in. */
 boundsRadius(handle:number){return this.views.get(handle)?.col?.bounds.radius;}
 private readonly boxes=new Map<string,{min:{x:number;y:number;z:number};max:{x:number;y:number;z:number}}|null>();
 /** GET_MODEL_DIMENSIONS for an object model: its COL bounding box. Undefined while the collision is being read,
  * null for a model the IDEs do not name or that has no collision. */
 modelBounds(model:number|string){
  const record=this.association(model);if(!record)return null;
  const key=record.model.toLowerCase(),known=this.boxes.get(key);
  if(known!==undefined)return known;
  if(!this.collisions.has(key))void this.collision(record.model).catch(()=>{});
  return undefined;
 }
 /** An object's body, once its collision is in. */
 bodyOf(handle:number){return this.views.get(handle)?.physical?.body;}
 /** CPhysical::TestCollision(false): the script's current matrix, including a held or collision-disabled object.
  * undefined asks the script to wait for its COL; the query itself never moves a body or changes collision flags. */
 intersectsWorld(object:ScmObject,ignore:(candidate:RAPIER.Collider)=>boolean=()=>false):boolean|undefined{
  if(!this.world)return false;
  const record=this.association(object.model);if(!record)return false;
  const key=record.model.toLowerCase();
  if(!this.intersectionModels.has(key)){
   const col=this.views.get(object.handle)?.col;
   if(col)this.intersectionModels.set(key,objectQueryGeometry(col));
   else{
    this.intersectionModels.set(key,undefined);
    void this.collision(record.model).then(col=>{if(!this.disposed)this.intersectionModels.set(key,col?objectQueryGeometry(col):null);},()=>{this.intersectionModels.delete(key);});
   }
  }
  const geometry=this.intersectionModels.get(key);if(geometry===undefined)return undefined;if(geometry===null)return false;
  const own=this.bodyOf(object.handle)?.handle,q=ScriptObjectViews.orientation(object,new Quaternion()),p=object.position;
  return objectIntersectsWorld(this.world,geometry,{x:p.x,y:p.z,z:-p.y},q,c=>own!==undefined&&c.parent()?.handle===own||ignore(c));
 }
 /** The model's COL: its chunk alone, decoded from the collection the index names (the first holding the name). */
 private collision(name:string){
  const key=name.toLowerCase();let found=this.collisions.get(key);
  if(!found){
   found=(async()=>{
    if(!this.collisionIndex){const indexing=(async()=>{
     const source=await this.openSource(),index=new Map<string,{entry:ImgEntry;start:number;end:number}>();
     // The archive holds 216 COL files. Read one after another, each read waits on the event loop behind a
     // frame, so every script object waited some 216 frames for its collision (over a minute on a slow
     // machine); read 16 at a time, taken in archive order so the first file holding a name still wins.
     const files=source.entries.filter(entry=>/\.col$/i.test(entry.name));
     const chunks=orderedConcurrent(files,async entry=>({entry,names:colChunkNames(await readImgEntry(source.file,entry))}),16);
     for await(const {entry,names} of chunks)for(const chunk of names){const k=chunk.name.toLowerCase();if(!index.has(k))index.set(k,{entry,start:chunk.start,end:chunk.end});}
     return index;
    })();this.collisionIndex=indexing;indexing.catch(()=>{if(this.collisionIndex===indexing)this.collisionIndex=undefined;});}
    const at=(await this.collisionIndex).get(key);if(!at)return undefined;
    const source=await this.openSource(),bytes=await readImgEntry(source.file,at.entry);
    return readCol(bytes.subarray(at.start,at.end))[0];
   })();
   this.collisions.set(key,found);this.forgetOnFailure(this.collisions,key,found);
   // Every collision consumer publishes its bounds, including loads begun by rendering or building swaps.
   // A rejected read remains pending until the existing retry eviction; only a successful absence becomes null.
   void found.then(col=>{const b=col?.bounds;this.boxes.set(key,b?{min:{x:b.min[0],y:b.min[1],z:b.min[2]},max:{x:b.max[0],y:b.max[1],z:b.max[2]}}:null);},()=>{});
  }
  return found;
 }
 /** What BreakObject_c::Init reads off an object: its model (whose first atomic carries the breakable plugin) and
  * textures, its COL bounds and its matrix in native axes. Nothing while the model or its collision is loading. */
 breakSource(handle:number){
  const view=this.views.get(handle);if(!view?.col)return undefined;
  view.group.updateMatrix();
  const matrix=new Matrix4().copy(FROM_RENDERER).multiply(view.group.matrix).multiply(NATIVE_AXES);
  return {id:view.model,model:view.asset.model,textures:view.asset.textures,bounds:view.col.bounds,matrix:matrix.elements};
 }
 /** The group an object is drawn in, for a caller checking where it ended up. */
 groupFor(handle:number){return this.views.get(handle)?.group;}
 /** The txd an IDE gives a model of that name (a cutscene's cast member from gta3.img). */
 textureDictionary(model:string){return this.byName.get(model.toLowerCase())?.dictionary;}
 /** A replacement CBuilding uses the new model's clump and COL together, without becoming a script object. */
 async sceneModelPart(model:number|string):Promise<ScenePart|undefined>{
  const record=this.association(model);if(!record)return undefined;
  const [asset,collision]=await Promise.all([this.load(record),this.collision(record.model)]);if(!asset)return undefined;
  return {...asset,collision,collisionSource:undefined,name:record.model.toLowerCase(),definition:record,placements:[],dictionaryNames:[record.dictionary],notices:[]};
 }
 /** The dff and txd names a script's model stands for, by id or by the name the script used. */
 private association(model:number|string){
  return typeof model==='number'?this.byId.get(model):this.byName.get(model.toLowerCase());
 }
 /** The archive, opened once; a failed open is dropped so the next read tries again. */
 private openSource(){
  if(!this.source){const opening=openStaticWorld(this.base);this.source=opening;opening.catch(()=>{if(this.source===opening)this.source=undefined;});}
  return this.source;
 }
 /** A download or decode that fails (a dropped connection, a timeout) is not kept: after a short wait the cache forgets
  * it, so the object's model or collision is read again rather than missing for the rest of the session. */
 private forgetOnFailure<T>(cache:Map<string,Promise<T>>,key:string,promise:Promise<T>){
  promise.catch(error=>{
   this.error=String(error);
   setTimeout(()=>{if(cache.get(key)===promise)cache.delete(key);},SCRIPT_OBJECT_RETRY_MS);
  });
 }
 private load(record:IdeAssociation){
  const key=`${record.model}|${record.dictionary}`.toLowerCase();let promise=this.models.get(key);
  if(!promise){
   promise=(async()=>{
    const source=await this.openSource();this.cache??=new ModelReadCache(source.file,source.entries);
    const entry=source.entry(`${record.model}.dff`);
    const textureEntry=source.entry(`${record.dictionary}.txd`);
    if(!entry)return undefined;
    const read=await readModel({file:source.file,entry,textureEntry},this.cache);
    return {model:read.model,textures:read.textures};
   })();
   this.models.set(key,promise);this.forgetOnFailure(this.models,key,promise);
  }
  return promise;
 }
 /** Put the script's objects where it says they are, and take away the ones it has deleted. */
 update(objects:readonly ScmObject[],seconds=0){
  if(this.disposed)return;
  const live=new Set<number>();
  for(const object of objects){
   // An object standing for a placement of the map is drawn and collided by the map.
   if(object.worldPlacement)continue;
   live.add(object.handle);
   const view=this.views.get(object.handle);
   if(view&&view.model!==object.model){this.remove(object.handle);}
   else if(view){
    if(view.physical){
     const wanted=ScriptObjectViews.moves(object);
     if(wanted&&!view.dyn)this.startMoving(object,view);
     else if(!wanted&&view.dyn)this.stopMoving(object,view);
     if(view.dyn){
      // A moving object where the world's collision is not in yet holds still until it is (CEntity::
      // m_bIsStaticWaitingForCollision), as the script's cars and peds do, rather than fall through the unloaded ground.
      const waiting=!!this.collisionLoaded&&!this.collisionLoaded(object.position.x,-object.position.y);
      if(waiting!==!!view.waiting){view.waiting=waiting;view.physical.body.setEnabled(!waiting);}
      if(!waiting)this.syncMoving(object,view,seconds);
     }
     else if(view.waiting){view.waiting=false;view.physical.body.setEnabled(true);}
    }
    // Most of a script's objects never move again after it puts them down, so the transform is rebuilt only
    // when the record says something about it has changed.
    const shown=this.shows(object);
    if(shown!==view.shown||object.matrix||ScriptObjectViews.moved(object,view.applied)){
     this.place(view.group,object);ScriptObjectViews.record(object,view.applied);view.shown=shown;
     if(view.physical&&!view.dyn)ScriptObjectViews.pose(view.physical.body,object,false);
    }
    if(view.anim||object.anim)this.animate(object,view);
    const area=this.visibleArea?.()??0;
    if(object.drawLast!==undefined&&(!view.renderPolicy||view.policyArea!==area)){
     view.renderPolicy?.dispose();for(const material of view.materials)setNativeScorched(material,false);
     view.renderPolicy=placementFade(view.root,this.association(object.model)?.flags??0,area,true);view.policyArea=area;
    }
    if(view.renderPolicy){
     view.renderPolicy.setDrawLast(!!object.drawLast);view.renderPolicy.setScorched(!!object.renderScorched);
     if(object.fadeAlpha!==undefined)view.renderPolicy.setAlpha(object.fadeAlpha,object.fadeAlpha<255);
     const camera=this.cameraPosition?.();if(camera)view.renderPolicy.setDistance(Math.hypot(object.position.x-camera.x,object.position.z-camera.y,-object.position.y-camera.z));
    }else for(const material of view.materials)setNativeScorched(material,!!object.renderScorched);
    // REMOVE_OBJECT_ELEGANTLY's fade: the clump's alpha on its own materials (each object builds its own).
    if(!view.renderPolicy&&object.fadeAlpha!==undefined&&object.fadeAlpha!==view.alpha){
     view.alpha=object.fadeAlpha;
     for(const material of view.materials){material.transparent=true;material.opacity=object.fadeAlpha/255;}
    }
    if(view.physical&&view.collisionOn!==ScriptObjectViews.collides(object)){
     const sleeping=!!object.poolBall&&view.physical.body.isSleeping();
     view.collisionOn=ScriptObjectViews.collides(object);
     for(let i=0;i<view.physical.body.numColliders();i++)view.physical.body.collider(i).setEnabled(view.collisionOn);
     if(sleeping)view.physical.body.sleep();
    }
    continue;
   }
   this.spawn(object);
  }
  for(const handle of [...this.views.keys()])if(!live.has(handle))this.remove(handle);
 }
 private spawn(object:ScmObject){
  if(this.loading.has(object.handle))return;
  const record=this.association(object.model);if(!record)return;
  this.loading.add(object.handle);
  // A failed read leaves no view: the object is spawned again once the failure has been forgotten.
  void Promise.all([this.load(record),this.world?this.collision(record.model):undefined]).catch(()=>{this.loading.delete(object.handle);return [] as const;}).then(([asset,col])=>{
   this.loading.delete(object.handle);
   if(!asset||this.disposed||this.views.has(object.handle))return;
   const built=modelObject(asset.model,asset.textures,undefined,undefined,{worldLighting:true,ambient:this.ambient});
   for(const binding of built.materialBindings)setNativeScorched(binding.material,!!object.renderScorched);
   // A weapon model (the guns an Ammu-Nation lays on its counter) carries its muzzle-flash atomic, which only renders
   // while firing.
   for(const binding of built.materialBindings)if(binding.source.texture?.toLowerCase().startsWith('muzzle'))binding.material.visible=false;
   let physical:ReturnType<typeof installNativeCollisionMatrix>|undefined;
   if(this.world&&col&&(col.spheres.length||col.boxes.length||col.mesh.indices.length)){
    try{
     physical=installNativeCollisionMatrix(this.world,col,NATIVE_AXES);
     physical.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);
     ScriptObjectViews.pose(physical.body,object,true);
     if(!object.poolBall)for(let i=0;i<physical.body.numColliders();i++){const c=physical.body.collider(i);c.setSolverGroups(c.shapeType()===RAPIER.ShapeType.TriMesh?SCRIPT_OBJECT_MESH_SOLVER_GROUPS:SCRIPT_OBJECT_SOLVER_GROUPS);}
     for(const collider of physical.sources.keys()){this.owners.set(collider,object.handle);if(!ScriptObjectViews.collides(object))this.world.getCollider(collider)?.setEnabled(false);}
    }catch(error){physical?.dispose();physical=undefined;this.error=String(error);}
   }
   // Frustum culling stays on: a script's objects are world props standing where it put them, and most of
   // them are behind the camera at any moment, so letting three.js skip them is most of their cost.
   const group=new Group();group.add(built.root);
   this.place(group,object);this.scene.add(group);
   const applied=new Float64Array(TRANSFORM_FIELDS);ScriptObjectViews.record(object,applied);
   this.views.set(object.handle,{group,dispose:()=>built.dispose(),model:object.model,applied,shown:this.shows(object),physical,collisionOn:ScriptObjectViews.collides(object),col,asset,root:built.root,materials:built.materialBindings.map(b=>b.material)});
  });
 }
 /** The association's pose on the clump's frames: each track drives the frame of its name (an object's clump has no
  * HAnim bones), and a track naming no frame is left out, as RpAnimBlendClumpInit finds no node for it. The frames
  * go back to their rest pose once the association has gone. Nothing is resampled while the time stands still. */
 private animate(object:ScmObject,view:NonNullable<ReturnType<ScriptObjectViews['views']['get']>>){
  const anim=object.anim;
  if(!anim||view.anim&&view.anim.name!==anim.name.toUpperCase()){view.anim?.binding?.restore();view.anim=undefined;if(!anim)return;}
  let state=view.anim;
  if(!state){
   const current:NonNullable<typeof view.anim>={name:anim.name.toUpperCase(),time:NaN};view.anim=state=current;
   void this.animation?.(anim.block,anim.name).then(clip=>{
    if(!clip||view.anim!==current)return;
    // A clip whose tracks name frames the model does not have (the basketball's on the hoop) plays nothing rather than
    // raising an unhandled rejection.
    try{current.binding=bindObjectAnimation(view.root,clip);}catch(error){this.error=String(error);}
   },error=>{this.error=String(error);});
  }
  if(state.binding&&state.time!==anim.time){state.binding.sample(anim.time);state.time=anim.time;}
 }
 /** Whether CPhysical moves the object: not static (SET_OBJECT_DYNAMIC), speed applied (not FREEZE_OBJECT_POSITION),
  * and neither hanging from nor held by anything, which place it themselves. */
 private static moves(object:ScmObject){return (!object.isStatic||!!object.door||!!object.poolBall)&&!object.doorLocked&&!object.dontApplySpeed&&!object.attachedTo&&!object.heldBy&&!object.broken;}
 /** The body becomes a dynamic one with the object's mass, OBJECT.DAT's turn mass, elasticity and air resistance, as
  * an uprooted world prop does, moving off at the record's speed. */
 private startMoving(object:ScmObject,view:NonNullable<ReturnType<ScriptObjectViews['views']['get']>>){
  const body=view.physical!.body,info=this.physicsOf?.(object.model),mass=Math.min(object.mass,99999),turn=object.turnMass??info?.turnMass??mass;
  for(let i=0;i<body.numColliders();i++){const c=body.collider(i);c.setDensity(0);c.setRestitution(info?.elasticity??0);}
  ScriptObjectViews.pose(body,object,true);
  body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);
  body.setAdditionalMassProperties(mass,{x:0,y:0,z:0},{x:turn,y:turn,z:turn},{x:0,y:0,z:0,w:1},true);
  body.setLinearDamping(info?.damping??0);body.setAngularDamping(info?.damping??0);
  // Door model origins are hinges. Native bDisableMoveForce retains translation and only turns about Z.
  body.lockTranslations(!!object.door,true);body.setEnabledRotations(!object.door,true,!object.door,true);
  if(object.poolBall){body.setGravityScale(object.poolBall.applyGravity?1:0,true);body.setEnabledTranslations(true,object.poolBall.applyGravity||object.velocity.z!==0,true,true);body.enableCcd(true);}
  const v=object.velocity,w=object.turnSpeed;body.setLinvel({x:v.x*50,y:v.z*50,z:-v.y*50},true);body.setAngvel({x:w.x*50,y:w.z*50,z:-w.y*50},true);
  view.dyn={pos:{...object.position},vel:{...v},turn:{...w},heading:object.heading,rot:{...object.rotation},force:{x:0,y:0,z:0},torque:{x:0,y:0,z:0},still:0,clock:0,isStatic:object.isStatic,staticRevision:object.staticRevision};
  if((object.door||object.poolBall)&&object.isStatic)body.sleep();
 }
 /** Back to a body the record places: the object keeps the pose it came to rest in. */
 private stopMoving(object:ScmObject,view:NonNullable<ReturnType<ScriptObjectViews['views']['get']>>){
  const body=view.physical!.body;
  body.setLinvel({x:0,y:0,z:0},false);body.setAngvel({x:0,y:0,z:0},false);
  body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);
  if(!object.poolBall){object.velocity={x:0,y:0,z:0};object.turnSpeed={x:0,y:0,z:0};}view.dyn=undefined;
 }
 /** A moving object's frame: the script's own writes since the last frame go to the body (a new place, speed or
  * turn), CObject::ProcessControl's settling runs once a 30 fps game frame (move and turn speed averaged into
  * m_vecForce and m_vecTorque; under TimeStep x 0.003 for more than 10 frames and it goes static with its speed
  * gone), and the body's pose and speed are written back into the record the script reads. */
 private syncMoving(object:ScmObject,view:NonNullable<ReturnType<ScriptObjectViews['views']['get']>>,seconds:number){
  const body=view.physical!.body,d=view.dyn!;
  // A rope's hook and its load move by the rope's hand as much as their own: the physics engine's sleep would hold them
  // where a rope left them (the original's objects do not sleep, and these never come to rest).
  if(object.attachedToEntity&&body.isSleeping())body.wakeUp();
  const p=object.position,v=object.velocity,r=object.rotation;
  if(object.poolBall){
   // SET_OBJECT_DYNAMIC(false) may precede SET_OBJECT_VELOCITY by many frames (POOL2's cue setup).
   // A sleeping body retains the script's stored speed until explicitly activated, or woken by contact.
   const lv=body.linvel(),av=body.angvel(),unmoved=lv.x===0&&lv.y===0&&lv.z===0&&av.x===0&&av.y===0&&av.z===0;
   if(object.isStatic&&(!d.isStatic||d.staticRevision!==object.staticRevision||body.isSleeping()||unmoved)){
    body.setTranslation({x:p.x,y:p.z,z:-p.y},false);body.setRotation(ScriptObjectViews.orientation(object,POSE),false);body.sleep();
    d.pos={...p};d.vel={...v};d.turn={...object.turnSpeed};d.heading=object.heading;d.rot={...r};d.matrix=object.matrix;d.isStatic=true;d.staticRevision=object.staticRevision;return;
   }
   if(!object.isStatic&&d.isStatic){body.wakeUp();body.setLinvel({x:v.x*50,y:v.z*50,z:-v.y*50},true);const w=object.turnSpeed;body.setAngvel({x:w.x*50,y:w.z*50,z:-w.y*50},true);}
  }
  if(p.x!==d.pos.x||p.y!==d.pos.y||p.z!==d.pos.z)body.setTranslation({x:p.x,y:p.z,z:-p.y},true);
  // A whole matrix the runtime set (a rope turning its load or hook) turns the body; otherwise the heading and tilts do.
  if(object.matrix&&object.matrix!==d.matrix)body.setRotation(ScriptObjectViews.orientation(object,POSE),true);
  else if(object.heading!==d.heading||r.x!==d.rot.x||r.y!==d.rot.y||r.z!==d.rot.z){object.matrix=undefined;body.setRotation(ScriptObjectViews.orientation(object,POSE),true);}
  if(v.x!==d.vel.x||v.y!==d.vel.y||v.z!==d.vel.z)body.setLinvel({x:v.x*50,y:v.z*50,z:-v.y*50},true);
  // The turn speed is an axial vector; the native-to-renderer swap of axes is a proper rotation, so it maps as a point.
  const w=object.turnSpeed;if(w.x!==d.turn.x||w.y!==d.turn.y||w.z!==d.turn.z)body.setAngvel({x:w.x*50,y:w.z*50,z:-w.y*50},true);
  if(object.door){
   const door=object.door;
   if(!body.isSleeping()){
    if(door.startAngle < -1000)door.startAngle=d.heading;
    object.isStatic=false;
    const q=body.rotation(),forward=NORTH.clone().negate().applyQuaternion(POSE.set(q.x,q.y,q.z,q.w));
    let heading=Math.atan2(-forward.x,-forward.z);
    if(door.startAngle+Math.PI<heading)heading-=Math.PI*2;else if(door.startAngle-Math.PI>heading)heading+=Math.PI*2;
    const av=body.angvel();let speed=av.y/50;
    // CPhysical::ApplySpeed limits the hinge to ±108 degrees and rebounds with one fifth speed.
    // Rapier integrates contacts first; this corrects the resulting pose rather than splitting native time steps.
    const limit=Math.PI*.6,offset=heading-door.startAngle;
    if(Math.abs(offset)>limit){heading=door.startAngle+Math.sign(offset)*limit;body.setRotation({x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)},true);if(speed*offset>0)speed*=-.2;}
    let previous=d.heading;while(previous-door.startAngle>Math.PI)previous-=Math.PI*2;while(previous-door.startAngle < -Math.PI)previous+=Math.PI*2;
    if(door.moving&&Math.abs(previous-door.startAngle)>=.001&&Math.abs(heading-door.startAngle)>=.001&&(previous-door.startAngle)*(heading-door.startAngle)<0)speed=0;
    let diff=door.startAngle-heading;if(Math.abs(diff)>Math.PI/6)door.open=true;diff=Math.max(-.3,Math.min(.3,diff));
    if(diff!==0&&door.moving&&seconds>0)this.onDoorMovement?.(object.position);
    if(diff>0&&speed<.02||diff<0&&speed>-.02)speed+=seconds*50*.002*diff;
    body.setAngvel({x:0,y:speed*50,z:0},true);
    if(Math.abs(diff)<.01&&(door.moving||Math.abs(speed)<.01)){
     object.isStatic=true;body.setLinvel({x:0,y:0,z:0},false);body.setAngvel({x:0,y:0,z:0},false);body.sleep();
     if(door.moving&&door.open){door.open=false;object.doorLocked=true;object.heading=door.startAngle;object.matrix=undefined;ScriptObjectViews.pose(body,object,true);}
    }
   }else object.isStatic=true;
  }
  if(object.poolBall)object.isStatic=body.isSleeping();
  d.clock+=object.door||object.poolBall?0:seconds;
  for(;d.clock>=1/30;d.clock-=1/30){
   const lv=body.linvel(),av=body.angvel(),limit=50/30*.003;
   d.force={x:(d.force.x+lv.x/50)/2,y:(d.force.y+lv.y/50)/2,z:(d.force.z+lv.z/50)/2};
   d.torque={x:(d.torque.x+av.x/50)/2,y:(d.torque.y+av.y/50)/2,z:(d.torque.z+av.z/50)/2};
   const still=Math.hypot(d.force.x,d.force.y,d.force.z)<limit&&Math.hypot(d.torque.x,d.torque.y,d.torque.z)<limit;
   // A rope's hook and its load (physicalFlags.bAttachedToEntity) never come to rest: natively ProcessControl's gravity
   // is in their speed when it is averaged, before the rope takes it off, so the count of still frames starts again.
   d.still=still&&!object.attachedToEntity?d.still+1:0;
   if(d.still>10){object.isStatic=true;break;}
  }
  const t=body.translation(),q=body.rotation(),lv=body.linvel(),av=body.angvel();
  object.position={x:t.x,y:-t.z,z:t.y};
  object.velocity=object.isStatic?{x:0,y:0,z:0}:{x:lv.x/50,y:-lv.z/50,z:lv.y/50};
  object.turnSpeed=object.isStatic?{x:0,y:0,z:0}:{x:av.x/50,y:-av.z/50,z:av.y/50};
  const quat=POSE.set(q.x,q.y,q.z,q.w),right=EAST.clone().applyQuaternion(quat),forward=NORTH.clone().negate().applyQuaternion(quat),up=UP.clone().applyQuaternion(quat);
  object.matrix={right:{x:right.x,y:-right.z,z:right.y},forward:{x:forward.x,y:-forward.z,z:forward.y},up:{x:up.x,y:-up.z,z:up.y}};
  object.heading=Math.atan2(-object.matrix.forward.x,object.matrix.forward.y);
  d.pos={...object.position};d.vel={...object.velocity};d.turn={...object.turnSpeed};d.heading=object.heading;d.rot={...object.rotation};d.matrix=object.matrix;d.isStatic=object.isStatic;d.staticRevision=object.staticRevision;
  if(object.isStatic&&!object.poolBall&&(!object.door||object.doorLocked))this.stopMoving(object,view);
 }
 /* Native axes to the renderer's: x stays, the script's z is up here and its y runs the other way. CEntity's
  * heading turns about the up axis, and SET_OBJECT_ROTATION's three angles turn about each of them in turn. */
 /** Whether the object should be drawn at all: CEntity::bIsVisible, and the area it belongs to. */
 private shows(object:ScmObject){return object.visible&&(object.areaCode===0||object.areaCode===this.visibleArea?.());}
 /** The eight numbers the transform is built from, written into and compared against a row of its own, so a
  * frame in which nothing moved allocates nothing and touches no matrices. */
 private static record(object:ScmObject,into:Float64Array){
  const {position:p,rotation:r}=object;
  into[0]=p.x;into[1]=p.y;into[2]=p.z;into[3]=object.heading;into[4]=r.x;into[5]=r.y;into[6]=r.z;into[7]=object.scale;
 }
 private static moved(object:ScmObject,applied:Float64Array){
  const {position:p,rotation:r}=object;
  return applied[0]!==p.x||applied[1]!==p.y||applied[2]!==p.z||applied[3]!==object.heading
   ||applied[4]!==r.x||applied[5]!==r.y||applied[6]!==r.z||applied[7]!==object.scale;
 }
 /** Whether the colliders are on: the object uses collision and hangs from nothing. An attached object's body would
  * sit inside what it hangs from and push it (the original leaves the pair out of each other's collision), so here
  * it goes without collision while attached. */
 private static collides(object:ScmObject){return object.usesCollision&&!object.attachedTo;}
 /** CEntity's heading about the up axis, then SET_OBJECT_ROTATION's tilts, as the renderer's quaternion. */
 private static orientation(object:ScmObject,into:Quaternion){
  if(object.matrix){const m=object.matrix,q=rotationFromNativeRows([m.right.x,m.right.y,m.right.z],[m.forward.x,m.forward.y,m.forward.z]);return into.set(q.x,q.y,q.z,q.w);}
  const {x,y,z}=object.rotation;
  into.setFromAxisAngle(UP,object.heading+z);
  if(x)into.multiply(TILT.setFromAxisAngle(EAST,x));
  if(y)into.multiply(TILT.setFromAxisAngle(NORTH,-y));
  return into;
 }
 /** The body where the record puts the object: at once when it is made, as the next kinematic step after. */
 private static pose(body:RAPIER.RigidBody,object:ScmObject,now:boolean){
  const t={x:object.position.x,y:object.position.z,z:-object.position.y},q=ScriptObjectViews.orientation(object,POSE);
  if(now){body.setTranslation(t,true);body.setRotation(q,true);}
  else{body.setNextKinematicTranslation(t);body.setNextKinematicRotation(q);}
 }
 private place(group:Group,object:ScmObject){
  group.position.set(object.position.x,object.position.z,-object.position.y);
  group.quaternion.copy(ScriptObjectViews.orientation(object,TURN));
  group.scale.setScalar(object.scale);
  // CEntity::bIsVisible and m_nAreaCode: an object a script hid stays hidden, and one that belongs to an
  // area is drawn only while the camera is in it.
  group.visible=this.shows(object);
 }
 /** The area the camera is in, which decides whether an object with an area of its own is drawn. */
 visibleArea?:()=>number;
 cameraPosition?:()=>{x:number;y:number;z:number};
 /** CColStore::HasCollisionLoaded at a point (the renderer's x and z). */
 collisionLoaded?:(x:number,z:number)=>boolean;
 private remove(handle:number){
  const view=this.views.get(handle);if(!view)return;
  view.group.removeFromParent();view.renderPolicy?.dispose();view.dispose();this.views.delete(handle);
  if(view.physical){for(const collider of view.physical.sources.keys())this.owners.delete(collider);view.physical.dispose();}
 }
 dispose(){this.disposed=true;this.poolSteps.clear();for(const handle of [...this.views.keys()])this.remove(handle);}
}
