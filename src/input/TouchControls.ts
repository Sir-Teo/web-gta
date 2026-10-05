import type {Input} from './Input';
import {gyroLook} from './gyroAim';
import {ANALOG_SENSITIVITY_RANGE,BUTTON_SCALE_RANGE,DEFAULT_TOUCH,DRAW_DISTANCE_RANGE,LAYOUT_RANGE,LOOK_SPEED_RANGE,tiltSteering,type LayoutEntry,type TouchSettings} from './touchSettings';
import {touchIconSvg,type TouchIcon} from './touchIcons';
import {touchHaptic} from './haptics';
/* Touch-screen controls for phones and tablets, laid over the game the way the mobile ports lay theirs: a floating
 * stick under the left thumb, the camera dragged with the right, and the buttons round the right thumb. Every control
 * feeds the same Input the keyboard and mouse do (the stick as CPad's analog left stick, the buttons as the PC keys
 * the game already reads), so nothing past Input knows the difference.
 *
 * Shown when the device's main pointer is coarse (a finger), or with ?touch=1 in the address; ?touch=0 hides it. */
export function wantsTouchControls(search=location.search,coarse=typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches){
 const flag=new URLSearchParams(search).get('touch');
 if(flag==='1')return true;if(flag==='0')return false;
 return coarse;
}
/** A phone's browser keeps its address bar over the game and turns the page with the device. Started from a tap, the
 * game takes the whole screen and holds it sideways, as the mobile ports run. Either can be refused (an iPhone has no
 * element fullscreen, and only a fullscreen page may lock its orientation); the game then plays on as the page is. */
export async function goFullscreen(root:Element=document.documentElement,doc:Pick<Document,'fullscreenElement'>=document,orientation:{lock?:(o:string)=>Promise<void>}|undefined=globalThis.screen?.orientation as any){
 try{
  if(!doc.fullscreenElement&&!(doc as any).webkitFullscreenElement){
   if(root.requestFullscreen)await root.requestFullscreen({navigationUI:'hide'});
   else if((root as any).webkitRequestFullscreen)(root as any).webkitRequestFullscreen();
   else return;
  }
  await orientation?.lock?.('landscape');
 }catch{/* refused: play on as the page is */}
}
/** Whether to suggest the home screen: an iPhone's browser has no element fullscreen to take, but the game added to the
 * home screen opens without the browser's bars (the manifest's display). Not once it has been opened from there. */
export function suggestHomeScreen(root:{requestFullscreen?:unknown;webkitRequestFullscreen?:unknown}=document.documentElement,
 nav:{userAgent:string;standalone?:boolean}=navigator,fromHomeScreen=globalThis.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)').matches??false){
 return /iPhone|iPod/.test(nav.userAgent)&&!root.requestFullscreen&&!root.webkitRequestFullscreen&&nav.standalone!==true&&!fromHomeScreen;
}
/** The install offer Android's browser makes (BeforeInstallPromptEvent): its prompt and the player's answer. */
interface InstallOffer extends Event {prompt():Promise<unknown>;readonly userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
/** Android's browser offers to install a page that has a manifest (beforeinstallprompt), in a bar of its own: on a
 * touch screen the menu's Add to Home screen button takes the offer instead, and the game then opens from the home
 * screen full screen and sideways, as the manifest asks. The button shows while an offer stands. */
export function offerInstall(button:HTMLButtonElement,target:EventTarget=window){
 let offer:InstallOffer|undefined;
 const onOffer=(e:Event)=>{e.preventDefault();offer=e as InstallOffer;button.hidden=false;};
 const onInstalled=()=>{offer=undefined;button.hidden=true;};
 target.addEventListener('beforeinstallprompt',onOffer);target.addEventListener('appinstalled',onInstalled);
 button.onclick=()=>{const taken=offer;if(!taken)return;offer=undefined;button.hidden=true;void taken.prompt().catch(()=>{});};
 return ()=>{target.removeEventListener('beforeinstallprompt',onOffer);target.removeEventListener('appinstalled',onInstalled);};
}
/** The touch buttons' glyphs by the name help text gives them (gxt's touch naming): the mobile ports draw a widget's own
 * symbol in the help text where the PC prints its key. Fire shows the weapon in hand, so it keeps its word alone. */
const HELP_ICONS:Readonly<Record<string,TouchIcon>>={ENTER:'car',SPRINT:'run',JUMP:'jump',CROUCH:'crouch',AIM:'target',GAS:'up',BRAKE:'down',
 'H-BRAKE':'parking',HORN:'horn',RADIO:'music','LOOK BACK':'eye',CAMERA:'camera','ZOOM +':'zoomIn','ZOOM −':'zoomOut',ROCKET:'rocket',
 '◀ YAW':'left','YAW ▶':'right','◀ LOOK':'shootLeft','LOOK ▶':'shootRight','LEFT ARROW':'left','RIGHT ARROW':'right',YES:'thumbUp',NO:'thumbDown',SELECT:'check',BACK:'close',
 // The stick, one direction or the whole of it (a run of its directions is "the STICK").
 STICK:'stick','STICK UP':'stick','STICK DOWN':'stick','STICK LEFT':'stick','STICK RIGHT':'stick'};
/** A played pad's buttons as the PS2 original's help drew them: the face buttons a symbol in the button's colour (a
 * PlayStation pad's shapes, the letters MFi and Xbox pads print in theirs), the shoulders, stick clicks and select
 * grey chips with their names, the D-pad its arrows. */
const PAD_GREY='#d6d6d6',padChips=(names:readonly string[])=>Object.fromEntries(names.map(name=>[name,{glyph:name,colour:PAD_GREY}]));
/** The D-pad's directions as its arrows, the same on both families. */
const DPAD={'D-PAD UP':{glyph:'▲',colour:PAD_GREY},'D-PAD DOWN':{glyph:'▼',colour:PAD_GREY},'D-PAD LEFT':{glyph:'◀',colour:PAD_GREY},'D-PAD RIGHT':{glyph:'▶',colour:PAD_GREY}};
const PAD_GLYPHS:Readonly<Record<'playstation'|'xbox',Readonly<Record<string,{glyph:string;colour:string}>>>>={
 playstation:{CROSS:{glyph:'✕',colour:'#7fb2ff'},CIRCLE:{glyph:'○',colour:'#ff6f6f'},SQUARE:{glyph:'□',colour:'#f39ad7'},TRIANGLE:{glyph:'△',colour:'#5fd9a6'},
  ...padChips(['L1','R1','L2','R2','L3','R3','SELECT']),...DPAD},
 xbox:{A:{glyph:'A',colour:'#6cc24a'},B:{glyph:'B',colour:'#e8473d'},X:{glyph:'X',colour:'#3f8fe0'},Y:{glyph:'Y',colour:'#f2c230'},
  ...padChips(['LB','RB','LT','RT','LS','RS','VIEW']),...DPAD}};
/** The help box's text with each button it names drawn as the button: with the touch controls a button's glyph before its
 * name, with a pad its face buttons' symbols in place of their names. Only the names the text's ~k~ tokens put there
 * (`named`, their actions; `nameOf`, what each is called now) are drawn, so a capitalised word of its own stays. */
export function showHelpIcons(box:HTMLElement,text:string,named:readonly string[],nameOf:(action:string)=>string|undefined,naming:'keys'|'touch'|'playstation'|'xbox'='touch'){
 const pad=naming==='playstation'||naming==='xbox'?PAD_GLYPHS[naming]:undefined,drawn=pad??(naming==='touch'?HELP_ICONS:{});
 const called=named.map(nameOf).filter((n):n is string=>!!n);
 // A run of the stick's directions reads "the STICK" (gxt's DIRECTION_RUNS).
 if(!pad&&called.some(n=>n.startsWith('STICK ')))called.push('STICK');
 const names=[...new Set(called.filter(n=>n in drawn))].sort((a,b)=>b.length-a.length);
 if(!names.length)return;
 const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),pattern=new RegExp(`(?<![A-Za-z])(${names.map(escape).join('|')})(?![A-Za-z])`,'g');
 const parts=text.split(pattern);if(parts.length<2)return;
 box.replaceChildren(...parts.map((part,i)=>{
  if(i%2===0)return document.createTextNode(part);
  const key=document.createElement('span');
  if(pad){const {glyph,colour}=pad[part];key.className='help-key pad';key.textContent=glyph;key.style.color=colour;key.setAttribute('role','img');key.setAttribute('aria-label',part);return key;}
  key.className='help-key';key.innerHTML=touchIconSvg(HELP_ICONS[part]);key.append(part);return key;
 }));
}
/** What the player is doing, which picks the buttons shown. */
export type TouchMode='foot'|'scope'|'swim'|'vehicle'|'aircraft'|'cutscene';
/** The layouts the buttons are adjusted in: on foot's serves the scope and the water, whose buttons share its slots. */
type LayoutGroup='foot'|'vehicle'|'aircraft';
const layoutGroup=(mode:TouchMode):LayoutGroup=>mode==='vehicle'||mode==='aircraft'?mode:'foot';
/** The round widgets' sizes, by the names the port's layout files give them: CTouchInterface reads SCALE_SMALL as 17,
 * SCALE_MEDIUM 24, SCALE_LARGE 29 and SCALE_LARGER 32, half a widget's width on its 640-wide screen. A button keeps
 * round by sizing its height by the width too (CWidgetButton's flag), so it grows with the screen's width. */
export const PORT_SIZE={small:17,medium:24,large:29,larger:32} as const;
type PortPlace=readonly [x:number,y:number,size:keyof typeof PORT_SIZE];
/** The port's four default layouts. It loads one by the device and the screen's shape: a phone's or an iPad's (the
 * UIDevice idiom), each for a screen at least 3:2 across or narrower (TouchDefaultTablet4x3.cfg, an iPad's 4:3). */
export type PortLayoutFile='TouchDefaultPhoneWidescreen'|'TouchDefaultPhone3x2'|'TouchDefaultTabletWidescreen'|'TouchDefaultTablet4x3';
export function portLayoutFile(width:number,height:number,tablet:boolean):PortLayoutFile{
 const wide=width/height>=1.5;
 return tablet?wide?'TouchDefaultTabletWidescreen':'TouchDefaultTablet4x3':wide?'TouchDefaultPhoneWidescreen':'TouchDefaultPhone3x2';
}
/** A tablet by the browser's measure of the screen: its short side 600 CSS pixels or more, Android's own line for one
 * (smallest width 600dp). Every iPad is wider than that and every phone narrower. */
export const isTabletScreen=(screen:{width:number;height:number}|undefined=globalThis.screen)=>!!screen&&Math.min(screen.width,screen.height)>=600;
type PortWidget='VEHICLE_SHOOT_LEFT'|'VEHICLE_SHOOT_RIGHT'|'TARGETING_AND_ATTACK'|'VC_SHOOT'|'ENTER_CAR'|'BUTTON_SPRINT_AND_SWIM'|'SKIP_CUTSCENE'|'ACCELERATE'|'BRAKE'|'HANDBRAKE_AND_AIR_SHOOT'|'CAR_SHOOT'|'HORN'|'HYDRAULICS'|'VEHICLE_STEER_LEFT'|'VEHICLE_STEER_RIGHT'|'PED_MOVE'|'POSITIVE'|'NEGATIVE'|'STORE_ACCEPT'|'STORE_CANCEL';
/** The widgets the touch buttons stand at, from each file: a widget's centre on the port's 640×448 screen, which the
 * touch layer lays over the safe area, and its size (PED_MOVE, where a thumb takes the stick, is a region: its right
 * edge and its top). */
const PORT_WIDGETS:Readonly<Record<PortLayoutFile,Readonly<Record<PortWidget,PortPlace>>>>={
 TouchDefaultPhoneWidescreen:{VEHICLE_SHOOT_LEFT:[42,310,'medium'],VEHICLE_SHOOT_RIGHT:[97,310,'medium'],TARGETING_AND_ATTACK:[607,310,'medium'],VC_SHOOT:[553,310,'medium'],ENTER_CAR:[607,246,'medium'],BUTTON_SPRINT_AND_SWIM:[603,381,'large'],SKIP_CUTSCENE:[611,34,'medium'],
  ACCELERATE:[602,380,'large'],BRAKE:[541,381,'large'],HANDBRAKE_AND_AIR_SHOOT:[607,310,'medium'],CAR_SHOOT:[554,310,'medium'],HORN:[614,191,'small'],HYDRAULICS:[554,245,'medium'],
  VEHICLE_STEER_LEFT:[36,380,'large'],VEHICLE_STEER_RIGHT:[99,381,'large'],PED_MOVE:[240,248,'medium'],POSITIVE:[390,424,'small'],NEGATIVE:[240,424,'small'],STORE_ACCEPT:[535,405,'large'],STORE_CANCEL:[600,405,'large']},
 TouchDefaultPhone3x2:{VEHICLE_SHOOT_LEFT:[41,315,'large'],VEHICLE_SHOOT_RIGHT:[106,315,'large'],TARGETING_AND_ATTACK:[599,315,'large'],VC_SHOOT:[538,315,'large'],ENTER_CAR:[600,251,'large'],BUTTON_SPRINT_AND_SWIM:[598,383,'larger'],SKIP_CUTSCENE:[612,30,'medium'],
  ACCELERATE:[598,383,'larger'],BRAKE:[529,383,'larger'],HANDBRAKE_AND_AIR_SHOOT:[601,315,'large'],CAR_SHOOT:[538,315,'large'],HORN:[606,139,'medium'],HYDRAULICS:[538,249,'large'],
  VEHICLE_STEER_LEFT:[41,383,'larger'],VEHICLE_STEER_RIGHT:[111,383,'larger'],PED_MOVE:[240,248,'medium'],POSITIVE:[390,424,'small'],NEGATIVE:[240,424,'small'],STORE_ACCEPT:[530,415,'large'],STORE_CANCEL:[600,415,'large']},
 TouchDefaultTabletWidescreen:{VEHICLE_SHOOT_LEFT:[42,310,'medium'],VEHICLE_SHOOT_RIGHT:[97,310,'medium'],TARGETING_AND_ATTACK:[606,310,'medium'],VC_SHOOT:[554,310,'medium'],ENTER_CAR:[606,245,'medium'],BUTTON_SPRINT_AND_SWIM:[601,380,'large'],SKIP_CUTSCENE:[611,34,'medium'],
  ACCELERATE:[601,380,'large'],BRAKE:[541,380,'large'],HANDBRAKE_AND_AIR_SHOOT:[606,310,'medium'],CAR_SHOOT:[554,310,'medium'],HORN:[613,185,'small'],HYDRAULICS:[554,245,'medium'],
  VEHICLE_STEER_LEFT:[38,380,'large'],VEHICLE_STEER_RIGHT:[99,380,'large'],PED_MOVE:[180,268,'medium'],POSITIVE:[390,424,'small'],NEGATIVE:[240,424,'small'],STORE_ACCEPT:[565,415,'small'],STORE_CANCEL:[605,415,'small']},
 // An iPad's 4:3 has its rows lower and the attack inside the aim.
 TouchDefaultTablet4x3:{VEHICLE_SHOOT_LEFT:[42,335,'medium'],VEHICLE_SHOOT_RIGHT:[97,335,'medium'],TARGETING_AND_ATTACK:[552,335,'medium'],VC_SHOOT:[605,335,'medium'],ENTER_CAR:[605,284,'medium'],BUTTON_SPRINT_AND_SWIM:[601,389,'large'],SKIP_CUTSCENE:[611,27,'medium'],
  ACCELERATE:[601,389,'large'],BRAKE:[539,389,'large'],HANDBRAKE_AND_AIR_SHOOT:[605,335,'medium'],CAR_SHOOT:[552,335,'medium'],HORN:[612,240,'small'],HYDRAULICS:[552,284,'medium'],
  VEHICLE_STEER_LEFT:[38,389,'large'],VEHICLE_STEER_RIGHT:[100,389,'large'],PED_MOVE:[210,268,'medium'],POSITIVE:[458,71,'small'],NEGATIVE:[412,71,'small'],STORE_ACCEPT:[547,415,'medium'],STORE_CANCEL:[600,415,'medium']}};
/** Each layout's buttons at the port's widgets. On foot: Fire is TARGETING_AND_ATTACK, Aim VC_SHOOT, Enter ENTER_CAR,
 * Sprint (Swim, Zoom −) BUTTON_SPRINT_AND_SWIM, Skip SKIP_CUTSCENE; at the wheel Gas and Brake are ACCELERATE and BRAKE,
 * H-brake HANDBRAKE_AND_AIR_SHOOT, Fire CAR_SHOOT, Horn HORN, the arrows VEHICLE_STEER_LEFT and _RIGHT and, while a
 * drive-by can be fired, ◀ Look and Look ▶ VEHICLE_SHOOT_LEFT and _RIGHT above them; flying, Fire is
 * AIR_SHOOT and Rocket CAR_SHOOT's place. The buttons the port has no widget for take free places of its grid: Jump and
 * Radio the hydraulics' (where a phone's weapon swap stands; the HUD's weapon icon swaps here), Crouch, Reload, Look back
 * and Nitrous a column further in, as far in again as the hydraulics are from the enter button (the phone's row above
 * stays clear, as the port's is but for a call: the wanted stars hang there under the status), the yaw there too. */
function portLayout(file:PortLayoutFile):Readonly<Record<LayoutGroup,Readonly<Record<string,PortPlace>>>>{
 const w=PORT_WIDGETS[file],[outer]=w.ENTER_CAR,[second,upper,size]=w.HYDRAULICS,lower=w.CAR_SHOOT[1],inner=2*second-outer;
 return {
  foot:{fire:w.TARGETING_AND_ATTACK,aim:w.VC_SHOOT,enter:w.ENTER_CAR,sprint:w.BUTTON_SPRINT_AND_SWIM,jump:w.HYDRAULICS,crouch:[inner,upper,size],reload:[inner,lower,size],skip:w.SKIP_CUTSCENE},
  vehicle:{gas:w.ACCELERATE,reverse:w.BRAKE,jump:w.HANDBRAKE_AND_AIR_SHOOT,fire:w.CAR_SHOOT,enter:w.ENTER_CAR,sprint:w.HORN,radio:w.HYDRAULICS,crouch:[inner,upper,size],
   nitro:[inner,lower,size],'steer-left':w.VEHICLE_STEER_LEFT,'steer-right':w.VEHICLE_STEER_RIGHT,'look-left':w.VEHICLE_SHOOT_LEFT,'look-right':w.VEHICLE_SHOOT_RIGHT,'reply-yes':w.POSITIVE,'reply-no':w.NEGATIVE,'store-accept':w.STORE_ACCEPT,'store-cancel':w.STORE_CANCEL},
  aircraft:{gas:w.ACCELERATE,reverse:w.BRAKE,fire:w.HANDBRAKE_AND_AIR_SHOOT,rocket:w.CAR_SHOOT,jump:w.HYDRAULICS,enter:w.ENTER_CAR,'yaw-left':[inner,upper,size],'yaw-right':[inner,lower,size]}};
}
export const PORT_LAYOUTS=Object.fromEntries((Object.keys(PORT_WIDGETS) as PortLayoutFile[]).map(file=>[file,portLayout(file)])) as Readonly<Record<PortLayoutFile,ReturnType<typeof portLayout>>>;
/** What the CSS lays round the buttons by the layout in use: the innermost column's place and size (the subtitles,
 * pills and prompts keep left of it), the enter row (the pills stand level with it), the stick's region and the steering
 * arrows' outer edge. */
export function portLayoutFrame(file:PortLayoutFile):Readonly<Record<string,number>>{
 const w=PORT_WIDGETS[file],layout=PORT_LAYOUTS[file].foot,[inner,,size]=layout.crouch,right=w.VEHICLE_STEER_RIGHT;
 return {'--touch-inner':inner,'--touch-inner-r':PORT_SIZE[size],'--touch-row':w.ENTER_CAR[1],'--touch-stick-w':w.PED_MOVE[0],'--touch-stick-top':w.PED_MOVE[1],
  '--touch-arrows-x':right[0],'--touch-arrows-r':PORT_SIZE[right[2]]};
}
/** A button: its label, the key or mouse button it holds, whether a tap latches it (aim) rather than holds it, the
 * modes it shows in (all of them when unset), whether it shows only while the game offers it (setOffered), as the
 * mobile ports show their enter-vehicle button only beside a vehicle, and whether only the driver has it (a passenger
 * has no pedals, wheel or horn). */
interface ButtonSpec {label:string;code:string;className:string;toggle?:boolean;modes?:readonly TouchMode[];contextual?:boolean;icon?:TouchIcon;steering?:TouchSettings['steering'];driver?:boolean;
 /** A thumb slid onto another such button presses that one instead, as the ports' widgets answer whichever one a
  * touch is over each frame: rocking from Gas to Brake, across the steering arrows or the rudder. */
 slide?:boolean;
 /** Hidden while the game offers this other button, which does its work (the horn in a car with hydraulics). */
 givesWayTo?:string;
 /** A tap presses `code` for a frame; a drag is the car-gun stick (the Hydraulics button). */
 carGun?:boolean;
 /** Stands at another button's place (and moves with it in Adjust controls), the one it stands in for. */
 slot?:string;
 /** In these modes a finger held on it and moved turns the camera as the look drag does. */
 looksIn?:readonly TouchMode[];
 /** A tap, or a swipe to the right, presses `code` for a frame and a swipe to the left this code: the port's
  * SWIPE_RADIO_UP and _DOWN widgets, one place swiped either way, on the Radio button. */
 swipeBack?:string}
const BUTTONS:ButtonSpec[]=[
 // Fire held on foot or through a scope also aims: a finger that slides from it turns the camera as the look drag does
 // (the port's SHOOT_LOOK region round its attack button), so one thumb shoots and aims.
 {label:'Fire',code:'ControlLeft',className:'fire',modes:['foot','scope','vehicle','aircraft'],givesWayTo:'hop',looksIn:['foot','scope']},
 // On a bicycle the car's weapon button is the bunny hop (CBmx::ProcessBunnyHop reads it): the port's BUNNY_HOP widget,
 // at the fire button's place.
 {label:'Bunny hop',code:'ControlLeft',className:'hop',modes:['vehicle'],contextual:true,icon:'jump',driver:true,slot:'fire'},
 {label:'Aim',code:'MouseAim',className:'aim',toggle:true,modes:['foot','scope'],icon:'target'},
 {label:'Jump',code:'Space',className:'jump',modes:['foot','swim'],icon:'jump'},
 {label:'H-brake',code:'Space',className:'jump',modes:['vehicle'],icon:'parking',driver:true,slide:true},
 {label:'Sprint',code:'ShiftLeft',className:'sprint',modes:['foot'],icon:'run'},
 {label:'Horn',code:'KeyH',className:'sprint',modes:['vehicle'],icon:'horn',driver:true,givesWayTo:'hydraulics'},
 {label:'Enter',code:'KeyF',className:'enter',contextual:true,icon:'car'},
 {label:'Crouch',code:'KeyC',className:'crouch',modes:['foot','scope'],icon:'crouch'},
 // At the wheel the eye looks behind (both look keys together, the PC's middle button); left and right come above the
 // buttons when a drive-by can be fired or a help text asks.
 {label:'Look back',code:'MouseMiddle',className:'crouch',modes:['vehicle'],icon:'eye'},
 {label:'Reload',code:'KeyR',className:'reload',modes:['foot','scope'],icon:'reload'},
 // At the wheel the right thumb has the pedals, as the mobile ports give it, so the stick can steer to full lock
 // while the car accelerates (a stick pushed only sideways is no push forward).
 {label:'Gas',code:'KeyW',className:'gas',modes:['vehicle'],icon:'up',driver:true,slide:true},
 {label:'Brake',code:'KeyS',className:'reverse',modes:['vehicle'],icon:'down',driver:true,slide:true},
 // N tunes the radio on to the next station, as a tap does; a swipe to the left tunes back (the mobile ports swipe for
 // it, either way: the PC's Shift+N).
 {label:'Radio',code:'KeyN',className:'radio',modes:['vehicle'],contextual:true,icon:'music',swipeBack:'RadioBack'},
 // A car fitted with hydraulics (a lowrider): the port's HYDRAULICS widget, at its own place, the radio moving to the
 // horn's (whose press the hydraulics take, CAutomobile::HydraulicControl). A tap raises or drops the car, as the horn
 // does; a drag from it is the car-gun stick, the corners rising the way it is pushed (the PC's numpad 8, 2, 4 and 6).
 {label:'Hydraulics',code:'KeyH',className:'hydraulics',modes:['vehicle'],contextual:true,icon:'hydraulics',driver:true,carGun:true},
 // A car fitted with nitro fires it with the car's weapon button: the port gives it a button of its own, shown only then.
 {label:'Nitrous',code:'ControlLeft',className:'nitro',modes:['vehicle'],contextual:true,icon:'bolt'},
 // A cutscene, or a scripted scene in the widescreen bars: the cluster gives way to Skip (CCutsceneMgr's skip is Space or
 // Return just pressed), offered while the scene can be skipped.
 {label:'Skip',code:'Space',className:'skip',modes:['cutscene'],contextual:true},
 // The port's default steering: left and right arrows under the left thumb (A and D), in place of the stick.
 {label:'Steer left',code:'KeyA',className:'steer-left',modes:['vehicle'],icon:'left',steering:'arrows',driver:true,slide:true},
 {label:'Steer right',code:'KeyD',className:'steer-right',modes:['vehicle'],icon:'right',steering:'arrows',driver:true,slide:true},
 // Flying, the stick is the yoke (pitch and roll) and the right thumb has the throttle, the rudder, the wheel brake
 // (a helicopter's hover hold) and the rockets: the PC's W/S, Q/E, Space and B.
 // Through a scope (the sniper rifle, the camera, the rocket launchers) Jump and Sprint give way to the zoom: the
 // PC's X and Z.
 {label:'Zoom +',code:'KeyX',className:'jump',modes:['scope'],icon:'zoomIn'},
 {label:'Zoom −',code:'KeyZ',className:'sprint',modes:['scope'],icon:'zoomOut'},
 // In the water the fire button dives under and Sprint swims the fast stroke: the mobile ports' Dive and Swim.
 {label:'Dive',code:'ControlLeft',className:'fire',modes:['swim'],icon:'dive'},
 {label:'Swim',code:'ShiftLeft',className:'sprint',modes:['swim'],icon:'swim'},
 {label:'Thrust',code:'KeyW',className:'gas',modes:['aircraft'],icon:'up',slide:true},
 {label:'Slow',code:'KeyS',className:'reverse',modes:['aircraft'],icon:'down',slide:true},
 {label:'Brake',code:'Space',className:'jump',modes:['aircraft'],icon:'parking',slide:true},
 {label:'◀ Yaw',code:'KeyQ',className:'yaw-left',modes:['aircraft'],icon:'left',slide:true},
 {label:'Yaw ▶',code:'KeyE',className:'yaw-right',modes:['aircraft'],icon:'right',slide:true},
 {label:'Rocket',code:'KeyB',className:'rocket',modes:['aircraft'],icon:'rocket'},
];
/** Controls the game asks for only now and then, by the pad action the help text names: a button for each shows above
 * the others while the help box or prompt asks for it (a yes-or-no question, collecting a pickup, a crew order). */
const CONTEXT:readonly {action:string;label:string;code:string;name?:string;widget?:{className:string;icon:TouchIcon}}[]=[
 // A yes or a no (a question, a word to a ped): the port's POSITIVE and NEGATIVE widgets, a thumb each, at their places
 // (low in the middle on a phone, high on an iPad's 4:3).
 {action:'CONVERSATION_YES',label:'Yes',code:'KeyY',widget:{className:'reply-yes',icon:'thumbUp'}},{action:'CONVERSATION_NO',label:'No',code:'KeyN',widget:{className:'reply-no',icon:'thumbDown'}},
 {action:'PED_ANSWER_PHONE',label:'Action',code:'Tab'},{action:'TOGGLE_SUBMISSIONS',label:'Mission',code:'Digit2'},
 {action:'GROUP_CONTROL_FWD',label:'Follow',code:'KeyG'},{action:'GROUP_CONTROL_BWD',label:'Stay',code:'KeyH'},
 // Targeting a Families member who would join: the port's GANG_RECRUIT (the same button as Follow).
 {action:'GANG_RECRUIT',label:'Recruit',code:'KeyG'},
 // In a vehicle, looking out of either side (the PC's Q and E), for a drive-by: round buttons of their own, the port's
 // VEHICLE_SHOOT_LEFT and _RIGHT widgets above the steering arrows. On foot, looking behind.
 {action:'VEHICLE_LOOKLEFT',label:'◀ Look',code:'KeyQ',widget:{className:'look-left',icon:'shootLeft'}},
 {action:'VEHICLE_LOOKRIGHT',label:'Look ▶',code:'KeyE',widget:{className:'look-right',icon:'shootRight'}},
 {action:'PED_LOOKBEHIND',label:'Look back',code:'MouseMiddle'},
 // Flying: the landing gear of a plane that retracts it, once in the air, and the Hydra's vertical lift (the PC's G and T).
 {action:'AIRCRAFT_GEAR',label:'Gear',code:'KeyG'},{action:'AIRCRAFT_VTOL',label:'VTOL',code:'KeyT'},
 // A script menu (a shop's, the barber's, a garage's colours): the mobile ports' arrow widgets, Select and Back, which
 // the host writes straight to the pad's d-pad, cross and triangle.
 // The arrows are the pad's d-pad, which a minigame reads too (scriptButtons).
 {action:'MENU_UP',label:'▲',code:'MenuUp',name:'Up'},{action:'MENU_DOWN',label:'▼',code:'MenuDown',name:'Down'},
 {action:'MENU_LEFT',label:'◀',code:'MenuLeft',name:'Left'},{action:'MENU_RIGHT',label:'▶',code:'MenuRight',name:'Right'},
 // Select and Back are the port's STORE_ACCEPT and STORE_CANCEL, large under the right thumb, the rest of the buttons
 // giving way while the menu is up (the script holds the player still).
 {action:'MENU_BACK',label:'Back',code:'MenuBack',widget:{className:'store-cancel',icon:'close'}},{action:'MENU_SELECT',label:'Select',code:'MenuSelect',widget:{className:'store-accept',icon:'check'}},
];
/** How long the weapon icon is held to open the arsenal rather than step the weapon. */
const ARSENAL_HOLD_MS=500;
/** The Analog Sensitivity setting's default (MOB_ANA, 20 to 45): the steering stick's travel shrinks as it rises. */
export const ANALOG_SENSITIVITY_DEFAULT=27;
/** How far the stick's knob travels from where the thumb came down, on the port's 640-wide screen, as its widgets clamp
 * the thumb: on foot CWidgetRegionMove's 0.45 of the PED_MOVE region's half width (54 on a phone, less on a tablet's
 * narrower region); at the wheel and flying the steering stick's 0.65 less Analog Sensitivity's hundredths of
 * VEHICLE_STEER_ANALOG's 130 (49.4). The screen's width carries it to pixels, as the buttons' sizes. */
export function portStickTravel(file:PortLayoutFile,mode:TouchMode,sensitivity=ANALOG_SENSITIVITY_DEFAULT){
 const f=Math.fround;
 return mode==='vehicle'||mode==='aircraft'?f(f(f(.65)-f(sensitivity/100))*130):f(f(.45)*PORT_WIDGETS[file].PED_MOVE[0]/2);
}
/** A button centred at its place on the port's screen, at its size (the CSS lays the place over the safe area). */
const portPlace=(element:HTMLElement,[x,y,size]:PortPlace)=>{
 for(const [name,value] of [['--x',x],['--y',y],['--r',PORT_SIZE[size]]] as const)if(element.style.getPropertyValue(name)!==String(value))element.style.setProperty(name,String(value));};
/** Keeps a finger's later events on the element it came down on; a pointer the browser no longer tracks throws. */
const capture=(element:Element,pointerId:number)=>{try{element.setPointerCapture?.(pointerId);}catch{/* the pointer is already gone */}};
/** Camera drag gain: a finger's pixels to the mouse's movement units. */
const LOOK_GAIN=1.6;
export class TouchControls {
 readonly element=document.createElement('div');
 private stickBase=document.createElement('div');
 private stickZone=document.createElement('div');
 /** The stick's travel in CSS pixels now (portStickTravel on this screen and mode). */
 private stickTravel=56;
 private stickKnob=document.createElement('div');
 private stickPointer?:number;private stickOrigin={x:0,y:0};
 private lookPointer?:number;private lookLast={x:0,y:0};
 /** Through a scope, the two fingers on the look side pinching the zoom, and how far apart they were last. */
 private pinch?:{a:number;b:number;spread:number};private lookFingers=new Map<number,{x:number;y:number}>();
 private held=new Map<number,string>();
 private context:{action:string;element:HTMLButtonElement}[]=[];
 private latched=new Set<string>();
 private buttons:{spec:ButtonSpec;element:HTMLButtonElement}[]=[];
 private mode?:TouchMode;
 /** A tablet takes the port's iPad layouts. */
 private readonly tablet=isTabletScreen();
 /** The button each held finger is pressing now, which a slide moves on. */
 private heldButton=new Map<number,HTMLElement>();
 private offered=new Set<string>();
 private abort=new AbortController();
 constructor(private readonly input:Input,parent:HTMLElement,private readonly actions:{pause:()=>void;arsenal:()=>void;playOn?:()=>void},private settings:TouchSettings=DEFAULT_TOUCH,private readonly changeSettings:(settings:TouchSettings)=>void=()=>{}){
  const options={signal:this.abort.signal};
  this.element.className='touch-controls';this.element.setAttribute('aria-label','Touch controls');
  const look=document.createElement('div');look.className='touch-look';
  const stickZone=this.stickZone;stickZone.className='touch-stick-zone';
  this.stickBase.className='touch-stick';this.stickKnob.className='touch-stick-knob';this.stickBase.append(this.stickKnob);this.stickBase.hidden=true;
  stickZone.append(this.stickBase);
  const pad=document.createElement('div');pad.className='touch-buttons';
  for(const spec of BUTTONS){
   const button=document.createElement('button');button.type='button';button.className=`touch-button ${spec.className}`;button.dataset.code=spec.code;button.setAttribute('aria-label',spec.label);
   if(spec.icon)button.innerHTML=touchIconSvg(spec.icon);else button.textContent=spec.label;
   if(spec.carGun){this.carGunButton(spec,button,options);pad.append(button);this.buttons.push({spec,element:button});continue;}
   if(spec.swipeBack){this.swipeButton(spec,spec.swipeBack,button,options);pad.append(button);this.buttons.push({spec,element:button});continue;}
   button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();capture(button,e.pointerId);
    if(this.editing){this.drag(e,spec,button);return;}
    this.buzz();if(spec.toggle){if(this.latched.has(spec.code)){this.latched.delete(spec.code);input.release(spec.code);button.classList.remove('on');}else{this.latched.add(spec.code);input.hold(spec.code);button.classList.add('on');}return;}
    this.held.set(e.pointerId,spec.code);this.heldButton.set(e.pointerId,button);input.hold(spec.code);button.classList.add('on');},options);
   if(spec.slide)button.addEventListener('pointermove',e=>{if(!this.editing)this.slide(e);},options);
   if(spec.looksIn){const last=new Map<number,{x:number;y:number}>();
    button.addEventListener('pointerdown',e=>{if(!this.editing)last.set(e.pointerId,{x:e.clientX,y:e.clientY});},options);
    button.addEventListener('pointermove',e=>{const from=last.get(e.pointerId);if(!from||this.held.get(e.pointerId)!==spec.code||!spec.looksIn!.includes(this.mode??'foot'))return;
     input.lookX+=(e.clientX-from.x)*LOOK_GAIN*this.settings.lookSpeed;input.lookY+=(e.clientY-from.y)*LOOK_GAIN*this.settings.lookSpeed;last.set(e.pointerId,{x:e.clientX,y:e.clientY});input.touches++;},options);
    for(const type of ['pointerup','pointercancel'] as const)button.addEventListener(type,e=>{last.delete(e.pointerId);},options);}
   const up=(e:PointerEvent)=>{if(spec.toggle)return;const code=this.held.get(e.pointerId);if(code===undefined)return;this.held.delete(e.pointerId);if(![...this.held.values()].includes(code))input.releaseAfterFrame(code);
    (this.heldButton.get(e.pointerId)??button).classList.remove('on');this.heldButton.delete(e.pointerId);};
   button.addEventListener('pointerup',up,options);button.addEventListener('pointercancel',up,options);
   pad.append(button);this.buttons.push({spec,element:button});
  }
  const top=document.createElement('div');top.className='touch-top';
  // As in the iOS and Android port the radar (moved to the top left) opens the map and the weapon icon, held, the
  // arsenal; the one top button left is the pause button, under the radar.
  {const button=document.createElement('button');button.type='button';button.className='touch-button small pause';button.setAttribute('aria-label','Pause');
   button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
   button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();actions.pause();},options);top.append(button);}
  // Beside it the camera button: the PC's V (CAMERA_CHANGE_VIEW_ALL_SITUATIONS), which a phone has no key for, steps
  // the follow camera's distance on foot and the car camera's zoom at the wheel.
  {const button=this.cameraButton;button.type='button';button.className='touch-button small camera';button.setAttribute('aria-label','Camera view');
   button.innerHTML=touchIconSvg('camera');
   button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();this.buzz();input.tap('KeyV');},options);top.append(button);}
  // A phone held upright squeezes the HUD, which is laid out for a sideways screen: until it is turned, a card asks for
  // that (the game holds underneath, as switching apps holds it). Play anyway keeps it upright for the rest of the visit
  // and plays on.
  const rotate=document.createElement('div');rotate.className='touch-rotate';rotate.setAttribute('role','status');
  const rotateText=document.createElement('p');rotateText.textContent='Turn your phone sideways to play';
  const rotateDismiss=document.createElement('button');rotateDismiss.type='button';rotateDismiss.className='touch-button small';rotateDismiss.textContent='Play anyway';
  rotateDismiss.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();rotate.classList.add('dismissed');actions.playOn?.();},options);
  rotate.append(rotateText,rotateDismiss);this.rotateCard=rotate;
  const context=document.createElement('div');context.className='touch-context';
  for(const {action,label,code,name,widget} of CONTEXT){
   const button=document.createElement('button');button.type='button';button.dataset.code=code;button.hidden=true;
   if(widget){button.className=`touch-button ${widget.className}`;button.innerHTML=touchIconSvg(widget.icon);button.setAttribute('aria-label',label);}
   else{button.textContent=label;button.className='touch-button small';if(name)button.setAttribute('aria-label',name);}
   button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();capture(button,e.pointerId);this.held.set(e.pointerId,code);input.hold(code);button.classList.add('on');this.buzz();},options);
   const up=(e:PointerEvent)=>{if(this.held.get(e.pointerId)!==code)return;this.held.delete(e.pointerId);if(![...this.held.values()].includes(code))input.releaseAfterFrame(code);button.classList.remove('on');};
   button.addEventListener('pointerup',up,options);button.addEventListener('pointercancel',up,options);
   (widget?pad:context).append(button);this.context.push({action,element:button});
  }
  // The port's steering popup: the first time at the wheel it asks how to steer, and keeps the answer (the touch settings
  // change it later).
  this.steeringPopup.className='touch-steering-choice';this.steeringPopup.hidden=true;this.steeringPopup.setAttribute('role','dialog');this.steeringPopup.setAttribute('aria-label','Choose steering');
  this.steeringPopup.innerHTML='<p>How do you want to steer?</p><div></div>';
  for(const [value,label] of [['stick','Stick'],['arrows','Arrows'],['tilt','Tilt']] as const){
   const button=document.createElement('button');button.type='button';button.className='touch-button small';button.textContent=label;button.dataset.steering=value;
   // On the lift (pointerup): the touch layer takes the click a tap would make, and a lift still lets iOS ask for the
   // motion sensors.
   button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();},options);
   button.addEventListener('pointerup',async e=>{e.preventDefault();e.stopPropagation();const steering=value==='tilt'&&!await motionAllowed()?'stick':value;
    const next={...this.settings,steering,steeringChosen:true};this.apply(next);this.changeSettings(next);this.steeringPopup.hidden=true;},options);
   this.steeringPopup.querySelector('div')!.append(button);
  }
  // Adjusting the layout: which layout's buttons, Reset and Done, at the top where no button sits.
  this.adjustBar.className='touch-adjust';this.adjustBar.hidden=true;this.adjustBar.setAttribute('aria-label','Adjust controls');
  this.adjustBar.innerHTML='<p>Drag the buttons where your thumbs want them.</p><div></div><div class="touch-adjust-size" hidden><span></span></div>';
  for(const [action,label] of [['foot','On foot'],['vehicle','Driving'],['aircraft','Flying'],['reset','Reset'],['done','Done']] as const){
   const button=document.createElement('button');button.type='button';button.className='touch-button small';button.textContent=label;
   if(action==='foot'||action==='vehicle'||action==='aircraft')button.dataset.layout=action;
   // On the lift, as the steering question's: the touch layer takes the click a tap would make.
   button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();},options);
   button.addEventListener('pointerup',e=>{e.preventDefault();e.stopPropagation();if(!this.editing)return;
    if(action==='done')this.finishAdjusting(true);
    else if(action==='reset'){const group=layoutGroup(this.mode??'foot');for(const key of Object.keys(this.editing.layout))if(key.startsWith(`${group}:`))delete this.editing.layout[key];this.place();}
    else this.showLayout(action);},options);
   this.adjustBar.querySelector('div')!.append(button);
  }
  // The size of the button touched last, a tenth at a time.
  {const row=this.adjustBar.querySelector<HTMLElement>('.touch-adjust-size')!;
   for(const [step,label,name] of [[-.1,'−','Smaller'],[.1,'+','Bigger']] as const){
    const button=document.createElement('button');button.type='button';button.className='touch-button small';button.textContent=label;button.setAttribute('aria-label',name);
    button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();},options);
    button.addEventListener('pointerup',e=>{e.preventDefault();e.stopPropagation();this.resize(step);},options);
    if(step>0)row.append(this.sizeReadout);
    row.append(button);
   }}
  this.element.append(look,stickZone,pad,top,context,this.steeringPopup,this.adjustBar);parent.append(this.element,rotate);
  // The HUD's weapon icon is the weapon button, as the mobile ports': a tap takes the next weapon (E) and a swipe to the
  // left the one before (Q), on foot.
  const slot=parent.querySelector<HTMLElement>('.weapon-slot');
  if(slot){let press:{id:number;x:number;at:number;timer:number;held:boolean}|undefined;
   slot.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();capture(slot,e.pointerId);
    const p={id:e.pointerId,x:e.clientX,at:performance.now(),held:false,timer:window.setTimeout(()=>{p.held=true;actions.arsenal();},ARSENAL_HOLD_MS)};press=p;},options);
   slot.addEventListener('pointerup',e=>{if(press?.id!==e.pointerId)return;const p=press;press=undefined;window.clearTimeout(p.timer);
    // A hold whose timer a long frame kept waiting is still a hold.
    if(!p.held&&performance.now()-p.at>=ARSENAL_HOLD_MS){p.held=true;actions.arsenal();}
    if(!p.held&&(this.mode==='foot'||this.mode==='scope'))input.tap(e.clientX-p.x<-24?'KeyQ':'KeyE');},options);
   slot.addEventListener('pointercancel',()=>{if(press)window.clearTimeout(press.timer);press=undefined;},options);
   // No click or long-press menu after the finger lifts: held, the icon opens the arsenal, whose close button lies under
   // the same spot and would take the click the lift makes.
   slot.addEventListener('touchstart',e=>{if(e.cancelable)e.preventDefault();},{...options,passive:false});
   slot.addEventListener('contextmenu',e=>e.preventDefault(),options);}
  // The trip skip's icon (CHud::DrawTripSkip, up while a skip can be taken) is its own button on a phone: held, it holds
  // Y, CONVERSATION_YES, the D-pad right the skip waits for; its help says so only the first time.
  const tripSkip=parent.querySelector<HTMLElement>('.trip-skip');
  if(tripSkip){tripSkip.setAttribute('role','button');tripSkip.setAttribute('aria-label','Trip skip');
   tripSkip.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();capture(tripSkip,e.pointerId);this.held.set(e.pointerId,'KeyY');input.hold('KeyY');this.buzz();},options);
   const lift=(e:PointerEvent)=>{if(this.held.get(e.pointerId)!=='KeyY')return;this.held.delete(e.pointerId);if(![...this.held.values()].includes('KeyY'))input.releaseAfterFrame('KeyY');};
   tripSkip.addEventListener('pointerup',lift,options);tripSkip.addEventListener('pointercancel',lift,options);
   tripSkip.addEventListener('touchstart',e=>{if(e.cancelable)e.preventDefault();},{...options,passive:false});}
  // The Fire button shows the weapon in hand, as the port's attack button does: the HUD icon's picture, or its fist.
  if(slot){const img=slot.querySelector<HTMLImageElement>('img.native-weapon-icon'),fist=slot.querySelector('svg.weapon');
   const fires=this.buttons.filter(b=>b.spec.code==='ControlLeft'&&!b.spec.icon).map(b=>b.element);
   const mirror=()=>{const src=img&&!img.hidden&&img.getAttribute('src')?img.src:'';
    for(const button of fires){if(button.dataset.weapon===src&&button.firstChild)continue;button.dataset.weapon=src;
     const picture=src?Object.assign(document.createElement('img'),{src,alt:''}):fist?.cloneNode(true) as Element|undefined;
     if(picture){picture.setAttribute('aria-hidden','true');button.replaceChildren(picture);}}};
   this.weaponWatch=new MutationObserver(mirror);this.weaponWatch.observe(slot,{subtree:true,attributes:true,attributeFilter:['src','hidden']});mirror();}
  // The stick floats: it is centred where the thumb lands in the left zone and follows it out to its radius.
  stickZone.addEventListener('pointerdown',e=>{if(this.stickPointer!==undefined)return;e.preventDefault();capture(stickZone,e.pointerId);
   this.stickPointer=e.pointerId;this.stickOrigin={x:e.clientX,y:e.clientY};const r=stickZone.getBoundingClientRect();
   this.stickBase.style.left=`${e.clientX-r.left}px`;this.stickBase.style.top=`${e.clientY-r.top}px`;this.stickBase.hidden=false;this.moveStick(e.clientX,e.clientY);},options);
  stickZone.addEventListener('pointermove',e=>{if(e.pointerId===this.stickPointer)this.moveStick(e.clientX,e.clientY);},options);
  const stickUp=(e:PointerEvent)=>{if(e.pointerId!==this.stickPointer)return;this.stickPointer=undefined;this.stickBase.hidden=true;input.stick=undefined;input.release('AltLeft');this.stickKnob.style.transform='';};
  stickZone.addEventListener('pointerup',stickUp,options);stickZone.addEventListener('pointercancel',stickUp,options);
  // The right side drags the camera as the mouse does.
  // Through a scope a second finger there pinches: spread, the two zoom in, as the mobile ports' sniper rifle and camera
  // do (its help: "Pinching your fingers on the screen away from each other zooms in"); one lifted, the other looks on.
  const spread=(a:number,b:number)=>{const p=this.lookFingers.get(a),q=this.lookFingers.get(b);return p&&q?Math.hypot(p.x-q.x,p.y-q.y):0;};
  look.addEventListener('pointerdown',e=>{
   if(this.lookPointer===undefined){e.preventDefault();capture(look,e.pointerId);this.lookPointer=e.pointerId;this.lookLast={x:e.clientX,y:e.clientY};this.lookFingers.set(e.pointerId,{x:e.clientX,y:e.clientY});}
   else if(this.mode==='scope'&&!this.pinch&&e.pointerId!==this.lookPointer){e.preventDefault();capture(look,e.pointerId);this.lookFingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    this.pinch={a:this.lookPointer,b:e.pointerId,spread:spread(this.lookPointer,e.pointerId)};}},options);
  look.addEventListener('pointermove',e=>{if(!this.lookFingers.has(e.pointerId))return;this.lookFingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   const pinch=this.pinch;
   // Out of the scope mid-pinch, the first finger looks on from where it is.
   if(pinch&&this.mode!=='scope'){this.pinch=undefined;const at=this.lookFingers.get(pinch.a);if(at)this.lookLast={...at};return;}
   if(pinch){if(e.pointerId!==pinch.a&&e.pointerId!==pinch.b)return;const now=spread(pinch.a,pinch.b);
    if(now>0&&pinch.spread>0){input.pinch*=now/pinch.spread;input.touches++;}pinch.spread=now;return;}
   if(e.pointerId!==this.lookPointer)return;input.lookX+=(e.clientX-this.lookLast.x)*LOOK_GAIN*this.settings.lookSpeed;input.lookY+=(e.clientY-this.lookLast.y)*LOOK_GAIN*this.settings.lookSpeed;this.lookLast={x:e.clientX,y:e.clientY};input.touches++;},options);
  const lookUp=(e:PointerEvent)=>{this.lookFingers.delete(e.pointerId);const pinch=this.pinch;
   if(pinch&&(e.pointerId===pinch.a||e.pointerId===pinch.b)){this.pinch=undefined;const other=e.pointerId===pinch.a?pinch.b:pinch.a,at=this.lookFingers.get(other);
    this.lookPointer=at?other:undefined;if(at)this.lookLast={...at};}
   else if(e.pointerId===this.lookPointer)this.lookPointer=undefined;};
  look.addEventListener('pointerup',lookUp,options);look.addEventListener('pointercancel',lookUp,options);
  // No page scroll, zoom or long-press menu under the thumbs.
  this.element.addEventListener('touchstart',e=>{if(e.cancelable)e.preventDefault();},{...options,passive:false});
  this.element.addEventListener('contextmenu',e=>e.preventDefault(),options);
  this.setMode('foot');
  // The screen's shape picks the layout file, and a turn or the browser's bars change it.
  window.addEventListener('resize',()=>this.place(),options);
  // Tilt steering reads the device's orientation (the port's accelerometer option).
  window.addEventListener('deviceorientation',e=>{this.orientation={beta:e.beta,gamma:e.gamma};this.steer();},options);
  // Gyro aiming reads the rate the device turns at, while aiming on foot or through a scope (gyroAim).
  let lastMotion:number|undefined;
  // A stream that stopped (a hidden page, the sensors paused) starts again from its next event, not with its gap.
  window.addEventListener('devicemotion',e=>{const gap=lastMotion===undefined?0:(e.timeStamp-lastMotion)/1000,seconds=gap>.1?0:gap;lastMotion=e.timeStamp;
   if(!this.settings.gyroAim||this.element.hidden||this.editing||!(this.mode==='scope'||this.mode==='foot'&&input.down('MouseAim')))return;
   const angle=globalThis.screen?.orientation?.angle??(globalThis as {orientation?:number}).orientation??0,turn=gyroLook(e.rotationRate,angle,seconds);
   if(!turn.yaw&&!turn.pitch)return;input.gyroYaw+=turn.yaw*this.settings.lookSpeed;input.gyroPitch+=turn.pitch*this.settings.lookSpeed;input.touches++;},options);
  this.apply(settings);
 }
 private moveStick(x:number,y:number){
  let dx=x-this.stickOrigin.x,dy=y-this.stickOrigin.y;const length=Math.hypot(dx,dy);
  const travel=this.stickTravel;
  if(length>travel){dx*=travel/length;dy*=travel/length;}
  this.stickKnob.style.transform=`translate(${dx}px,${dy}px)`;
  const stick={x:dx/travel,y:-dy/travel};this.input.stick=stick;this.input.stickFromPad=false;
  // A light push walks (the PC's walk key); past half way CJ runs.
  if(Math.hypot(stick.x,stick.y)<.55)this.input.hold('AltLeft');else this.input.release('AltLeft');
 }
 /** On foot, through a scope, swimming, at the wheel, flying or watching a scene: the other modes' buttons are hidden,
  * and a latched aim is let go anywhere it cannot aim. */
 setMode(mode:TouchMode){
  // Adjusting the layout, the game's mode waits until Done.
  if(this.editing){this.editing.mode=mode;return;}
  if(mode===this.mode)return;
  this.mode=mode;this.element.dataset.mode=mode;
  this.showButtons();this.steer();this.place();
  // A cutscene's camera is the script's, and a scope's is the weapon's own.
  this.cameraButton.hidden=mode==='cutscene'||mode==='scope';
  this.askSteering();
  if(mode!=='foot'&&mode!=='scope')for(const code of [...this.latched]){this.latched.delete(code);this.input.release(code);}
  for(const {spec,element} of this.buttons)if(spec.toggle)element.classList.toggle('on',this.latched.has(spec.code));
 }
 /** The Hydraulics button: a tap is a press of its key for a frame (the horn's toggle), a drag past a few pixels the
  * car-gun stick, a button's width to full travel, held at the PC's numpad keys too past half way (the scripts read
  * the turret actions from those). */
 private carGunButton(spec:ButtonSpec,button:HTMLButtonElement,options:AddEventListenerOptions){
  let finger:{id:number;x:number;y:number;moved:boolean}|undefined;const keys=['Numpad4','Numpad6','Numpad8','Numpad2'];
  const stick=(x:number,y:number)=>{this.input.carGunStick=x||y?{x,y}:undefined;
   const want=new Set([...x<-.5?['Numpad4']:[],...x>.5?['Numpad6']:[],...y<-.5?['Numpad8']:[],...y>.5?['Numpad2']:[]]);
   for(const key of keys)if(want.has(key))this.input.hold(key);else this.input.release(key);};
  button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();capture(button,e.pointerId);
   if(this.editing||finger)return;finger={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};button.classList.add('on');this.buzz();},options);
  button.addEventListener('pointermove',e=>{if(e.pointerId!==finger?.id)return;
   const dx=e.clientX-finger.x,dy=e.clientY-finger.y,reach=Math.max(24,button.getBoundingClientRect().width);
   if(!finger.moved&&Math.hypot(dx,dy)<8)return;finger.moved=true;
   const clamp=(v:number)=>Math.max(-1,Math.min(1,v/reach));stick(clamp(dx),clamp(dy));},options);
  const up=(e:PointerEvent)=>{if(e.pointerId!==finger?.id)return;const tapped=!finger.moved&&e.type==='pointerup';finger=undefined;button.classList.remove('on');stick(0,0);
   if(tapped){this.input.hold(spec.code);this.input.releaseAfterFrame(spec.code);}};
  button.addEventListener('pointerup',up,options);button.addEventListener('pointercancel',up,options);
  this.dropCarGun=()=>{if(finger){finger=undefined;button.classList.remove('on');stick(0,0);}};
 }
 private dropCarGun=()=>{};
 /** A button swiped either way (the Radio): a tap or a swipe to the right presses `code` for a frame, one to the left
  * past a third of the button's width `back`; decided as the finger lifts. Adjusting, it is dragged like the rest. */
 private swipeButton(spec:ButtonSpec,back:string,button:HTMLButtonElement,options:AddEventListenerOptions){
  const fingers=new Map<number,{x:number;y:number}>();
  button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();capture(button,e.pointerId);
   if(this.editing){this.drag(e,spec,button);return;}
   fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});button.classList.add('on');this.buzz();},options);
  const up=(e:PointerEvent)=>{const from=fingers.get(e.pointerId);if(!from)return;fingers.delete(e.pointerId);if(!fingers.size)button.classList.remove('on');
   if(e.type!=='pointerup')return;
   const dx=e.clientX-from.x,dy=e.clientY-from.y,reach=Math.max(16,button.getBoundingClientRect().width/3);
   const code=dx<=-reach&&Math.abs(dx)>Math.abs(dy)?back:spec.code;this.input.hold(code);this.input.releaseAfterFrame(code);};
  button.addEventListener('pointerup',up,options);button.addEventListener('pointercancel',up,options);
 }
 /** A held finger moved: over another slide button showing now, the press moves to it (the old one let go unless another
  * finger holds it). Off every button it stays on the last, so a thumb that strays off a pedal keeps driving. */
 private slide(e:PointerEvent){
  const from=this.heldButton.get(e.pointerId),code=this.held.get(e.pointerId);if(!from||code===undefined)return;
  const over=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('.touch-button');
  if(!over||over===from)return;
  const to=this.buttons.find(b=>b.element===over&&b.spec.slide&&!b.element.hidden);if(!to)return;
  this.held.set(e.pointerId,to.spec.code);this.heldButton.set(e.pointerId,to.element);
  if(![...this.held.values()].includes(code))this.input.releaseAfterFrame(code);
  from.classList.remove('on');this.input.hold(to.spec.code);to.element.classList.add('on');this.buzz();
 }
 /** The steering question, the first time at the wheel (not in a passenger seat). */
 private askSteering(){this.steeringPopup.hidden=!(this.mode==='vehicle'&&!this.passenger&&!this.settings.steeringChosen);}
 private passenger=false;
 /** In a passenger seat (a ride in a mission): the driver's pedals, wheel and horn go, and the tilt steers nothing. */
 setPassenger(passenger:boolean){
  if(passenger===this.passenger)return;
  this.passenger=passenger;this.showButtons();this.steer();this.askSteering();
 }
 /** The contextual buttons (by class) the game offers now: Enter beside a vehicle, in one, or when a prompt asks. */
 setOffered(classNames:Iterable<string>){
  const next=new Set(classNames);
  if(next.size===this.offered.size&&[...next].every(c=>this.offered.has(c)))return;
  const swapped=next.has('hydraulics')!==this.offered.has('hydraulics');
  this.offered=next;this.showButtons();if(swapped)this.place();
 }
 private showButtons(){
  const mode=this.mode??'foot';
  for(const {spec,element} of this.buttons){
   // Adjusting, a layout's every button shows, the ones it offers only now and then too.
   // (The Hydraulics button rides on the radio's place, and is moved with it.)
   if(this.editing){element.hidden=(spec.modes?!spec.modes.includes(mode):mode==='cutscene')||!!spec.steering&&spec.steering!==this.settings.steering||!!spec.carGun||!!spec.slot;continue;}
   const hidden=(spec.modes?!spec.modes.includes(mode):mode==='cutscene')||!!spec.contextual&&!this.offered.has(spec.className)||!!spec.steering&&spec.steering!==this.settings.steering||!!spec.driver&&this.passenger||!!spec.givesWayTo&&this.offered.has(spec.givesWayTo);
   if(element.hidden===hidden)continue;element.hidden=hidden;
   if(hidden&&spec.carGun)this.dropCarGun();
   // A button that goes while a finger holds it lets go of its key.
   if(hidden&&!spec.toggle){for(const [id,code] of this.held)if(code===spec.code&&element.classList.contains('on'))this.held.delete(id);if(![...this.held.values()].includes(spec.code))this.input.release(spec.code);element.classList.remove('on');}
  }
 }
 /** The pad actions the help box and prompt name now: their context buttons show, the rest hide (let go if held). */
 setPrompts(actions:Iterable<string>){
  const asked=new Set(actions);
  // A script menu up (its arrows asked): the menu's own lines take taps, and its buttons move under the left thumb.
  const menu=asked.has('MENU_SELECT');if((this.element.dataset.menu==='on')!==menu){if(menu)this.element.dataset.menu='on';else delete this.element.dataset.menu;}
  for(const {action,element} of this.context){
   const hidden=!asked.has(action);if(element.hidden===hidden)continue;element.hidden=hidden;
   if(hidden){const code=element.dataset.code!;for(const [id,held] of this.held)if(held===code)this.held.delete(id);if(![...this.held.values()].includes(code))this.input.release(code);element.classList.remove('on');}
  }
 }
 private orientation:{beta:number|null;gamma:number|null}={beta:null,gamma:null};
 /** The settings now in force: the button size, and tilt steering on or off. */
 apply(settings:TouchSettings){
  this.settings=settings;this.element.dataset.steering=settings.steering;
  document.documentElement.style.setProperty('--touch-scale',String(settings.buttonScale));
  this.showButtons();this.steer();this.place();
 }
 /** Feeds the tilt to the input while it steers: in a car, on a bike or in a boat with tilt steering chosen. */
 private steer(){
  const angle=globalThis.screen?.orientation?.angle??(globalThis as {orientation?:number}).orientation??0;
  this.input.tilt=this.settings.steering==='tilt'&&this.mode==='vehicle'&&!this.passenger&&!this.element.hidden&&!this.keyboard?tiltSteering(this.orientation.beta,this.orientation.gamma,((angle%360)+360)%360):undefined;
 }
 /** A press's buzz, as a phone game's buttons give: a short vibration, or an iPhone's Taptic tick (touchHaptic). */
 private haptic?:()=>void;
 private buzz(){if(this.settings.vibration)(this.haptic??=touchHaptic())();}
 /** A tablet's or a phone's keyboard being played: the buttons and the stick give way to the keys (and the tilt to their
  * steering), as they do to a game controller, while a drag on the right still looks; a touch elsewhere brings them back. */
 private keyboard=false;
 setKeyboard(on:boolean){
  if(this.keyboard===on)return;this.keyboard=on;this.element.classList.toggle('keys',on);
  if(on){for(const code of new Set(this.held.values()))this.input.release(code);this.held.clear();if(this.stickPointer!==undefined){this.stickPointer=undefined;this.stickBase.hidden=true;this.input.stick=undefined;this.input.release('AltLeft');}
   for(const {element} of this.buttons)element.classList.remove('on');}
  this.steer();
 }
 /** Hidden under the menus: everything held is let go so nothing stays pressed behind them. */
 setVisible(visible:boolean){
  if(this.editing||this.element.hidden===!visible)return;
  this.element.hidden=!visible;
  this.steer();
  if(!visible){this.dropCarGun();for(const code of new Set([...this.held.values(),...this.latched]))this.input.release(code);this.held.clear();this.latched.clear();this.input.stick=undefined;this.input.release('AltLeft');this.stickPointer=this.lookPointer=this.pinch=undefined;this.lookFingers.clear();this.stickBase.hidden=true;
   for(const {element} of this.buttons)element.classList.remove('on');}
 }
 /** Each button moved where the player put it in this layout (the CSS translate, kept apart from the grid's place). */
 private place(){
  const layout=this.editing?.layout??this.settings.layout,group=layoutGroup(this.mode??'foot');
  // The port's layout file for this device and the screen's shape now (a tablet's browser bars come and go).
  const file=portLayoutFile(innerWidth,innerHeight,this.tablet);
  if(this.element.dataset.layout!==file){this.element.dataset.layout=file;
   for(const [name,value] of Object.entries(portLayoutFrame(file)))document.documentElement.style.setProperty(name,String(value));}
  // The stick's travel by the layout and what it steers, on the screen's width (no wider than 16:9, as the buttons).
  const travel=Math.round(portStickTravel(file,this.mode??'foot',this.settings.analogSensitivity)*Math.min(innerWidth,innerHeight*16/9)/640);
  if(travel!==this.stickTravel||!this.stickZone.dataset.travel){this.stickTravel=travel;this.stickZone.dataset.travel=String(travel);this.stickBase.style.setProperty('--stick-r',`${travel}px`);}
  // In a car with hydraulics their button takes the radio's place and the radio the horn's (which gives way), each with
  // whatever Adjust controls did to that place.
  const slot=(name:string)=>group==='vehicle'&&!this.editing&&this.offered.has('hydraulics')?name==='hydraulics'?'radio':name==='radio'?'sprint':name:name;
  for(const {spec,element} of this.buttons){const o=layout[`${group}:${spec.slot??slot(spec.className)}`];const translate=o?`${o[0]}vmin ${o[1]}vmin`:'',scale=o?.[2]?String(o[2]):'';
   if(element.style.translate!==translate)element.style.translate=translate;if(element.style.scale!==scale)element.style.scale=scale;
   // The port's place for it in this layout (PORT_LAYOUTS), which the CSS lays over the safe area.
   const at=PORT_LAYOUTS[file][group][spec.slot??slot(spec.className)];
   if(at)portPlace(element,at);}
  // The asked buttons that are widgets of their own stand at theirs, at the wheel's layout.
  for(const {element} of this.context){const at=PORT_LAYOUTS[file].vehicle[element.classList[1]];if(at)portPlace(element,at);}
  this.showSize();
 }
 private editing?:{layout:Record<string,LayoutEntry>;mode:TouchMode;done:()=>void;selected?:ButtonSpec};
 private sizeReadout=document.createElement('output');
 private adjustBar=document.createElement('section');
 /** The port's Adjust Controls: the game held, a layout's buttons are dragged where the thumbs want them (on foot, at
  * the wheel, flying), Reset puts that layout's back, and Done keeps them. */
 adjust(done:()=>void){
  if(this.editing)return;
  this.setVisible(false);
  this.editing={layout:{...this.settings.layout},mode:this.mode??'foot',done};
  this.element.classList.add('editing');this.element.hidden=false;this.adjustBar.hidden=false;this.showLayout('foot');
 }
 /** Whether the layout is being adjusted. */
 get adjusting(){return !!this.editing;}
 /** Done, from outside (the phone's back button): the layout as it was left. */
 endAdjusting(){this.finishAdjusting(true);}
 private showLayout(group:LayoutGroup){
  if(this.editing)this.editing.selected=undefined;
  this.mode=group;this.element.dataset.mode=group;this.showButtons();this.place();
  for(const b of this.adjustBar.querySelectorAll<HTMLElement>('[data-layout]'))b.setAttribute('aria-pressed',String(b.dataset.layout===group));
 }
 private finishAdjusting(keep:boolean){
  const editing=this.editing;if(!editing)return;
  this.editing=undefined;this.element.classList.remove('editing');this.adjustBar.hidden=true;this.element.hidden=true;
  for(const {element} of this.buttons)element.classList.remove('on','selected');
  this.mode=undefined;this.setMode(editing.mode);
  if(keep){const next={...this.settings,layout:editing.layout};this.apply(next);this.changeSettings(next);}else this.place();
  editing.done();
 }
 /** A finger on a button while adjusting moves it, by hundredths of the screen's short side. */
 private drag(e:PointerEvent,spec:ButtonSpec,button:HTMLElement){
  const editing=this.editing!,key=`${layoutGroup(this.mode??'foot')}:${spec.className}`,start=editing.layout[key]??[0,0],x0=e.clientX,y0=e.clientY,unit=Math.min(innerWidth,innerHeight)/100;
  button.classList.add('on');editing.selected=spec;this.showSize();
  const move=(m:PointerEvent)=>{if(m.pointerId!==e.pointerId||this.editing!==editing)return;
   const x=Math.round(Math.min(LAYOUT_RANGE.x.max,Math.max(LAYOUT_RANGE.x.min,start[0]+(m.clientX-x0)/unit))*10)/10,y=Math.round(Math.min(LAYOUT_RANGE.y.max,Math.max(LAYOUT_RANGE.y.min,start[1]+(m.clientY-y0)/unit))*10)/10;
   editing.layout[key]=start[2]===undefined?[x,y]:[x,y,start[2]];this.place();};
  const end=(m:PointerEvent)=>{if(m.pointerId!==e.pointerId)return;button.classList.remove('on');button.removeEventListener('pointermove',move);button.removeEventListener('pointerup',end);button.removeEventListener('pointercancel',end);};
  button.addEventListener('pointermove',move);button.addEventListener('pointerup',end);button.addEventListener('pointercancel',end);
 }
 /** The touched button's size against the others', by `step`: back at its own size, only its place is kept. */
 private resize(step:number){
  const editing=this.editing,spec=editing?.selected;if(!editing||!spec)return;
  const key=`${layoutGroup(this.mode??'foot')}:${spec.className}`,[x=0,y=0,scale=1]=editing.layout[key]??[];
  const next=Math.round(Math.min(LAYOUT_RANGE.scale.max,Math.max(LAYOUT_RANGE.scale.min,scale+step))*10)/10;
  if(next!==1)editing.layout[key]=[x,y,next];else if(x||y)editing.layout[key]=[x,y];else delete editing.layout[key];
  this.place();
 }
 /** The size row names the touched button and its size; the button is marked. */
 private showSize(){
  const editing=this.editing,spec=editing?.selected,row=this.adjustBar.querySelector<HTMLElement>('.touch-adjust-size');if(!row)return;
  for(const {spec:s,element} of this.buttons)element.classList.toggle('selected',!!spec&&s===spec);
  row.hidden=!spec;if(!editing||!spec)return;
  const scale=editing.layout[`${layoutGroup(this.mode??'foot')}:${spec.className}`]?.[2]??1;
  row.querySelector('span')!.textContent=spec.label;this.sizeReadout.textContent=`${Math.round(scale*100)}%`;
 }
 private weaponWatch?:MutationObserver;
 private steeringPopup=document.createElement('section');
 private cameraButton=document.createElement('button');
 /** The card asking for the phone sideways: on the HUD itself, so it stands over the pause menu the turn brings up. */
 private rotateCard?:HTMLElement;
 /** Whether the player chose to play on upright (the card's Play anyway). */
 get uprightAllowed(){return !!this.rotateCard?.classList.contains('dismissed');}
 dispose(){this.abort.abort();this.weaponWatch?.disconnect();this.element.remove();this.rotateCard?.remove();}
}

/** The pause menu's touch settings, the iOS and Android port's own: steering by the stick, the arrows or tilting the
 * device, lock-on aim assist or free aim, the camera drag's speed, the buttons' size and the vibration. `change` gets each new set. Choosing
 * tilt asks iOS for the motion sensors (it asks only on a tap), and stays on the stick if refused. */
/** Choosing tilt asks iOS for the motion sensors, which it asks only on a tap; refused, the choice stays where it was. */
async function motionAllowed(kind:'DeviceOrientationEvent'|'DeviceMotionEvent'='DeviceOrientationEvent'){
 const request=(globalThis as unknown as Record<string,{requestPermission?:()=>Promise<string>}|undefined>)[kind]?.requestPermission;
 try{return request?await request()==='granted':true;}catch{return false;}
}
export function touchSettingsPanel(current:()=>TouchSettings,change:(settings:TouchSettings)=>void,adjust?:()=>void){
 const panel=document.createElement('p');panel.className='touch-settings';
 panel.innerHTML=`<b>Touch</b><label>Steering <select class="touch-steering" aria-label="Steering"><option value="stick">Stick</option><option value="arrows">Arrow buttons</option><option value="tilt">Tilt the device</option></select></label>
<label>Aim <select class="touch-aim" aria-label="Aim"><option value="assist">Lock-on assist</option><option value="free">Free aim</option></select></label>
<label>Steering sensitivity <input type="range" class="touch-analog" aria-label="Steering sensitivity" min="${ANALOG_SENSITIVITY_RANGE.min}" max="${ANALOG_SENSITIVITY_RANGE.max}" step="1"></label>
<label>Look speed <input type="range" class="touch-look-speed" aria-label="Look speed" min="${LOOK_SPEED_RANGE.min}" max="${LOOK_SPEED_RANGE.max}" step="0.1"></label>
<label>Invert look <input type="checkbox" class="touch-invert" aria-label="Invert look"></label>
<label>Gyro aiming <input type="checkbox" class="touch-gyro" aria-label="Gyro aiming"></label>
<label>Button size <input type="range" class="touch-button-size" aria-label="Button size" min="${BUTTON_SCALE_RANGE.min}" max="${BUTTON_SCALE_RANGE.max}" step="0.05"></label>
<label>Vibration <input type="checkbox" class="touch-vibration" aria-label="Vibration"></label>
<label>Auto climb <input type="checkbox" class="touch-auto-climb" aria-label="Auto climb"></label>
<label>Population <select class="touch-density" aria-label="Population"><option value="full">Full</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
<label>Draw distance <input type="range" class="touch-draw-distance" aria-label="Draw distance" min="${DRAW_DISTANCE_RANGE.min}" max="${DRAW_DISTANCE_RANGE.max}" step="1"></label>
<label>Visual effects <select class="touch-effects" aria-label="Visual effects"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
<label>Resolution <select class="touch-resolution" aria-label="Resolution"><option value="low">Low (softer, faster)</option><option value="standard">Standard</option><option value="high">High (sharper, slower)</option></select></label>
<label>Adaptive resolution <input type="checkbox" class="touch-dynamic-resolution" aria-label="Adaptive resolution"></label>
<label>Car reflections <input type="checkbox" class="touch-car-reflections" aria-label="Car reflections"></label>
<label>Shadows <input type="checkbox" class="touch-shadows" aria-label="Shadows"></label>
<button type="button" class="touch-adjust-open">Adjust controls</button>
<small class="touch-note"></small>`;
 const steering=panel.querySelector<HTMLSelectElement>('.touch-steering')!,aim=panel.querySelector<HTMLSelectElement>('.touch-aim')!;
 const analog=panel.querySelector<HTMLInputElement>('.touch-analog')!,look=panel.querySelector<HTMLInputElement>('.touch-look-speed')!,size=panel.querySelector<HTMLInputElement>('.touch-button-size')!,note=panel.querySelector<HTMLElement>('.touch-note')!;
 const reflections=panel.querySelector<HTMLInputElement>('.touch-car-reflections')!,shadows=panel.querySelector<HTMLInputElement>('.touch-shadows')!;
 const dynamic=panel.querySelector<HTMLInputElement>('.touch-dynamic-resolution')!,gyro=panel.querySelector<HTMLInputElement>('.touch-gyro')!;
 const vibration=panel.querySelector<HTMLInputElement>('.touch-vibration')!,invert=panel.querySelector<HTMLInputElement>('.touch-invert')!,autoClimb=panel.querySelector<HTMLInputElement>('.touch-auto-climb')!;
 const density=panel.querySelector<HTMLSelectElement>('.touch-density')!,resolution=panel.querySelector<HTMLSelectElement>('.touch-resolution')!,effects=panel.querySelector<HTMLSelectElement>('.touch-effects')!,drawDistance=panel.querySelector<HTMLInputElement>('.touch-draw-distance')!;
 // The settings can change outside the panel (the steering popup): it shows them afresh each time it is opened.
 const refresh=()=>{const settings=current();steering.value=settings.steering;aim.value=settings.aimAssist?'assist':'free';look.value=String(settings.lookSpeed);analog.value=String(settings.analogSensitivity);size.value=String(settings.buttonScale);vibration.checked=settings.vibration;autoClimb.checked=settings.autoClimb;invert.checked=settings.invertLook;gyro.checked=settings.gyroAim;resolution.value=settings.resolution;dynamic.checked=settings.dynamicResolution;reflections.checked=settings.carReflections;shadows.checked=settings.shadows;effects.value=settings.effects;drawDistance.value=String(settings.drawDistance);density.value=settings.density;note.textContent='';};refresh();
 vibration.onchange=()=>update({vibration:vibration.checked});autoClimb.onchange=()=>update({autoClimb:autoClimb.checked});invert.onchange=()=>update({invertLook:invert.checked});
 // Adaptive resolution: drawn softer while the phone cannot keep up (dynamicResolution), the chosen one otherwise.
 dynamic.onchange=()=>update({dynamicResolution:dynamic.checked});
 // Gyro aiming asks iOS for the motion sensors (only on a tap); refused, it stays off.
 gyro.onchange=async()=>{note.textContent='';if(!gyro.checked){update({gyroAim:false});return;}
  if(await motionAllowed('DeviceMotionEvent'))update({gyroAim:true});else{gyro.checked=false;note.textContent='Motion sensors were not allowed, so gyro aiming stays off.';}};
 // A quality setting set by the player is chosen: the first play's measure leaves them be.
 resolution.onchange=()=>update({resolution:resolution.value==='high'||resolution.value==='low'?resolution.value:'standard',qualityChosen:true,wheelMeasured:true,flightMeasured:true});
 density.onchange=()=>update({density:density.value==='full'||density.value==='low'?density.value:'medium',qualityChosen:true,wheelMeasured:true,flightMeasured:true});
 effects.onchange=()=>update({effects:effects.value==='low'||effects.value==='medium'?effects.value:'high',qualityChosen:true,wheelMeasured:true,flightMeasured:true});
 drawDistance.oninput=()=>update({drawDistance:Number(drawDistance.value),qualityChosen:true,wheelMeasured:true,flightMeasured:true});
 reflections.onchange=()=>update({carReflections:reflections.checked,qualityChosen:true,wheelMeasured:true,flightMeasured:true});
 shadows.onchange=()=>update({shadows:shadows.checked,qualityChosen:true,wheelMeasured:true,flightMeasured:true});
 const update=(next:Partial<TouchSettings>)=>change({...current(),...next});
 steering.onchange=async()=>{
  note.textContent='';
  if(steering.value!=='tilt'){update({steering:steering.value==='arrows'?'arrows':'stick',steeringChosen:true});return;}
  if(await motionAllowed())update({steering:'tilt',steeringChosen:true});else{steering.value='stick';note.textContent='Motion sensors were not allowed, so steering stays on the stick.';}
 };
 aim.onchange=()=>update({aimAssist:aim.value==='assist'});
 const adjustOpen=panel.querySelector<HTMLButtonElement>('.touch-adjust-open')!;adjustOpen.hidden=!adjust;adjustOpen.onclick=()=>adjust?.();
 look.oninput=()=>update({lookSpeed:Number(look.value)});analog.oninput=()=>update({analogSensitivity:Number(analog.value)});size.oninput=()=>update({buttonScale:Number(size.value)});
 // The port's graphics settings stand on the Display page (the PC's Display Setup), the rest on Controls.
 const display=document.createElement('p');display.className='touch-settings touch-display';display.innerHTML='<b>Graphics</b>';
 for(const input of [resolution,dynamic,effects,drawDistance,shadows,reflections,density])display.append(input.closest('label')!);
 return {element:panel,display,refresh};
}
