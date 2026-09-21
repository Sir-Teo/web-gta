import {Group,Quaternion,Vector3,type Scene} from 'three';
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
/* The objects a script makes, drawn where the runtime says they are.
 *
 * ScmObjects already holds everything CObject carries for the script — position, heading, the full rotation,
 * the scale, whether it uses collision — and says in as many words that a host mirrors each record into the
 * world it draws. This is that host. It owns no state of its own beyond the models it has loaded and the group
 * each object is drawn in: every frame it is handed the runtime's own records and puts each one where it says.
 *
 * A model the archive does not carry draws nothing, as CStreaming renders nothing for a model it cannot load,
 * and the object still exists for every question the script asks about it. */
export class ScriptObjectViews{
 private readonly views=new Map<number,{group:Group;dispose:()=>void;model:number|string;applied:Float64Array;shown:boolean}>();
 private readonly models=new Map<string,Promise<{model:import('../assets/dff').DffModel;textures:import('../assets/modelTextures').ModelTexture[]}|undefined>>();
 private readonly loading=new Set<number>();
 private readonly byId=new Map<number,IdeAssociation>();
 private readonly byName=new Map<string,IdeAssociation>();
 private source?:ReturnType<typeof openStaticWorld>;
 private cache?:ModelReadCache;
 private disposed=false;
 private readonly ambient=nativeAmbientState();
 error?:string;
 constructor(private readonly scene:Scene,private readonly base:string,associations:readonly IdeAssociation[]){
  for(const record of associations){
   if(!this.byId.has(record.id))this.byId.set(record.id,record);
   const name=record.model.toLowerCase();
   if(!this.byName.has(name))this.byName.set(name,record);
  }
 }
 get drawn(){return this.views.size;}
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
    const entry=source.entries.find(e=>e.name.toLowerCase()===`${record.model.toLowerCase()}.dff`);
    const textureEntry=source.entries.find(e=>e.name.toLowerCase()===`${record.dictionary.toLowerCase()}.txd`);
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
    if(shown!==view.shown||ScriptObjectViews.moved(object,view.applied)){
     this.place(view.group,object);ScriptObjectViews.record(object,view.applied);view.shown=shown;
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
  void this.load(record).then(asset=>{
   this.loading.delete(object.handle);
   if(!asset||this.disposed||this.views.has(object.handle))return;
   const built=modelObject(asset.model,asset.textures,undefined,undefined,{worldLighting:true,ambient:this.ambient});
   // Frustum culling stays on: a script's objects are world props standing where it put them, and most of
   // them are behind the camera at any moment, so letting three.js skip them is most of their cost.
   const group=new Group();group.add(built.root);
   this.place(group,object);this.scene.add(group);
   const applied=new Float64Array(TRANSFORM_FIELDS);ScriptObjectViews.record(object,applied);
   this.views.set(object.handle,{group,dispose:()=>built.dispose(),model:object.model,applied,shown:this.shows(object)});
  });
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
 private place(group:Group,object:ScmObject){
  group.position.set(object.position.x,object.position.z,-object.position.y);
  const {x,y,z}=object.rotation;
  TURN.setFromAxisAngle(UP,object.heading+z);
  if(x)TURN.multiply(TILT.setFromAxisAngle(EAST,x));
  if(y)TURN.multiply(TILT.setFromAxisAngle(NORTH,-y));
  group.quaternion.copy(TURN);
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
 }
 dispose(){this.disposed=true;for(const handle of [...this.views.keys()])this.remove(handle);}
}
