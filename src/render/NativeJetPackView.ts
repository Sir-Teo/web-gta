import * as THREE from 'three';
import {openStaticWorld} from '../assets/staticWorldArchive';
import {ModelReadCache,readModel} from '../assets/readModel';
import {modelObject} from '../assets/ModelObjects';
import type {NativeJetPack} from '../simulation/nativeJetPack';

/** JETPACK_POS_OFFSET and JETPACK_ROT_AXIS, along the spine bone this port hangs the pack on: 0.3 up the bone (the
 * original's 0.1 up the leaning Spine1 node) and 0.08 across, turned a quarter turn about the bone's Y. */
const OFFSET=new THREE.Vector3(.3,.08,0);
/** The bone the pack rides. RenderJetPack indexes the ped's hierarchy matrix array with PED_NODE_LEFT_ARM (3), which
 * lands on the Spine1 node rather than an arm. That node leans in this port's assembled player skeleton, which would
 * tip the pack over, so it hangs off Spine (2) with the offset moved up to sit square on the back. */
export const JETPACK_BONE=2;
/** RwMatrixRotate with rwCOMBINEREPLACE leaves no scale. */
const ONE=new THREE.Vector3(1,1,1);
/** JETBALL_OFFSET: where each thruster's flame starts. */
export const JETBALL_OFFSET:readonly [number,number,number]=[0,0,-.15];

/** CTaskSimpleJetPack::RenderJetPack (0x67F6A0): the MODEL_JETPACK clump follows the ped's arm bone, and its two
 * `jetball` frames swivel with the pitch the thrust angle gives and the strafe command. */
export class NativeJetPackView {
 private object?:ReturnType<typeof modelObject>;
 private holder=new THREE.Group();
 private balls:{name:string;left:boolean;frame:THREE.Object3D;position:THREE.Vector3}[]=[];
 private euler=new THREE.Euler();
 private rotation=new THREE.Quaternion();
 error?:string;
 get ready(){return !!this.object;}
 /** Whether the pack is on the ped right now. */
 get worn(){return this.holder.parent!==null;}
 async load(base:string){
  try{
   const source=await openStaticWorld(base),find=(name:string)=>source.entry(name);
   const entry=find('jetpack.dff');if(!entry)throw new Error('Missing jetpack.dff.');
   const {model,textures}=await readModel({file:source.file,entry,textureEntry:find('jetpack.txd')},new ModelReadCache(source.file,source.entries));
   const object=modelObject(model,textures);
   object.root.traverse(o=>{o.frustumCulled=false;});
   // The clump's own frame sits at the pack's root; the two jet balls are its children.
   object.root.position.copy(OFFSET);object.root.rotation.set(0,Math.PI/2,0);
   for(const [name,left] of [['jetball1',true],['jetball2',false]] as const){
    const index=model.frames.findIndex(f=>f.name?.toLowerCase()===name);
    let frame:THREE.Object3D|undefined;object.root.traverse(o=>{if(o.userData.nativeFrame===index)frame=o;});
    // Native frames draw from their matrix (matrixAutoUpdate is off); the rest position lives there, not in .position.
    if(frame)this.balls.push({name,left,frame,position:new THREE.Vector3().setFromMatrixPosition(frame.matrix)});
   }
   this.holder.name='Native jetpack';this.holder.add(object.root);
   this.object=object;
  }catch(error){this.error=String(error);}
 }
 /** One frame of RenderJetPack. `bone` is the ped's arm bone, or nothing while no pack is worn. */
 frame(bone:THREE.Object3D|undefined,pack:NativeJetPack|undefined,currentHeading:number,timeMs:number,aimingHeading?:number,frameDue=true){
  if(!this.object)return;
  if(!bone||!pack||pack.finished){this.holder.removeFromParent();return;}
  if(this.holder.parent!==bone)bone.add(this.holder);
  const pitch=pack.packPitch(currentHeading,aimingHeading,frameDue);
  for(const ball of this.balls){
   const [x,y]=pack.ballRotation(pitch,ball.left,timeMs);
   // RwMatrixRotate about the IK X axis, then the Y axis preconcatenated, with the frame's own position kept.
   ball.frame.matrix.compose(ball.position,this.rotation.setFromEuler(this.euler.set(x,y,0,'XYZ')),ONE);ball.frame.matrixWorldNeedsUpdate=true;
  }
 }
 /** Each thruster's world matrix, for the `jetpack` flame DoJetPackEffect puts on it. */
 ballMatrices(){
  if(!this.worn)return [];
  this.holder.updateWorldMatrix(true,true);
  return this.balls.map(ball=>ball.frame.matrixWorld);
 }
 /** Each thruster's swivel from its frame matrix, in degrees, for probes. */
 ballAngles(){return this.balls.map(ball=>+(2*Math.acos(Math.min(1,Math.abs(this.rotation.setFromRotationMatrix(ball.frame.matrix).w)))*180/Math.PI).toFixed(1));}
 dispose(){this.holder.removeFromParent();this.object?.dispose();this.object=undefined;this.balls=[];}
}
