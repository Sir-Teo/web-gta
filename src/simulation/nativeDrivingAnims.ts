import {stepBicycleAssociations,type BicycleAssociation} from './nativeBicycleBlend';
import {bikeDriveByAnimationReady} from './nativeBikeDriveBy';
import {CAR_DRIVING_CLIPS,controlCarDriving,controlCarDriveBy,type CarDriveByInput} from './nativeCarDriving';
export interface DrivingAnimClip {amount:number;delta:number;time:number}
export interface DrivingAnimsInput {
 steer:number;reversing:boolean;driveBy?:boolean;idleFull:boolean;
 ride:{left:string;right:string;back:string};duration:(clip:string)=>number|undefined;
 driveByControl?:CarDriveByInput;cameraBehind?:boolean;offscreen?:boolean;player?:boolean;blendRadio?:boolean;
}
/** Player driving partials share native clump order, BlendAnimation and one scalar clump update.
 * The host supplies its full-body idle presence/blend, selected ride set and clip assets. */
export class NativeDrivingAnims {
 readonly associations:BicycleAssociation[]=[];
 /** Compatibility view in creation order; the association array is newest first. */
 readonly clips=new Map<string,DrivingAnimClip>();
 driveByShotReady=false;
 get driveByActive(){return this.associations.some(a=>a.identifier>=74&&a.identifier<=77&&a.amount>0);}
 step(dt:number,input:DrivingAnimsInput){
  const duration=(id:number)=>input.duration(CAR_DRIVING_CLIPS[id]),selected=controlCarDriveBy(this.associations,input.driveByControl,duration);
  this.driveByShotReady=!!input.driveByControl?.fire&&bikeDriveByAnimationReady(this.associations,selected);
  controlCarDriving(this.associations,input,duration);stepBicycleAssociations(this.associations,dt);
  this.clips.clear();for(let i=this.associations.length-1;i>=0;i--){const a=this.associations[i];this.clips.set(CAR_DRIVING_CLIPS[a.identifier],a);}
 }
 /** Simultaneous native partials in clump order, for the skinned frame sum. */
 partials(){return this.associations.filter(a=>a.amount>0).map(a=>({clip:CAR_DRIVING_CLIPS[a.identifier],amount:a.amount,seconds:a.time}));}
 /** Legacy callers layer their driving clips in creation order. */
 overlays(){return [...this.clips].filter(([,a])=>a.amount>0).map(([clip,a])=>({clip,amount:a.amount,seconds:a.time}));}
 reset(){this.associations.length=0;this.clips.clear();this.driveByShotReady=false;}
}
