import RAPIER from '@dimforge/rapier3d-compat';
import {Group,Matrix4,Quaternion,Vector3,type Scene} from 'three';
import {installNativeCollisionMatrix} from './nativeCollision';
import {rotationFromNativeRows} from './recordingBody';
import {colChunkNames,readCol,type ColModel} from '../assets/col';
import {readImgEntry,type ImgEntry} from '../assets/img';
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
import {openStaticWorld} from '../assets/staticWorldArchive';
import {ModelReadCache,readModel} from '../assets/readModel';
import {modelObject} from '../assets/ModelObjects';
import type {IdeAssociation} from '../assets/ide';
import type {ScmObject} from '../engine/ScmObjects';
import type {NativeAnimation} from '../assets/ifp';
import {animationTime,sampleTrack,type TrackPose} from '../animation/sample';
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
  physical?:ReturnType<typeof installNativeCollisionMatrix>;collisionOn:boolean;col?:ColModel;
  asset:{model:import('../assets/dff').DffModel;textures:import('../assets/modelTextures').ModelTexture[]};root:import('three').Object3D;
  anim?:{name:string;binding?:ReturnType<typeof bindObjectAnimation>;time:number}}>();
 /** A clip from a script's animation block, which PLAY_OBJECT_ANIM names. */
 animation?:(block:string,name:string)=>Promise<NativeAnimation|undefined>;
 /** Which script object each of the colliders belongs to. */
 private readonly owners=new Map<number,number>();
 /** Which archive COL collection holds each model, and where in it: CColStore's files, read by their chunk headers. */
 private collisionIndex?:Promise<Map<string,{entry:ImgEntry;start:number;end:number}>>;
 private readonly collisions=new Map<string,Promise<ColModel|undefined>>();
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
 /** An object's body, once its collision is in. */
 bodyOf(handle:number){return this.views.get(handle)?.physical?.body;}
 /** The model's COL: its chunk alone, decoded from the collection the index names (the first holding the name). */
 private collision(name:string){
  const key=name.toLowerCase();let found=this.collisions.get(key);
  if(!found){
   found=(async()=>{
    this.collisionIndex??=(async()=>{
     this.source??=openStaticWorld(this.base);const source=await this.source,index=new Map<string,{entry:ImgEntry;start:number;end:number}>();
     for(const entry of source.entries){
      if(!/\.col$/i.test(entry.name))continue;
      for(const chunk of colChunkNames(await readImgEntry(source.file,entry))){const k=chunk.name.toLowerCase();if(!index.has(k))index.set(k,{entry,start:chunk.start,end:chunk.end});}
     }
     return index;
    })();
    const at=(await this.collisionIndex).get(key);if(!at)return undefined;
    const source=await this.source!,bytes=await readImgEntry(source.file,at.entry);
    return readCol(bytes.subarray(at.start,at.end))[0];
   })().catch(error=>{this.error=String(error);return undefined;});
   this.collisions.set(key,found);
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
 /** The dff and txd names a script's model stands for, by id or by the name the script used. */
 private association(model:number|string){
  return typeof model==='number'?this.byId.get(model):this.byName.get(model.toLowerCase());
 }
 private load(record:IdeAssociation){
  const key=`${record.model}|${record.dictionary}`.toLowerCase();let promise=this.models.get(key);
  if(!promise){
   promise=(async()=>{
    this.source??=openStaticWorld(this.base);const source=await this.source;this.cache??=new ModelReadCache(source.file,source.entries);
    const entry=source.entry(`${record.model}.dff`);
    const textureEntry=source.entry(`${record.dictionary}.txd`);
    if(!entry)return undefined;
    const read=await readModel({file:source.file,entry,textureEntry},this.cache);
    return {model:read.model,textures:read.textures};
   })().catch(error=>{this.error=String(error);return undefined;});
   this.models.set(key,promise);
  }
  return promise;
 }
 /** Put the script's objects where it says they are, and take away the ones it has deleted. */
 update(objects:readonly ScmObject[]){
  if(this.disposed)return;
  const live=new Set<number>();
  for(const object of objects){
   live.add(object.handle);
   const view=this.views.get(object.handle);
   if(view&&view.model!==object.model){this.remove(object.handle);}
   else if(view){
    // Most of a script's objects never move again after it puts them down, so the transform is rebuilt only
    // when the record says something about it has changed.
    const shown=this.shows(object);
    if(shown!==view.shown||object.matrix||ScriptObjectViews.moved(object,view.applied)){
     this.place(view.group,object);ScriptObjectViews.record(object,view.applied);view.shown=shown;
     if(view.physical)ScriptObjectViews.pose(view.physical.body,object,false);
    }
    if(view.anim||object.anim)this.animate(object,view);
    if(view.physical&&view.collisionOn!==ScriptObjectViews.collides(object)){
     view.collisionOn=ScriptObjectViews.collides(object);
     for(let i=0;i<view.physical.body.numColliders();i++)view.physical.body.collider(i).setEnabled(view.collisionOn);
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
  void Promise.all([this.load(record),this.world?this.collision(record.model):undefined]).then(([asset,col])=>{
   this.loading.delete(object.handle);
   if(!asset||this.disposed||this.views.has(object.handle))return;
   const built=modelObject(asset.model,asset.textures,undefined,undefined,{worldLighting:true,ambient:this.ambient});
   let physical:ReturnType<typeof installNativeCollisionMatrix>|undefined;
   if(this.world&&col&&(col.spheres.length||col.boxes.length||col.mesh.indices.length)){
    try{
     physical=installNativeCollisionMatrix(this.world,col,NATIVE_AXES);
     physical.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);
     ScriptObjectViews.pose(physical.body,object,true);
     for(const collider of physical.sources.keys()){this.owners.set(collider,object.handle);if(!ScriptObjectViews.collides(object))this.world.getCollider(collider)?.setEnabled(false);}
    }catch(error){physical?.dispose();physical=undefined;this.error=String(error);}
   }
   // Frustum culling stays on: a script's objects are world props standing where it put them, and most of
   // them are behind the camera at any moment, so letting three.js skip them is most of their cost.
   const group=new Group();group.add(built.root);
   this.place(group,object);this.scene.add(group);
   const applied=new Float64Array(TRANSFORM_FIELDS);ScriptObjectViews.record(object,applied);
   this.views.set(object.handle,{group,dispose:()=>built.dispose(),model:object.model,applied,shown:this.shows(object),physical,collisionOn:ScriptObjectViews.collides(object),col,asset,root:built.root});
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
    current.binding=bindObjectAnimation(view.root,clip);
   });
  }
  if(state.binding&&state.time!==anim.time){state.binding.sample(anim.time);state.time=anim.time;}
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
 private remove(handle:number){
  const view=this.views.get(handle);if(!view)return;
  view.group.removeFromParent();view.dispose();this.views.delete(handle);
  if(view.physical){for(const collider of view.physical.sources.keys())this.owners.delete(collider);view.physical.dispose();}
 }
 dispose(){this.disposed=true;for(const handle of [...this.views.keys()])this.remove(handle);}
}
