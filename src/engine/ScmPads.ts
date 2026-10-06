import {requireAsset} from '../assets/binary';
/* The pad as a script reads it, pinned gta-reversed ead3051 (`PadCommands.cpp` and
 * `CRunningScript::GetPadState` 0x4859F0, both reversed). A host writes what its own controls are doing into
 * these fields; the script asks for one button at a time by the eButtonId order below. Stick axes run -128 to
 * 128 and the buttons 0 to 255, as CControllerState keeps them. */
/** eButtonId, in order from zero. */
export const BUTTON={
 leftStickX:0,leftStickY:1,rightStickX:2,rightStickY:3,
 leftShoulder1:4,leftShoulder2:5,rightShoulder1:6,rightShoulder2:7,
 dpadUp:8,dpadDown:9,dpadLeft:10,dpadRight:11,
 start:12,select:13,square:14,triangle:15,cross:16,circle:17,
 leftShock:18,rightShock:19,
} as const;
/** The order GetPadState switches on, so an id indexes straight into the state. */
export const BUTTON_ORDER=Object.keys(BUTTON) as (keyof typeof BUTTON)[];
export type ScmPadState=Record<keyof typeof BUTTON,number>;
export function emptyPadState():ScmPadState{
 return Object.fromEntries(BUTTON_ORDER.map(name=>[name,0])) as ScmPadState;
}
/** eController::JOYPAD, the control method the script can ask about. */
export const CONTROLLER_MOUSE_AND_KEYBOARD=0,CONTROLLER_JOYPAD=1;
/** CPad's two pads, plus the menu options and the mouse the pad commands read. */
export class ScmPads {
 readonly pads:ScmPadState[]=[emptyPadState(),emptyPadState()];
 /** CPad::JustOutOfFrontEnd: a button held while the menu closed does not count as pressed. */
 justOutOfFrontEnd=false;
 /** FrontEndMenuManager.m_ControlMethod and CMenuManager::bInvertMouseY. */
 controlMethod=CONTROLLER_MOUSE_AND_KEYBOARD;invertMouseY=false;
 /** CPad::NewMouseControllerState.m_AmountMoved. */
 mouseMoved={x:0,y:0};
 private pad(index:number){
  requireAsset(Number.isInteger(index)&&index>=0&&index<this.pads.length,'Pad index out of range.');
  return this.pads[index];
 }
 /** CRunningScript::GetPadState (0x4859F0): one field by its button id; an id outside the switch reads zero,
  * which is what the source's fall-through leaves the caller with. */
 state(padIndex:number,button:number){
  const pad=this.pad(padIndex);
  const name=BUTTON_ORDER[button];
  if(name!==undefined)this.readCounts[padIndex*BUTTON_ORDER.length+button]++;
  return name===undefined?0:pad[name];
 }
 /** How many times the scripts have read a button: a host sees a script waiting on one (an incoming call on the
  * phone's) by the count moving, and puts a touch button up for it though no help text names it. */
 reads(padIndex:number,button:number){return this.readCounts[padIndex*BUTTON_ORDER.length+button]??0;}
 private readonly readCounts=new Array<number>(2*BUTTON_ORDER.length).fill(0);
 /** IS_BUTTON_PRESSED: the state is non-zero and the menu did not just close. */
 isPressed(padIndex:number,button:number){return this.state(padIndex,button)!==0&&!this.justOutOfFrontEnd;}
 /* CPad::StartShake (0x53F8E0): the vibration a pad is asked for. A request is taken up when it outlasts what is
  * left of the running shake, as StartShake_Distance's guard reads and the iOS port's executable has StartShake's
  * (it halves the time for a phone; the reversed source's guard, the duration alone, is a slip that would leave the
  * very first request unheard). The delay it remembers is compared against a later request's frequency, so a
  * stronger one gets through early. A taken request goes to `onShake`, the host's rumble or vibration. */
 /** FrontEndMenuManager.m_PrefsUseVibration and CCutsceneMgr::ms_running. */
 useVibration=true;cutsceneRunning=false;
 readonly shake=[{duration:0,frequency:0,noShakeBefore:0,noShakeFrequency:0},
  {duration:0,frequency:0,noShakeBefore:0,noShakeFrequency:0}];
 startShake(padIndex:number,time:number,frequency:number,shakeDelayMs:number,nowMs:number){
  this.pad(padIndex);
  requireAsset([time,frequency,shakeDelayMs,nowMs].every(Number.isFinite),'Invalid pad shake.');
  if(!this.useVibration||this.cutsceneRunning)return;
  const shake=this.shake[padIndex];
  if(!frequency){shake.duration=0;shake.frequency=0;return;}
  if(nowMs<shake.noShakeBefore&&frequency<=shake.noShakeFrequency)return;
  if(time>shake.duration){shake.duration=time;shake.frequency=frequency;this.onShake?.(padIndex,time,frequency);}
  shake.noShakeBefore=shakeDelayMs+nowMs;shake.noShakeFrequency=frequency;
 }
 /** CPad::StartShake_Distance (0x53F9A0): a shake felt within 70 units of the camera (an explosion, the player's own
  * shot), taken up when it outlasts what is left of the running one. */
 startShakeDistance(padIndex:number,time:number,frequency:number,distanceToCamera:number){
  this.pad(padIndex);
  if(!this.useVibration||this.cutsceneRunning||!(distanceToCamera<70))return;
  const shake=this.shake[padIndex];
  if(!frequency){shake.duration=0;shake.frequency=0;return;}
  if(time>shake.duration){shake.duration=time;shake.frequency=frequency;this.onShake?.(padIndex,time,frequency);}
 }
 /** The shake running down with the frames (CPad::Update's countdown, which the platform code keeps). */
 stepShake(ms:number){for(const shake of this.shake){shake.duration=Math.max(0,shake.duration-ms);if(!shake.duration)shake.frequency=0;}}
 /** The host's rumble or vibration for a taken request: the pad, the time in ms and the strength (0 to 255). */
 onShake?:(padIndex:number,time:number,frequency:number)=>void;
 /* The pad flags the player commands switch. Each command gives its flag the other way round from the field:
  * the script enables a button and the pad disables it. */
 readonly disabled=[{duck:false,enterCar:false,fireWeapon:false,jump:false,cycleWeapon:false},
  {duck:false,enterCar:false,fireWeapon:false,jump:false,cycleWeapon:false}];
 /** bPlayerSafe, which CPlayerInfo::MakePlayerSafe sets: the script takes control away by making the player
  * safe, so the question of whether control is on is this flag read the other way round. */
 readonly playerSafe=[false,false];
 /** iOS pad byte 0x124 (iosPrintReleasesPlayerControls): the next pad update clears DisablePlayerControls. */
 readonly releaseControls=[false,false];
 setPlayerSafe(padIndex:number,safe:boolean){this.pad(padIndex);this.playerSafe[padIndex]=safe;}
 /** bApplyBrakes and bPlayerSafeForCutscene. */
 readonly applyBrakes=[false,false];readonly safeForCutscene=[false,false];
 /** CPad::GetHorn, which a host writes while the player sounds one. */
 readonly horn=[false,false];
 setDisabled(padIndex:number,button:keyof ScmPads['disabled'][number],disabled:boolean){
  this.pad(padIndex);this.disabled[padIndex][button]=disabled;
 }
 setApplyBrakes(padIndex:number,on:boolean){this.pad(padIndex);this.applyBrakes[padIndex]=on;}
 setSafeForCutscene(padIndex:number,on:boolean){this.pad(padIndex);this.safeForCutscene[padIndex]=on;}
 /** What a host writes each frame. */
 set(padIndex:number,button:keyof typeof BUTTON,value:number){
  requireAsset(Number.isFinite(value),'Invalid pad value.');
  this.pad(padIndex)[button]=value;
 }
 clear(padIndex:number){this.pads[padIndex]=emptyPadState();}
}
