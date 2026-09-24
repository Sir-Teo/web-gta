/* CPlayerInfo::StreamParachuteWeapon (0x56EB30) and GivePlayerParachute (0x56EC40), pinned gta-reversed
 * 0076f9017b4aeef7433957ac2bd8b6988e9df166: while the player sits in a plane or helicopter, each time the 5000 ms
 * m_nRequireParachuteTimer runs out it is set again to 5000 when the aircraft is more than 50 units over the ground and
 * to 0 when it is not; out of the aircraft it holds its value. GivePlayerParachute hands over WEAPON_PARACHUTE (and
 * makes it the saved weapon) while the timer is non-zero. Its caller is not reversed; the host calls it as the player
 * leaves the aircraft. */
export const WEAPON_PARACHUTE=46,PARACHUTE_HEIGHT=50,PARACHUTE_TIMER_MS=5000;
export class NativeParachuteTimer {
 /** m_nRequireParachuteTimer, ms. */
 timer=0;
 /** One step; `aircraft` is the player's plane or heli with its height over the ground (native units), if any. */
 step(timeStepMs:number,aircraft?:{heightOverGround:number}){
  if(!aircraft)return;
  const ms=Math.trunc(timeStepMs);
  if(this.timer<=ms)this.timer=aircraft.heightOverGround<=PARACHUTE_HEIGHT?0:PARACHUTE_TIMER_MS;
  else this.timer-=ms;
 }
 /** GivePlayerParachute: whether the parachute goes to the player now. */
 get wantsParachute(){return this.timer!==0;}
}
