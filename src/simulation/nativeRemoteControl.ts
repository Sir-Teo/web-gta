/** CPlayerInfo's remote-control state, following the pinned iOS arm64 executable:
 * Give/TakeControl 0x1001c69f0/0x1001c6d10; TakeFromPlayer 0x1001c6c1c;
 * IsPlayerInRemoteMode 0x100256560; Process's delayed hand-back 0x100254048..0x10025419c.
 * Vehicle handles stand for the registered entity pointer; occupancy remains a separate concern. */
export class NativeRemoteControl {
 vehicle?:number;
 afterExplosion=false;createExplosion=false;fadeAfterExplosion=false;removalTimeMs=0;
 /** The script's switches store the inverse: iOS 0x1001e1c90 and 0x1001e33f4. Both disabled flags start clear. */
 detonateDisabled=false;contactDetonateDisabled=false;

 get inRemoteMode(){return this.vehicle!==undefined||this.afterExplosion;}
 /** TAKE_REMOTE_CONTROL_OF_CAR: an existing different remote target gets a jump-cut camera switch (2),
  * no previous target or the same target an interpolated switch (1). The native function does not clear a pending hand-back. */
 take(vehicle:number){
  const previous=this.vehicle,switchType=previous!==undefined&&previous!==vehicle?2:1;
  this.vehicle=vehicle;
  return {previous,switchType};
 }
 /** GIVE's freshly created vehicle always uses camera switch 1, independent of a previously held pointer. */
 give(vehicle:number){this.vehicle=vehicle;return {switchType:1};}
 setDetonateEnabled(enabled:boolean){this.detonateDisabled=!enabled;}
 setContactDetonateEnabled(enabled:boolean){this.contactDetonateDisabled=!enabled;}
 /** CPlayerInfo::BlowUpRCBuggy: no action without a target, or when bRemoveFromWorld is already set. TakeFromPlayer
  * retains the pointer and starts a timed hand-back. Repeated calls restart the timer, as the native stores do. */
 remove(nowMs:number,explode=false,markedForRemoval=false){
  if(this.vehicle===undefined||markedForRemoval)return false;
  this.afterExplosion=true;this.createExplosion=explode;this.fadeAfterExplosion=true;this.removalTimeMs=nowMs>>>0;
  return true;
 }
 /** CEntity's registered pointer is cleared if its vehicle is deleted; the post-explosion flag is independent. */
 deleted(vehicle:number){if(this.vehicle===vehicle)this.vehicle=undefined;}
 /** CPlayerInfo::Process compares unsigned elapsed game milliseconds. Fade out at the crossed 1000 ms mark;
  * after 2000 ms (strictly), restore/fade in while PLAYING and mark the held vehicle for removal either way. */
 process(nowMs:number,previousMs:number,playing=true){
  const action:{fadeOut:boolean;restore:boolean;removeVehicle?:number}={fadeOut:false,restore:false};
  if(!this.afterExplosion)return action;
  const previous=(previousMs-this.removalTimeMs)>>>0,elapsed=(nowMs-this.removalTimeMs)>>>0;
  const fade=playing&&this.fadeAfterExplosion;
  action.fadeOut=previous<1000&&elapsed>=1000&&fade;
  if(elapsed>2000){
   action.restore=fade;action.removeVehicle=this.vehicle;
   this.afterExplosion=false;this.vehicle=undefined;
  }
  return action;
 }
 /** CPlayerInfo::Clear plus the script initialization's RC switch defaults. */
 clear(){
  this.vehicle=undefined;this.afterExplosion=false;this.createExplosion=false;this.fadeAfterExplosion=false;
  this.removalTimeMs=0;this.detonateDisabled=false;this.contactDetonateDisabled=false;
 }
}
