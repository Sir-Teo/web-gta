/* The iOS port's scripts were rewritten for touch: a minigame asks for its own widgets (the gym's Easier and Harder, the
 * casino's, the crane's, the phone's), as the 123 names of its widget table show. The PC scripts read the pad instead,
 * and say which button only in a help box, often only the first time. A script reads a button only while it waits on
 * one (nothing reads the pad in free roam), so a button just read is one the player needs: the touch controls put up
 * the button that presses it when it is one they show only on call. */
import {BUTTON} from '../engine/ScmPads';

/** When each pad button was last read, from the scripts' running counts (ScmPads.reads). */
export class ScriptButtonReads {
 private counts:number[]=[];private at:number[]=[];
 /** The buttons read within `windowMs` of `now`, given each button's count so far. */
 update(reads:(button:number)=>number,now:number,windowMs=500):Set<number>{
  const recent=new Set<number>();
  for(let button=0;button<20;button++){
   const count=reads(button);
   if(count!==(this.counts[button]??0)){this.counts[button]=count;this.at[button]=now;}
   if(now-(this.at[button]??-Infinity)<windowMs)recent.add(button);
  }
  return recent;
 }
}

/** The touch buttons, by their action, for the pad buttons a script has just read that the controls show only on call.
 * On foot the phone's button (L1) is Action and looking behind (R3) Look back; Enter (triangle) is the vehicle's
 * door everywhere; a d-pad direction is the arrow that presses it, unless a script menu is up (its own arrows) or the
 * same direction is already asked for under another name (a conversation's Yes and No, the group's Follow and Stay).
 * At the wheel the shoulder twos look left and right. The rest are on screen already: Fire, Jump, Sprint, Crouch, the
 * weapon on foot, the pedals, handbrake and horn at the wheel. */
export function touchActionsForReads(read:ReadonlySet<number>,{inVehicle,menu,asked,held=false}:{inVehicle:boolean;menu:boolean;asked:readonly string[];held?:boolean}):string[]{
 const out:string[]=[];
 // The left stick read while the script holds CJ on foot is a rhythm game's (a dance): the port's four rhythm arrows.
 if(!inVehicle&&held&&!menu&&(read.has(BUTTON.leftStickX)||read.has(BUTTON.leftStickY)))out.push('RHYTHM_UP','RHYTHM_DOWN','RHYTHM_LEFT','RHYTHM_RIGHT');
 if(read.has(BUTTON.triangle))out.push('VEHICLE_ENTER_EXIT');
 if(!inVehicle){
  if(read.has(BUTTON.leftShoulder1))out.push('PED_ANSWER_PHONE');
  if(read.has(BUTTON.rightShock))out.push('PED_LOOKBEHIND');
 }else{
  if(read.has(BUTTON.leftShoulder2))out.push('VEHICLE_LOOKLEFT');
  if(read.has(BUTTON.rightShoulder2))out.push('VEHICLE_LOOKRIGHT');
 }
 if(!menu){
  const has=(...actions:string[])=>actions.some(action=>asked.includes(action));
  if(read.has(BUTTON.dpadUp)&&!has('GROUP_CONTROL_FWD','GANG_RECRUIT'))out.push('MENU_UP');
  if(read.has(BUTTON.dpadDown)&&!has('GROUP_CONTROL_BWD'))out.push('MENU_DOWN');
  if(read.has(BUTTON.dpadLeft)&&!has('CONVERSATION_NO'))out.push('MENU_LEFT');
  if(read.has(BUTTON.dpadRight)&&!has('CONVERSATION_YES'))out.push('MENU_RIGHT');
 }
 return out;
}
