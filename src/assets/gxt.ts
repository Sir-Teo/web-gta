/* CText (Text/Text.cpp), pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166: Load (0x6A01A0) reads the GXT's
 * version and encoding, the TABL of mission tables (CMissionTextOffsets), then the MAIN table's TKEY and TDAT;
 * LoadMissionText (0x69FBF0) reads one mission table (an eight-byte name, then its own TKEY and TDAT); Get (0x6A0050)
 * looks a key up in MAIN, then in the loaded mission table, and gives an empty string for a missing or blank key.
 * CKeyArray::Search hashes the upper-cased key with CKeyGen (the JAM CRC, a CRC-32 without its final inversion) and
 * binary-searches the sorted hashes. Strings are GXT characters, turned to text by GxtCharToUTF8's table. */
import {requireAsset} from './binary';

const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^c>>>1:c>>>1;t[n]=c>>>0;}return t;})();
/** CKeyGen::GetUppercaseKey: the JAM CRC of the key in upper case. */
export function gxtKeyHash(key:string){
 let c=0xffffffff;
 for(const ch of key.toUpperCase())c=CRC_TABLE[(c^ch.charCodeAt(0))&255]^c>>>8;
 return c>>>0;
}
/** GxtCharToUTF8's table: the font's accented letters above 0x7F, and three ASCII codes the font draws differently. */
const GXT_CHARS:Readonly<Record<number,string>>={0xb1:'´',0xaf:'¿',0x80:'À',0x81:'Á',0x82:'Â',0x83:'Ä',0x84:'Æ',0x85:'Ç',0x86:'È',0x87:'É',
 0x88:'Ê',0x89:'Ë',0x8a:'Ì',0x8b:'Í',0x8c:'Î',0x8d:'Ï',0xad:'Ñ',0x8e:'Ò',0x8f:'Ó',0x90:'Ô',0x91:'Ö',0x92:'Ù',0x93:'Ú',0x94:'Û',0x95:'Ü',
 0x96:'ß',0x97:'à',0x98:'á',0x99:'â',0x9a:'ä',0x9b:'æ',0x9c:'ç',0x9d:'è',0x9e:'é',0x9f:'ê',0xa0:'ë',0xa1:'ì',0xa2:'í',0xa3:'î',0xa4:'ï',
 0xae:'ñ',0xa5:'ò',0xa6:'ó',0xa7:'ô',0xa8:'ö',0xa9:'ù',0xaa:'ú',0xab:'û',0xac:'ü',0x5b:'<',0x5d:'>',0x5e:'¡'};
export function gxtCharsToText(bytes:Uint8Array){let out='';for(const b of bytes)out+=GXT_CHARS[b]??String.fromCharCode(b);return out;}

type Table=ReadonlyMap<number,string>;
export interface Gxt {
 main:Table;
 /** CMissionTextOffsets: each mission table's name and file offset. */
 missions:ReadonlyMap<string,number>;
 bytes:Uint8Array;
}
const ascii=(b:Uint8Array,at:number,n:number)=>String.fromCharCode(...b.subarray(at,at+n));
function readKeysAndText(b:Uint8Array,view:DataView,at:number):Map<number,string>{
 requireAsset(ascii(b,at,4)==='TKEY','GXT table lacks TKEY.');
 const keySize=view.getUint32(at+4,true),data=at+8+keySize;
 requireAsset(ascii(b,data,4)==='TDAT','GXT table lacks TDAT.');
 const text=data+8,out=new Map<number,string>();
 for(let k=0;k<keySize/8;k++){
  const offset=view.getUint32(at+8+k*8,true),hash=view.getUint32(at+12+k*8,true);
  let end=text+offset;while(b[end])end++;
  out.set(hash,gxtCharsToText(b.subarray(text+offset,end)));
 }
 return out;
}
export function readGxt(b:Uint8Array):Gxt{
 const view=new DataView(b.buffer,b.byteOffset,b.byteLength);
 requireAsset(view.getUint16(2,true)===8,'Only 8-bit GXT files are supported (the PC game encoding).');
 requireAsset(ascii(b,4,4)==='TABL','GXT lacks TABL.');
 const size=view.getUint32(8,true),missions=new Map<string,number>();let main:Map<number,string>|undefined;
 for(let i=0;i<size/12;i++){
  const at=12+i*12,name=ascii(b,at,8).replace(/\0.*$/,''),offset=view.getUint32(at+8,true);
  if(name==='MAIN')main=readKeysAndText(b,view,offset);else missions.set(name,offset);
 }
 requireAsset(main,'GXT lacks its MAIN table.');
 return {main,missions,bytes:b};
}

/** TheText. */
export class NativeText {
 private mission?:{name:string;table:Table};
 constructor(readonly gxt:Gxt){}
 /** CText::Get: MAIN first, then the loaded mission table; a blank or missing key gives "". */
 get(key:string){
  if(!key||key[0]===' ')return '';
  const hash=gxtKeyHash(key);
  return this.gxt.main.get(hash)??this.mission?.table.get(hash)??'';
 }
 /** Whether a key is in MAIN or the loaded mission table. */
 has(key:string){const hash=gxtKeyHash(key);return this.gxt.main.has(hash)||!!this.mission?.table.has(hash);}
 /** CText::LoadMissionText: the named mission table replaces the one loaded. */
 loadMissionText(name:string){
  const offset=this.gxt.missions.get(name);
  requireAsset(offset!==undefined,`GXT has no mission table ${name}.`);
  const b=this.gxt.bytes,view=new DataView(b.buffer,b.byteOffset,b.byteLength);
  this.mission={name,table:readKeysAndText(b,view,offset+8)};
 }
 get missionName(){return this.mission?.name??'';}
}
let loading:Promise<NativeText>|undefined,current:NativeText|undefined;
/** TheText once it has loaded. */
export const loadedText=()=>current;
/** TheText.Get(key), or the port's own wording until the text has loaded. */
export function gxtText(key:string,fallback:string){return current?.get(key)||fallback;}
/** CMessages::InsertNumberInString: each ~1~ in turn takes the next number (-1 past the ones given). */
export function insertNumbers(text:string,...numbers:number[]){let i=0;return text.replace(/~1~/g,()=>String(numbers[i++]??-1));}
/** The controls a ~k~ token names, as the browser binds them; any other shows its action name. */
const BROWSER_CONTROLS:Readonly<Record<string,string>>={VEHICLE_ENTER_EXIT:'F',PED_ANSWER_PHONE:'TAB',PED_SPRINT:'SHIFT',PED_JUMPING:'SPACE',PED_DUCK:'C',
 VEHICLE_RADIO_STATION_UP:'N',PED_FIREWEAPON:'LEFT MOUSE',PED_LOCK_TARGET:'RIGHT MOUSE',CAMERA_CHANGE_VIEW_ALL_SITUATIONS:'V',GROUP_CONTROL_FWD:'G',
 GROUP_CONTROL_BWD:'H',CONVERSATION_YES:'Y',CONVERSATION_NO:'N',TOGGLE_SUBMISSIONS:'2',GO_FORWARD:'W',GO_BACK:'S',GO_LEFT:'A',GO_RIGHT:'D',
 VEHICLE_ACCELERATE:'W',VEHICLE_BRAKE:'S',VEHICLE_STEERLEFT:'A',VEHICLE_STEERRIGHT:'D',VEHICLE_STEERUP:'UP',VEHICLE_STEERDOWN:'DOWN',
 VEHICLE_HANDBRAKE:'SPACE',VEHICLE_HORN:'H',VEHICLE_LOOKLEFT:'Q',VEHICLE_LOOKRIGHT:'E',PED_LOOKBEHIND:'MIDDLE MOUSE',
 PED_SNIPER_ZOOM_IN:'PGUP',PED_SNIPER_ZOOM_OUT:'PGDN',PED_CYCLE_WEAPON_LEFT:'Q',PED_CYCLE_WEAPON_RIGHT:'E',
 VEHICLE_TURRETUP:'NUM 2',VEHICLE_TURRETDOWN:'NUM 8',VEHICLE_TURRETLEFT:'NUM 4',VEHICLE_TURRETRIGHT:'NUM 6',SNEAK_ABOUT:'ALT'};
/** The same controls named by the touch controls' buttons (src/input/TouchControls.ts), the stick for the movement
 * keys; the ones with no button there keep their key. */
const TOUCH_CONTROLS:Readonly<Record<string,string>>={VEHICLE_ENTER_EXIT:'ENTER',PED_ANSWER_PHONE:'ACTION',PED_SPRINT:'SPRINT',PED_JUMPING:'JUMP',PED_DUCK:'CROUCH',
 PED_FIREWEAPON:'FIRE',PED_LOCK_TARGET:'AIM',GROUP_CONTROL_FWD:'FOLLOW',GROUP_CONTROL_BWD:'STAY',CONVERSATION_YES:'YES',CONVERSATION_NO:'NO',TOGGLE_SUBMISSIONS:'MISSION',
 GO_FORWARD:'STICK UP',GO_BACK:'STICK DOWN',GO_LEFT:'STICK LEFT',GO_RIGHT:'STICK RIGHT',VEHICLE_ACCELERATE:'GAS',VEHICLE_BRAKE:'BRAKE',
 VEHICLE_STEERLEFT:'STICK LEFT',VEHICLE_STEERRIGHT:'STICK RIGHT',VEHICLE_STEERUP:'STICK UP',VEHICLE_STEERDOWN:'STICK DOWN',VEHICLE_HANDBRAKE:'H-BRAKE',
 VEHICLE_HORN:'HORN',VEHICLE_LOOKLEFT:'◀ LOOK',VEHICLE_LOOKRIGHT:'LOOK ▶',VEHICLE_LOOKBEHIND:'LOOK BACK',PED_LOOKBEHIND:'LOOK BACK',
 PED_CYCLE_WEAPON_LEFT:'WEAPON',PED_CYCLE_WEAPON_RIGHT:'WEAPON',VEHICLE_RADIO_STATION_UP:'RADIO',VEHICLE_RADIO_STATION_DOWN:'RADIO',
 // The vehicle's fire, and its alternative (a drive-by, the BMX's hop, a gunship's guns), are the Fire button.
 VEHICLE_FIREWEAPON:'FIRE',VEHICLE_FIREWEAPON_ALT:'FIRE',CAMERA_CHANGE_VIEW_ALL_SITUATIONS:'CAMERA',PED_SNIPER_ZOOM_IN:'ZOOM +',PED_SNIPER_ZOOM_OUT:'ZOOM −',
 // Sneaking is the stick pushed part way (the touch stick holds the walk key under half way): see SNEAK_PHRASE.
 SNEAK_ABOUT:'STICK'};
/** Flying, the look keys are the rudder (the touch controls' Yaw buttons) and the on-foot fire the rockets (Rocket). */
const TOUCH_FLYING:Readonly<Record<string,string>>={VEHICLE_LOOKLEFT:'◀ YAW',VEHICLE_LOOKRIGHT:'YAW ▶',PED_FIREWEAPON:'ROCKET'};
/** A vehicle's left and right by the steering the touch settings chose: the stick, the arrow buttons or the tilt. */
const TOUCH_STEERING:Readonly<Record<'stick'|'arrows'|'tilt',Readonly<Record<string,string>>>>={
 stick:{},arrows:{VEHICLE_STEERLEFT:'LEFT ARROW',VEHICLE_STEERRIGHT:'RIGHT ARROW'},tilt:{VEHICLE_STEERLEFT:'TILT LEFT',VEHICLE_STEERRIGHT:'TILT RIGHT'}};
/** A run of one control's directions, as a help text lists the movement keys ("W, S, A and D"), is that one control on
 * a touch screen: "the STICK", "the ARROWS", "TILT". */
const DIRECTION_RUNS:readonly (readonly [RegExp,string])[]=[
 [/STICK (?:UP|DOWN|LEFT|RIGHT)(?:(?:,? and |, | or |\/)STICK (?:UP|DOWN|LEFT|RIGHT))+/g,'the STICK'],
 [/(?:LEFT|RIGHT) ARROW(?:(?:,? and |, | or |\/)(?:LEFT|RIGHT) ARROW)+/g,'the ARROWS'],
 [/TILT (?:LEFT|RIGHT)(?:(?:,? and |, | or |\/)TILT (?:LEFT|RIGHT))+/g,'TILT'],
 [/LEFT STICK (?:UP|DOWN|LEFT|RIGHT)(?:(?:,? and |, | or |\/)LEFT STICK (?:UP|DOWN|LEFT|RIGHT))+/g,'the LEFT STICK']];
/** The PC's sneak help holds a key down ("Hold down the ALT key to sneak."): a stick sneaks pushed only part way. */
const SNEAK_PHRASE:readonly [RegExp,string]=[/Hold down the ((?:LEFT )?STICK) key to sneak/g,'Push the $1 only part way to sneak'];
/** A game controller's buttons, by the place each has on the pad (src/input/GamepadInput's PS2 layout): a PlayStation
 * pad's names, and the Xbox letters in the same places that MFi and most other pads print. */
const PAD_BUTTON_NAMES:Readonly<Record<string,readonly [string,string]>>={cross:['CROSS','A'],circle:['CIRCLE','B'],square:['SQUARE','X'],triangle:['TRIANGLE','Y'],
 l1:['L1','LB'],r1:['R1','RB'],l2:['L2','LT'],r2:['R2','RT'],l3:['L3','LS'],r3:['R3','RS'],select:['SELECT','VIEW'],
 up:['D-PAD UP','D-PAD UP'],down:['D-PAD DOWN','D-PAD DOWN'],left:['D-PAD LEFT','D-PAD LEFT'],right:['D-PAD RIGHT','D-PAD RIGHT']};
/** The pad button each control is on, on foot and at the wheel (their actions are apart), and what flying moves. */
const PAD_PLACES:Readonly<Record<string,string>>={PED_SPRINT:'cross',PED_JUMPING:'square',VEHICLE_ENTER_EXIT:'triangle',PED_FIREWEAPON:'circle',
 PED_LOCK_TARGET:'r1',PED_ANSWER_PHONE:'l1',PED_CYCLE_WEAPON_LEFT:'l2',PED_CYCLE_WEAPON_RIGHT:'r2',PED_DUCK:'l3',PED_LOOKBEHIND:'r3',
 CAMERA_CHANGE_VIEW_ALL_SITUATIONS:'select',GROUP_CONTROL_FWD:'up',GROUP_CONTROL_BWD:'down',CONVERSATION_NO:'left',CONVERSATION_YES:'right',
 PED_SNIPER_ZOOM_IN:'square',PED_SNIPER_ZOOM_OUT:'cross',VEHICLE_ACCELERATE:'cross',VEHICLE_BRAKE:'square',VEHICLE_HANDBRAKE:'r1',
 VEHICLE_FIREWEAPON:'circle',VEHICLE_FIREWEAPON_ALT:'circle',VEHICLE_LOOKLEFT:'l2',VEHICLE_LOOKRIGHT:'r2',VEHICLE_HORN:'l1',TOGGLE_SUBMISSIONS:'r3',
 VEHICLE_RADIO_STATION_UP:'up',VEHICLE_RADIO_STATION_DOWN:'down'};
const PAD_FLYING_PLACES:Readonly<Record<string,string>>={VEHICLE_FIREWEAPON_ALT:'l1',VEHICLE_HORN:'l3'};
const PAD_STICKS:Readonly<Record<string,string>>={GO_FORWARD:'LEFT STICK UP',GO_BACK:'LEFT STICK DOWN',GO_LEFT:'LEFT STICK LEFT',GO_RIGHT:'LEFT STICK RIGHT',
 VEHICLE_STEERLEFT:'LEFT STICK LEFT',VEHICLE_STEERRIGHT:'LEFT STICK RIGHT',VEHICLE_STEERUP:'LEFT STICK UP',VEHICLE_STEERDOWN:'LEFT STICK DOWN',SNEAK_ABOUT:'LEFT STICK'};
function padControlNames(family:'playstation'|'xbox',flying:boolean){
 const out:Record<string,string>={...PAD_STICKS},column=family==='playstation'?0:1;
 for(const [action,place] of Object.entries({...PAD_PLACES,...flying?PAD_FLYING_PLACES:{}}))out[action]=PAD_BUTTON_NAMES[place][column];
 return out;
}
/** A script menu up on a touch screen: its pills (▲ ▼ ◀ ▶, Select and Back) stand where the stick and the buttons were,
 * and the shop's help names them ("Use ▲ and ▼ to select a haircut. SELECT = View"). */
const TOUCH_MENU:Readonly<Record<string,string>>={GO_FORWARD:'▲',GO_BACK:'▼',GO_LEFT:'◀',GO_RIGHT:'▶',VEHICLE_STEERUP:'▲',VEHICLE_STEERDOWN:'▼',
 VEHICLE_STEERLEFT:'◀',VEHICLE_STEERRIGHT:'▶',PED_SPRINT:'SELECT',VEHICLE_ENTER_EXIT:'BACK'};
/** How the HUD's text names controls: by the keys, the touch buttons (the steering as the settings give it, a script
 * menu's own while one is up), or a game controller's buttons while one is played; flying, by an aircraft's buttons. */
interface ControlNaming{touch:boolean;steering:'stick'|'arrows'|'tilt';flying:boolean;menu?:boolean;pad?:'playstation'|'xbox'}
let naming:ControlNaming={touch:false,steering:'stick',flying:false},controlNames=BROWSER_CONTROLS,touchNames=false;
function rebuildControlNames(){
 touchNames=naming.touch||!!naming.pad;
 controlNames=naming.pad?{...BROWSER_CONTROLS,...padControlNames(naming.pad,naming.flying)}
  :naming.touch?{...BROWSER_CONTROLS,...TOUCH_CONTROLS,...TOUCH_STEERING[naming.steering],...naming.flying?TOUCH_FLYING:{},...naming.menu?TOUCH_MENU:{}}:BROWSER_CONTROLS;
}
/** Name the controls in HUD text by the touch buttons rather than the keys: the steering as the settings give it, and
 * the buttons an aircraft has while flying. Left out, the steering and the flying stay as they were; off, the keys
 * again and everything else forgotten. */
export function useTouchControlNames(touch:boolean,steering=naming.steering,flying=naming.flying){
 naming=touch?{...naming,touch,steering,flying}:{touch:false,steering:'stick',flying:false};rebuildControlNames();
}
/** Whether the player flies, and which game controller (if any) is being played, for the names. */
export function setControlNaming(next:{flying?:boolean;menu?:boolean;pad?:'playstation'|'xbox'|undefined}){
 naming={...naming,...next};rebuildControlNames();
}
/** The controls each recent HUD text named, by the text gxtHudText made: the touch controls show a button for a
 * control the help box asks for that has none of its own (a yes-or-no question, collecting a pickup). */
const NAMED=new Map<string,readonly string[]>();
export function controlsNamedIn(text:string):readonly string[]{return NAMED.get(text)??[];}
/** The browser HUD draws plain text: ~n~ breaks the line, a ~k~ control names its key, and colour and style tokens
 * (~w~, ~r~, ~h~, ~z~ and the rest) drop. */
export function gxtHudText(text:string){
 const named:string[]=[];
 let out=text.replace(/~k~~([A-Z0-9_]+)~/g,(_,action:string)=>{named.push(action);return controlNames[action]??action.replace(/_/g,' ');}).replace(/~n~/gi,'\n').replace(/~[a-z]~/gi,'');
 if(touchNames){for(const [run,name] of DIRECTION_RUNS)out=out.replace(run,name);out=out.replace(...SNEAK_PHRASE);
  // Two controls one button stands for ("RADIO and RADIO", "FIRE or FIRE") are named once.
  out=out.replace(/(?<![A-Z0-9+−◀▶-]|[A-Z0-9+−◀▶-] )([A-Z][A-Z0-9 +−◀▶-]*[A-Z0-9+−◀▶])(?:,? (?:and|or) |\/)\1(?![A-Za-z0-9+−◀▶-]| [A-Z0-9+−◀▶-])/g,'$1');}
 if(named.length){NAMED.delete(out);NAMED.set(out,named);if(NAMED.size>64)NAMED.delete(NAMED.keys().next().value!);}
 return out;
}
/** TheText from the published text/american.gxt, loaded once. */
export function loadNativeText(base:string){
 loading??=import('./staticWorldArchive').then(async({openStaticWorld})=>{
  const source=await openStaticWorld(base),resource=source.manifest.resources.find(r=>r.path==='text/american.gxt');
  requireAsset(resource,'AMERICAN.GXT is not published.');
  return current=new NativeText(readGxt(new Uint8Array(await (await source.resource(resource)).arrayBuffer())));
 });
 return loading;
}
