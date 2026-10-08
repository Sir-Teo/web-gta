/** Visual portion of CCamera::Fade/ProcessFade (PC 1.0 reconstruction).
 * Direction 0 increases the overlay; direction 1 removes it. Native enum
 * names refer to the overlay, rather than visibility of the game scene.
 * The music side of CCamera::Fade and ProcessMusicFade rides along: the effects fader scaling factor (1 is full
 * volume) that CAEAudioHardware multiplies every channel's gain by. */
export class ScmCameraFade {
 alpha=0;value=0;fading=false;duration=0;direction=0;startedAt=0;
 /** m_bMusicFading, m_nMusicFadingDirection, m_fTimeToFadeMusic, m_fTimeToWaitToFadeMusic and the factor itself. */
 musicFading=false;musicDirection=0;timeToFadeMusic=0;timeToWaitToFadeMusic=0;faderScalingFactor=1;
 /** `ignoreMusic` is m_bIgnoreFadingStuffForMusic (SET_MUSIC_DOES_FADE off): the sound then only ever fades back up. */
 fade(milliseconds:number,direction:number,nowMs:number,ignoreMusic=false){
  this.duration=Math.fround(Math.fround(milliseconds>>>0)/1000);
  this.direction=direction&0xffff;this.startedAt=nowMs;this.fading=true;
  // Direction 0 brings the black in (FADE_IN); the sound then waits for the last three tenths of the fade, less a
  // tenth of a second. Direction 1 takes it out (FADE_OUT); the sound comes back over the first three tenths.
  if(ignoreMusic&&this.direction!==1)return;
  this.musicFading=true;this.musicDirection=this.direction;
  this.timeToFadeMusic=Math.min(Math.max(this.duration*.3,.3),this.duration);
  this.timeToWaitToFadeMusic=this.direction===0?this.duration-this.timeToFadeMusic:0;
  if(this.direction===0)this.timeToFadeMusic=Math.max(this.timeToFadeMusic-.1,0);
 }
 /** CCamera::ProcessMusicFade. */
 processMusicFade(timeStepSeconds:number){
  if(!this.musicFading)return;
  if(this.timeToWaitToFadeMusic>0){this.timeToWaitToFadeMusic-=timeStepSeconds;return;}
  if(this.musicDirection===1){
   this.faderScalingFactor=this.timeToFadeMusic>0?this.faderScalingFactor+timeStepSeconds/this.timeToFadeMusic:1;
   if(this.faderScalingFactor>=1){this.musicFading=false;this.faderScalingFactor=1;}
  }else{
   if(this.faderScalingFactor<=0){this.musicFading=false;this.faderScalingFactor=0;}
   this.faderScalingFactor=this.timeToFadeMusic>0?Math.max(0,this.faderScalingFactor-timeStepSeconds/this.timeToFadeMusic):0;
  }
 }
 process(timeStepSeconds:number){
  this.processMusicFade(timeStepSeconds);
  if(!this.fading)return;
  const step=this.duration===0?0:Math.fround(Math.fround(Math.fround(timeStepSeconds)/this.duration)*255);
  if(this.direction===1){
   // iOS (0x10022a904) clears the overlay at once for a fade of no length; gta-reversed's reconstruction adds nothing
   // and would leave it fading for ever (RYDER2's DO_FADE 0 1 then waits on GET_FADING_STATUS).
   this.alpha=this.duration===0?0:Math.fround(this.alpha-step);
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
