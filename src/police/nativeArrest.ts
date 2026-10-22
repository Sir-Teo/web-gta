/* Police on foot, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166.
 *
 * - CTaskComplexPolicePursuit::SetWeapon (Tasks/TaskTypes/TaskComplexPolicePursuit.cpp,
 *   0x68BAD0), run whenever the pursuit's subtask is the arrest task.
 * - The on-foot arrest is captured from iOS CTaskComplexArrestPed::ControlSubTask
 *   (10042ADD8; range calculation 10042AF28..10042AF6C). The unreversed PC candidate
 *   uses a 3D radius; the executable tests horizontal squared distance <= 9 and
 *   absolute height <= 2 separately, in float32. A falling suspect gets 100 s down
 *   time before the cop requests CTaskSimpleArrestPed. Its StartAnim plays ARRESTgun
 *   and marks the suspect arrested. See scripts/research/native-arrest-task.py. */

/** The street cop's active weapon. CCopPed starts on slot 0, unarmed, carrying a
 * nightstick and a pistol. */
export type CopWeapon='unarmed'|'nightstick'|'pistol';
export function policePursuitWeapon(o:{current:CopWeapon;wantedLevel:number;
 /** The player's active weapon fires instant hits or projectiles. */
 playerHoldsGun:boolean;
 /** CPed::m_standingOnEntity: the player stands on a vehicle or object. */
 playerOnEntity?:boolean;
 /** The cop is already in PEDSTATE_ARREST_PLAYER. */
 arresting?:boolean}):CopWeapon{
 if(o.wantedLevel<=0)return o.current;
 if(o.wantedLevel>1){
  // A weapon already in hand is kept, so a cop who drew the nightstick at one star keeps it.
  if(o.current!=='unarmed')return o.current;
  return 'pistol';
 }
 if(o.playerOnEntity||o.arresting)return o.current;
 return o.playerHoldsGun?'pistol':'nightstick';
}
export const ARREST_REACH=3,ARREST_HEIGHT=2;
/** CTaskComplexFallAndGetUp::SetDownTime(100'000) on the arrested suspect. */
export const ARREST_DOWN_TIME=100;
/** The on-foot arrest test. Positions share one frame; `up` picks the vertical axis. */
export function copCanArrest(o:{cop:{x:number;y:number;z:number};suspect:{x:number;y:number;z:number};suspectFalling:boolean;up:'y'|'z'}){
 if(!o.suspectFalling)return false;
 const f=Math.fround,d={x:f(f(o.cop.x)-f(o.suspect.x)),y:f(f(o.cop.y)-f(o.suspect.y)),z:f(f(o.cop.z)-f(o.suspect.z))},vertical=o.up==='y'?d.y:d.z,horizontal=o.up==='y'?d.z:d.y;
 return Math.abs(vertical)<=ARREST_HEIGHT&&f(f(d.x*d.x)+f(horizontal*horizontal))<=ARREST_REACH*ARREST_REACH;
}
