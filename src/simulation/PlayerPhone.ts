import type {Object3D} from 'three';
import type {NativeAnimation} from '../assets/ifp';
import {openStaticWorld} from '../assets/staticWorldArchive';
import {ModelReadCache,readModel} from '../assets/readModel';
import {modelObject} from '../assets/ModelObjects';

/* TASK_USE_MOBILE_PHONE on the player: CTaskComplexUseMobilePhone, a secondary task, so CJ keeps moving on his
 * legs while it runs. The task itself is unreversed. What it shows is the ped.ifp PHONE_IN clip on the upper body
 * with the cellphone model (MODEL_CELLPHONE, 330) in the right hand, PHONE_TALK looped while the call lasts, and
 * PHONE_OUT when the script stops it, after which the phone goes and his weapon is back. */

export type PhoneState='none'|'in'|'talk'|'out';
/** The player's view, as the phone needs it. */
export interface PhoneBody{
 hand(boneId?:number):Object3D|undefined;
 hasReaction(name:string):boolean;
 installReactions(clips:Record<string,NativeAnimation>,upperBody?:boolean):void;
 playReaction(name:string,duration?:number,fitDuration?:boolean,startSeconds?:number,loop?:boolean):void;
 clearReaction():void;
 readonly reactionName:string|undefined;
 reactionDuration(name:string):number|undefined;
}
const CLIPS=['phone_in','phone_talk','phone_out'] as const;
/** The installed names, kept apart from a full-body ped.ifp clip of the same name. */
const clipName=(name:string)=>`phone:${name}`;

export class PlayerPhone{
 state:PhoneState='none';
 private phone?:ReturnType<typeof modelObject>;
 private model?:Promise<ReturnType<typeof modelObject>|undefined>;
 private clips?:Promise<Record<string,NativeAnimation>|undefined>;
 private installedOn?:PhoneBody;
 private wanted=false;private inStarted=false;
 constructor(private base:string,private animation:(file:string,name:string)=>Promise<NativeAnimation|undefined>){}
 /** Whether the phone is out: the held weapon is hidden meanwhile. */
 get active(){return this.state!=='none';}
 /** TASK_USE_MOBILE_PHONE ped TRUE and FALSE. */
 use(start:boolean){this.wanted=start;if(start&&this.state==='none'){this.state='in';this.inStarted=false;}}
 private loadModel(){
  this.model??=(async()=>{
   const source=await openStaticWorld(this.base),entry=source.entry('cellphone.dff'),textureEntry=source.entry('cellphone.txd');
   if(!entry)return undefined;
   const read=await readModel({file:source.file,entry,textureEntry},new ModelReadCache(source.file,source.entries));
   // Hung on the hand, its frames are no part of the ped's skeleton: untagged, as a gun is, so a clip the ped is given
   // later still binds to one model instance (HOODS5's phone call, then a script clip on the same ped).
   const phone=modelObject(read.model,read.textures);phone.root.traverse(o=>{delete o.userData.nativeFrame;});
   return phone;
  })().catch(()=>undefined);
  return this.model;
 }
 private loadClips(){
  this.clips??=Promise.all(CLIPS.map(name=>this.animation('PED',name))).then(found=>{
   if(found.some(clip=>!clip))return undefined;
   return Object.fromEntries(CLIPS.map((name,i)=>[clipName(name),found[i]!]));
  }).catch(()=>undefined);
  return this.clips;
 }
 private play(body:PhoneBody,name:typeof CLIPS[number],loop=false){
  if(!body.hasReaction(clipName(name)))return false;
  body.playReaction(clipName(name),loop?Number.POSITIVE_INFINITY:undefined,false,0,loop);return true;
 }
 /** One frame. `body` is the player's view (nothing while it is not built). */
 step(body:PhoneBody|undefined){
  if(this.state==='none'||!body)return;
  if(this.installedOn!==body){
   // The clips go onto whichever view the player has, once they have been read.
   void this.loadClips().then(clips=>{if(clips&&this.installedOn!==body){body.installReactions(clips,true);this.installedOn=body;}});
   void this.loadModel();
  }
  if(!this.phone)void this.loadModel().then(phone=>{if(phone&&!this.phone&&this.state!=='none'){this.phone=phone;body.hand()?.add(phone.root);}});
  if(this.installedOn!==body)return;
  const current=body.reactionName;
  switch(this.state){
   case 'in':
    // Stopped before the clip could start: nothing to put away.
    if(!this.inStarted&&!this.wanted){this.phone?.root.removeFromParent();this.phone=undefined;this.state='none';return;}
    if(!this.inStarted){if(this.play(body,'phone_in'))this.inStarted=true;return;}
    if(!this.wanted){this.state='out';this.play(body,'phone_out');return;}
    if(current===clipName('phone_in'))return;
    this.state='talk';this.play(body,'phone_talk',true);return;
   case 'talk':
    if(!this.wanted){this.state='out';this.play(body,'phone_out');return;}
    // Another clip (a hit, a jump) takes the upper body for a moment; the talk comes back after it.
    if(current===undefined)this.play(body,'phone_talk',true);
    return;
   case 'out':
    if(this.wanted){this.state='talk';this.play(body,'phone_talk',true);return;}
    if(current===clipName('phone_out'))return;
    this.phone?.root.removeFromParent();this.phone=undefined;this.state='none';return;
  }
 }
}
