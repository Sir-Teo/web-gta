/** Visual portion of CCamera::Fade/ProcessFade (PC 1.0 reconstruction).
 * Direction 0 increases the overlay; direction 1 removes it. Native enum
 * names refer to the overlay, rather than visibility of the game scene.
 * Music fading and rendering are separate consumers, not emulated here. */
export class ScmCameraFade {
 alpha=0;value=0;fading=false;duration=0;direction=0;startedAt=0;
 fade(milliseconds:number,direction:number,nowMs:number){
  this.duration=Math.fround(Math.fround(milliseconds>>>0)/1000);
  this.direction=direction&0xffff;this.startedAt=nowMs;this.fading=true;
 }
 process(timeStepSeconds:number){
  if(!this.fading)return;
  const step=this.duration===0?0:Math.fround(Math.fround(Math.fround(timeStepSeconds)/this.duration)*255);
  if(this.direction===1){
   this.alpha=Math.fround(this.alpha-step);
   if(this.alpha>0){this.value=Math.trunc(this.alpha)&255;return;}
   this.fading=false;this.alpha=0;
  }else{
   // Source tests the old alpha before adding the current frame's step.
   if(this.alpha>=255)this.fading=false;
   this.alpha=Math.fround(this.alpha+(this.duration===0?255:step));
   if(this.alpha<255){this.value=Math.trunc(this.alpha)&255;return;}
   this.alpha=255;
  }
  this.value=Math.trunc(this.alpha)&255;
 }
}
