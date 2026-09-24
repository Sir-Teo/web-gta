/* CControllerConfigManager (ControllerConfigManager.cpp), pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166:
 * AffectPadFromKeyBoard (0x531140) and AffectPadFromMouse (0x5314A0) run AffectControllerStateOn_ButtonDown for every
 * action whose key or mouse button is down. That picks the driving mapping while the player drives with the controls on
 * (UseDrivingControls), else the on-foot one, first person (UseFirstPersonControls) or third. CheckAndSetButton writes
 * 255; CheckAndSetStick writes ±128, or 0 once both directions are down; CheckAndSetPad writes the second d-pad
 * button, or clears both when the first is already set. CPad::Update reconciles the keyboard and mouse states into
 * NewState, which CRunningScript::GetPadState reads. */
import {BUTTON_ORDER,emptyPadState,type ScmPadState} from '../engine/ScmPads';

export type PadAction='GO_FORWARD'|'GO_BACK'|'GO_LEFT'|'GO_RIGHT'|'PED_FIRE_WEAPON'|'PED_FIRE_WEAPON_ALT'|'PED_LOCK_TARGET'
 |'GROUP_CONTROL_FWD'|'GROUP_CONTROL_BWD'|'PED_1RST_PERSON_LOOK_LEFT'|'PED_1RST_PERSON_LOOK_RIGHT'|'PED_1RST_PERSON_LOOK_UP'
 |'PED_1RST_PERSON_LOOK_DOWN'|'PED_LOOKBEHIND'|'PED_JUMPING'|'PED_ANSWER_PHONE'|'PED_CYCLE_WEAPON_LEFT'|'PED_CYCLE_WEAPON_RIGHT'
 |'PED_SPRINT'|'PED_DUCK'|'PED_CENTER_CAMERA_BEHIND_PLAYER'|'PED_SNIPER_ZOOM_IN'|'PED_SNIPER_ZOOM_OUT'|'VEHICLE_ENTER_EXIT'
 |'CAMERA_CHANGE_VIEW_ALL_SITUATIONS'|'CONVERSATION_NO'|'CONVERSATION_YES'|'VEHICLE_FIRE_WEAPON'|'VEHICLE_FIRE_WEAPON_ALT'
 |'VEHICLE_LOOKBEHIND'|'VEHICLE_LOOKLEFT'|'VEHICLE_LOOKRIGHT'|'VEHICLE_HORN'|'VEHICLE_HANDBRAKE'|'VEHICLE_ACCELERATE'
 |'VEHICLE_BRAKE'|'VEHICLE_STEERUP'|'VEHICLE_STEERDOWN'|'VEHICLE_STEERLEFT'|'VEHICLE_STEERRIGHT'|'VEHICLE_RADIO_STATION_UP'
 |'VEHICLE_RADIO_STATION_DOWN'|'TOGGLE_SUBMISSIONS'|'VEHICLE_TURRETLEFT'|'VEHICLE_TURRETRIGHT'|'VEHICLE_TURRETUP'|'VEHICLE_TURRETDOWN';
export type PadControls='driving'|'firstPerson'|'thirdPerson';
type Field=keyof ScmPadState;
type Rule=readonly [PadAction,'button',Field]|readonly [PadAction,'stick',Field,number]|readonly [PadAction,'pad',Field,Field];

/** AffectControllerStateOn_ButtonDown_Driving (0x52F7B0). */
const DRIVING:readonly Rule[]=[
 ['VEHICLE_FIRE_WEAPON','button','circle'],['VEHICLE_FIRE_WEAPON_ALT','button','leftShoulder1'],
 ['VEHICLE_LOOKBEHIND','button','leftShoulder2'],['VEHICLE_LOOKBEHIND','button','rightShoulder2'],
 ['VEHICLE_LOOKLEFT','button','leftShoulder2'],['VEHICLE_LOOKRIGHT','button','rightShoulder2'],
 ['VEHICLE_HORN','button','leftShock'],['VEHICLE_HANDBRAKE','button','rightShoulder1'],
 ['VEHICLE_ACCELERATE','button','cross'],['VEHICLE_BRAKE','button','square'],
 ['VEHICLE_STEERUP','stick','leftStickY',-128],['VEHICLE_STEERDOWN','stick','leftStickY',128],
 ['VEHICLE_STEERLEFT','stick','leftStickX',-128],['VEHICLE_STEERRIGHT','stick','leftStickX',128],
 ['VEHICLE_RADIO_STATION_UP','button','dpadUp'],['VEHICLE_RADIO_STATION_DOWN','button','dpadDown'],
 ['TOGGLE_SUBMISSIONS','button','rightShock'],
 ['VEHICLE_TURRETLEFT','stick','rightStickX',-128],['VEHICLE_TURRETRIGHT','stick','rightStickX',128],
 ['VEHICLE_TURRETUP','stick','rightStickY',128],['VEHICLE_TURRETDOWN','stick','rightStickY',-128],
];
/** AffectControllerStateOn_ButtonDown_VehicleAndThirdPersonOnly (0x52FD20). */
const VEHICLE_AND_THIRD:readonly Rule[]=[['VEHICLE_ENTER_EXIT','button','triangle']];
/** AffectControllerStateOn_ButtonDown_AllStates (0x52FCA0); NETWORK_TALK has no script button. */
const ALL_STATES:readonly Rule[]=[['CAMERA_CHANGE_VIEW_ALL_SITUATIONS','button','select'],
 ['CONVERSATION_NO','pad','dpadRight','dpadLeft'],['CONVERSATION_YES','pad','dpadLeft','dpadRight']];
/** AffectControllerStateOn_ButtonDown_FirstAndThirdPersonOnly (0x52FAB0); PED_WALK has no script button. */
const FIRST_AND_THIRD=(joypad:boolean):readonly Rule[]=>[
 ['PED_FIRE_WEAPON','button','circle'],['PED_FIRE_WEAPON_ALT','button','leftShoulder1'],['PED_LOCK_TARGET','button','rightShoulder1'],
 ['GO_FORWARD','stick','leftStickY',-128],['GO_BACK','stick','leftStickY',128],['GO_LEFT','stick','leftStickX',-128],['GO_RIGHT','stick','leftStickX',128],
 ['GROUP_CONTROL_FWD','pad','dpadDown','dpadUp'],['GROUP_CONTROL_BWD','pad','dpadUp','dpadDown'],
 ['PED_1RST_PERSON_LOOK_LEFT','stick','rightStickX',-128],['PED_1RST_PERSON_LOOK_RIGHT','stick','rightStickX',128],
 ...joypad?[['PED_1RST_PERSON_LOOK_UP','stick','rightStickY',128],['PED_1RST_PERSON_LOOK_DOWN','stick','rightStickY',-128]] as const:[],
];
/** AffectControllerStateOn_ButtonDown_ThirdPersonOnly (0x52FA20). */
const THIRD=(joypad:boolean):readonly Rule[]=>[
 ['PED_LOOKBEHIND','button','rightShock'],['PED_JUMPING','button','square'],['PED_ANSWER_PHONE','button','leftShoulder1'],
 ['PED_CYCLE_WEAPON_LEFT','button','leftShoulder2'],['PED_CYCLE_WEAPON_RIGHT','button','rightShoulder2'],
 ['PED_SPRINT','button','cross'],['PED_DUCK','button','leftShock'],
 ...joypad?[['PED_CENTER_CAMERA_BEHIND_PLAYER','button','leftShoulder1']] as const:[],
];
/** AffectControllerStateOn_ButtonDown_FirstPersonOnly (0x52F9E0). */
const FIRST:readonly Rule[]=[['PED_SNIPER_ZOOM_IN','button','square'],['PED_SNIPER_ZOOM_OUT','button','cross'],['PED_DUCK','button','leftShock']];

/** AffectControllerStateOn_ButtonDown (0x531460)'s choice of mappings. */
function rulesFor(controls:PadControls,joypad:boolean):readonly Rule[]{
 if(controls==='driving')return [...DRIVING,...VEHICLE_AND_THIRD,...ALL_STATES];
 if(controls==='firstPerson')return [...FIRST_AND_THIRD(joypad),...FIRST,...ALL_STATES];
 return [...FIRST_AND_THIRD(joypad),...THIRD(joypad),...VEHICLE_AND_THIRD,...ALL_STATES];
}
const RULES=new Map<string,readonly Rule[]>();

/** The pad state held actions give, applied in the order the actions are listed. A given state is cleared first
 * (CPad::Update clears the temporary key and mouse states after reconciling them). */
export function padStateFromActions(actions:Iterable<PadAction>,controls:PadControls,joypad=false,state:ScmPadState=emptyPadState()):ScmPadState{
 for(const name of BUTTON_ORDER)state[name]=0;
 const key=controls+joypad;let rules=RULES.get(key);if(!rules)RULES.set(key,rules=rulesFor(controls,joypad));
 const bothDown=new Set<Field>();
 for(const action of actions)for(const rule of rules){
  if(rule[0]!==action)continue;
  if(rule[1]==='button')state[rule[2]]=255;
  else if(rule[1]==='stick'){const [,,field,value]=rule;if(state[field]===-value||bothDown.has(field)){state[field]=0;bothDown.add(field);}else state[field]=value;}
  else{const [,,primary,secondary]=rule;if(state[primary]){state[primary]=0;state[secondary]=0;}else state[secondary]=255;}
 }
 return state;
}

/** The browser's bindings for each action, as the port's controls read them (the PC defaults differ; see
 * docs/FIDELITY_AUDIT.md "Player input"). Mouse-wheel weapon cycling and radio tuning are one-frame presses the
 * port consumes before the script runs, so they do not reach the pad. */
const BINDINGS:readonly (readonly [PadAction,readonly string[]])[]=[
 ['GO_FORWARD',['KeyW','ArrowUp']],['GO_BACK',['KeyS','ArrowDown']],['GO_LEFT',['KeyA','ArrowLeft']],['GO_RIGHT',['KeyD','ArrowRight']],
 ['PED_FIRE_WEAPON',['MouseFire','ControlLeft','ControlRight']],['PED_LOCK_TARGET',['MouseAim']],['GROUP_CONTROL_FWD',['KeyG']],
 ['PED_LOOKBEHIND',['MouseMiddle']],['PED_JUMPING',['Space']],['PED_SPRINT',['ShiftLeft','ShiftRight']],['PED_DUCK',['KeyC']],
 ['PED_SNIPER_ZOOM_IN',['PageUp','KeyX']],['PED_SNIPER_ZOOM_OUT',['PageDown','KeyZ']],['VEHICLE_ENTER_EXIT',['KeyF']],
 ['CAMERA_CHANGE_VIEW_ALL_SITUATIONS',['KeyV','Home']],
 ['VEHICLE_FIRE_WEAPON',['MouseFire','ControlLeft','ControlRight']],['VEHICLE_LOOKBEHIND',['MouseMiddle']],
 ['VEHICLE_LOOKLEFT',['KeyQ']],['VEHICLE_LOOKRIGHT',['KeyE']],['VEHICLE_HORN',['CapsLock','KeyH']],['VEHICLE_HANDBRAKE',['Space']],
 ['VEHICLE_ACCELERATE',['KeyW','ArrowUp']],['VEHICLE_BRAKE',['KeyS','ArrowDown']],
 ['VEHICLE_STEERLEFT',['KeyA','ArrowLeft']],['VEHICLE_STEERRIGHT',['KeyD','ArrowRight']],
 ['VEHICLE_TURRETLEFT',['Numpad4']],['VEHICLE_TURRETRIGHT',['Numpad6']],['VEHICLE_TURRETUP',['Numpad2']],['VEHICLE_TURRETDOWN',['Numpad8']],
];
/** The actions whose browser keys are down. */
export function heldPadActions(down:(code:string)=>boolean):PadAction[]{
 const out:PadAction[]=[];
 for(const [action,codes] of BINDINGS)if(codes.some(down))out.push(action);
 return out;
}
