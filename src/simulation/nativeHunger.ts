/* CPlayerInfo::WorkOutEnergyFromHunger (0x56ED60), pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166
 * (PlayerInfo.cpp). Each change of the clock's hour counts one hour without food. Past 48 the stomach rumbles and the
 * pad shakes every hour: the first time the NOTEAT help shows, and from then on fat goes 25 at a time, then muscle,
 * and once both are gone the player loses 2 health an hour. */

export const HUNGRY_AFTER_HOURS=48;

/** What an hour of hunger does to the player. */
export interface HungryPlayer {
 fat():number;muscle():number;
 decrementFat(value:number):void;decrementMuscle(value:number):void;
 /** m_fHealth -= value. */
 hurt(value:number):void;
 /** Say(CTX_GLOBAL_STOMACH_RUMBLE) and CPad::StartShake(400, 110). */
 rumble():void;
 /** CHud::SetHelpMessage(NOTEAT). */
 helpMessage():void;
}

export class NativeHunger {
 /** CPlayerInfo::m_nNumHoursDidntEat. */
 hoursDidntEat=0;
 /** The function's statics: the hour last looked at, the hour muscle starts to go, and whether NOTEAT has shown. */
 private lastHour?:number;private lastHungryState=0;private messageShown=false;
 /** `blocked`: player controls disabled, a menu, widescreen, a cutscene, a remote-controlled car, or the player
  * attached to something. The cheat keeps the whole routine from running. */
 update(hour:number,neverHungry:boolean,blocked:boolean,player:HungryPlayer){
  if(neverHungry)return;
  this.lastHour??=hour;
  if(blocked)return;
  const changed=hour!==this.lastHour;
  if(changed){if(!this.hoursDidntEat)this.lastHungryState=0;this.hoursDidntEat++;}
  if(this.hoursDidntEat<=HUNGRY_AFTER_HOURS)this.messageShown=false;
  else{
   if(!changed)return;
   player.rumble();
   if(this.messageShown){
    let fatLost=false;
    if(player.fat()>0){player.decrementFat(25);fatLost=true;if(!this.lastHungryState)this.lastHungryState=this.hoursDidntEat+24;}
    if(player.muscle()<=0||this.hoursDidntEat<=this.lastHungryState&&this.lastHungryState){if(!fatLost)player.hurt(2);}
    else player.decrementMuscle(25);
   }else{player.helpMessage();this.messageShown=true;}
  }
  if(changed)this.lastHour=hour;
 }
}
