/* Police on foot, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166.
 *
 * - CTaskComplexPolicePursuit::SetWeapon (Tasks/TaskTypes/TaskComplexPolicePursuit.cpp,
 *   0x68BAD0), run whenever the pursuit's subtask is the arrest task.
 * - The on-foot arrest in CTaskComplexArrestPed::ControlSubTask (0x68D350). The function
 *   still calls the retail code upstream, but its decompiled body is kept in the file:
 *   while the cop runs CTaskComplexKillPedOnFoot, a suspect whose
 *   CTaskComplexFallAndGetUp is in its fall, within 3 units and 2 units vertically, gets a
 *   100 s down time and the cop switches to CTaskSimpleArrestPed. That task's StartAnim
 *   plays ARRESTgun and sets the suspect's state to PEDSTATE_ARRESTED, which
 *   CGameLogic::Update turns into the busted sequence. Standing still is never an arrest. */

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
 const d={x:o.cop.x-o.suspect.x,y:o.cop.y-o.suspect.y,z:o.cop.z-o.suspect.z},vertical=o.up==='y'?d.y:d.z;
 return Math.abs(vertical)<=ARREST_HEIGHT&&d.x*d.x+d.y*d.y+d.z*d.z<=ARREST_REACH*ARREST_REACH;
}
