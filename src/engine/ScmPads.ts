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
  return name===undefined?0:pad[name];
 }
 /** IS_BUTTON_PRESSED: the state is non-zero and the menu did not just close. */
 isPressed(padIndex:number,button:number){return this.state(padIndex,button)!==0&&!this.justOutOfFrontEnd;}
 /** What a host writes each frame. */
 set(padIndex:number,button:keyof typeof BUTTON,value:number){
  requireAsset(Number.isFinite(value),'Invalid pad value.');
  this.pad(padIndex)[button]=value;
 }
 clear(padIndex:number){this.pads[padIndex]=emptyPadState();}
}
