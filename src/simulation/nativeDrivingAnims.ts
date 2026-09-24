/** CVehicle::ProcessDrivingAnims (0x6DF4A0, reversed) for the player's steering and look-back clips, with the
 * CAnimManager::BlendAnimation (0x4D4410) and CAnimBlendAssociation::UpdateBlend/UpdateTime rules it leans on. Every
 * drive clip is partial, auto-removed once faded out, and plays once from its first frame before holding the last. */
export interface DrivingAnimClip {amount:number;delta:number;time:number}
export interface DrivingAnimsInput {
 /** m_fSteerAngle in radians. */
 steer:number;
 /** m_GasPedal < 0 in a vehicle that is not low and not an aircraft: the look back over the shoulder. */
 reversing:boolean;
 /** A DRIVEBY_L/R or DRIVEBYL_L/R clip plays: the steering and look-back fade out. */
 driveBy?:boolean;
 /** The ride set's idle has fully blended in (the steering waits until it has). */
 idleFull:boolean;
 ride:{left:string;right:string;back:string};
 /** Each clip's length in seconds, or undefined when the clip is missing. */
 duration:(clip:string)=>number|undefined;
}
export class NativeDrivingAnims {
 /** The running drive clips, oldest first (the clump's anim list is newest first). */
 readonly clips=new Map<string,DrivingAnimClip>();
 /** BlendAnimation for a partial clip: every other running partial fades at its amount × −delta (at least 0.05 a
  * second, or 1 a second when already out), and this one blends up from 0, or towards 1 from where it is, restarting
  * if it had finished. */
 private blend(name:string,delta:number,duration:number){
  let running:DrivingAnimClip|undefined;
  for(const [other,a] of this.clips){
   if(other===name){running=a;continue;}
   if(a.amount<=0)a.delta=-1;
   else{const bd=a.amount*-delta;if(bd<=a.delta)a.delta=Math.min(-.05,bd);}
  }
  if(running){running.delta=(1-running.amount)*delta;if(running.time>=duration)running.time=0;return;}
  this.clips.set(name,{amount:0,delta,time:0});
 }
 /** One vehicle frame: ProcessDrivingAnims, then the clips' blend and time over `dt` seconds. */
 step(dt:number,input:DrivingAnimsInput){
  this.process(input);
  for(const [name,a] of this.clips){
   a.amount+=a.delta*dt;
   if(a.amount<=0&&a.delta<0){this.clips.delete(name);continue;}
   if(a.amount>1){a.amount=1;a.delta=Math.min(0,a.delta);}
   const duration=input.duration(name)??0;a.time=Math.min(duration,a.time+dt);
  }
 }
 private process(o:DrivingAnimsInput){
  if(!o.idleFull)return;
  const left=o.ride.left.toLowerCase(),right=o.ride.right.toLowerCase(),back=o.ride.back.toLowerCase();
  const l=this.clips.get(left),r=this.clips.get(right),b=this.clips.get(back);
  if(o.reversing&&!o.driveBy){
   const d=o.duration(back);
   if(d!==undefined&&(!b||b.amount<1&&b.delta<=0))this.blend(back,4,d);
   return;
  }
  if(o.steer===0||o.driveBy){for(const a of [l,r,b])if(a)a.delta=-4;return;}
  const used=Math.min(1,Math.abs(o.steer/.61));
  const [off,on,onName]=o.steer<0?[l,r,right]:[r,l,left];
  if(off){off.amount=0;off.delta=0;}
  if(on){on.amount=used;on.delta=0;}
  else{const d=o.duration(onName);if(d!==undefined)this.blend(onName,4,d);}
  if(b)b.delta=-4;
 }
 /** The clips to lay over the idle, oldest first, each at its own time and weight. */
 overlays(){const out:{clip:string;amount:number;seconds:number}[]=[];for(const [clip,a] of this.clips)if(a.amount>0)out.push({clip,amount:a.amount,seconds:a.time});return out;}
 reset(){this.clips.clear();}
}
