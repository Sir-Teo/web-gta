import type {Input} from './Input';
import {BUTTON_SCALE_RANGE,DEFAULT_TOUCH,LOOK_SPEED_RANGE,tiltSteering,type TouchSettings} from './touchSettings';
import {touchIconSvg,type TouchIcon} from './touchIcons';
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
/** What the player is doing, which picks the buttons shown. */
export type TouchMode='foot'|'scope'|'swim'|'vehicle'|'aircraft'|'cutscene';
/** A button: its label, the key or mouse button it holds, whether a tap latches it (aim) rather than holds it, the
 * modes it shows in (all of them when unset), and whether it shows only while the game offers it (setOffered), as the
 * mobile ports show their enter-vehicle button only beside a vehicle. */
interface ButtonSpec {label:string;code:string;className:string;toggle?:boolean;modes?:readonly TouchMode[];contextual?:boolean;icon?:TouchIcon;steering?:TouchSettings['steering']}
const BUTTONS:ButtonSpec[]=[
 {label:'Fire',code:'ControlLeft',className:'fire',modes:['foot','scope','vehicle','aircraft']},
 {label:'Aim',code:'MouseAim',className:'aim',toggle:true,modes:['foot','scope'],icon:'target'},
 {label:'Jump',code:'Space',className:'jump',modes:['foot','swim'],icon:'jump'},
 {label:'H-brake',code:'Space',className:'jump',modes:['vehicle'],icon:'parking'},
 {label:'Sprint',code:'ShiftLeft',className:'sprint',modes:['foot'],icon:'run'},
 {label:'Horn',code:'KeyH',className:'sprint',modes:['vehicle'],icon:'horn'},
 {label:'Enter',code:'KeyF',className:'enter',contextual:true,icon:'car'},
 {label:'Crouch',code:'KeyC',className:'crouch',modes:['foot','scope'],icon:'crouch'},
 {label:'Look',code:'KeyQ',className:'crouch',modes:['vehicle'],icon:'eye'},
 {label:'Reload',code:'KeyR',className:'reload',modes:['foot','scope'],icon:'reload'},
 // At the wheel the right thumb has the pedals, as the mobile ports give it, so the stick can steer to full lock
 // while the car accelerates (a stick pushed only sideways is no push forward).
 {label:'Gas',code:'KeyW',className:'gas',modes:['vehicle'],icon:'up'},
 {label:'Brake',code:'KeyS',className:'reverse',modes:['vehicle'],icon:'down'},
 // N tunes the radio (the mobile ports swipe for it).
 {label:'Radio',code:'KeyN',className:'radio',modes:['vehicle'],icon:'music'},
 // A car fitted with nitro fires it with the car's weapon button: the port gives it a button of its own, shown only then.
 {label:'Nitrous',code:'ControlLeft',className:'nitro',modes:['vehicle'],contextual:true,icon:'bolt'},
 // A cutscene, or a scripted scene in the widescreen bars: the cluster gives way to Skip (CCutsceneMgr's skip is Space or
 // Return just pressed), offered while the scene can be skipped.
 {label:'Skip',code:'Space',className:'skip',modes:['cutscene'],contextual:true},
 // The port's default steering: left and right arrows under the left thumb (A and D), in place of the stick.
 {label:'Steer left',code:'KeyA',className:'steer-left',modes:['vehicle'],icon:'left',steering:'arrows'},
 {label:'Steer right',code:'KeyD',className:'steer-right',modes:['vehicle'],icon:'right',steering:'arrows'},
 // Flying, the stick is the yoke (pitch and roll) and the right thumb has the throttle, the rudder, the wheel brake
 // (a helicopter's hover hold) and the rockets: the PC's W/S, Q/E, Space and B.
 // Through a scope (the sniper rifle, the camera, the rocket launchers) Jump and Sprint give way to the zoom: the
 // PC's X and Z.
 {label:'Zoom +',code:'KeyX',className:'jump',modes:['scope'],icon:'zoomIn'},
 {label:'Zoom −',code:'KeyZ',className:'sprint',modes:['scope'],icon:'zoomOut'},
 // In the water the fire button dives under and Sprint swims the fast stroke: the mobile ports' Dive and Swim.
 {label:'Dive',code:'ControlLeft',className:'fire',modes:['swim'],icon:'dive'},
 {label:'Swim',code:'ShiftLeft',className:'sprint',modes:['swim'],icon:'swim'},
 {label:'Thrust',code:'KeyW',className:'gas',modes:['aircraft'],icon:'up'},
 {label:'Slow',code:'KeyS',className:'reverse',modes:['aircraft'],icon:'down'},
 {label:'Brake',code:'Space',className:'jump',modes:['aircraft'],icon:'parking'},
 {label:'◀ Yaw',code:'KeyQ',className:'yaw-left',modes:['aircraft'],icon:'left'},
 {label:'Yaw ▶',code:'KeyE',className:'yaw-right',modes:['aircraft'],icon:'right'},
 {label:'Rocket',code:'KeyB',className:'rocket',modes:['aircraft'],icon:'rocket'},
];
/** Controls the game asks for only now and then, by the pad action the help text names: a button for each shows above
 * the others while the help box or prompt asks for it (a yes-or-no question, collecting a pickup, a crew order). */
const CONTEXT:readonly {action:string;label:string;code:string}[]=[
 {action:'CONVERSATION_YES',label:'Yes',code:'KeyY'},{action:'CONVERSATION_NO',label:'No',code:'KeyN'},
 {action:'PED_ANSWER_PHONE',label:'Action',code:'Tab'},{action:'TOGGLE_SUBMISSIONS',label:'Mission',code:'Digit2'},
 {action:'GROUP_CONTROL_FWD',label:'Follow',code:'KeyG'},{action:'GROUP_CONTROL_BWD',label:'Stay',code:'KeyH'},
 // A script menu (a shop's, the barber's, a garage's colours): the mobile ports' arrow widgets, Select and Back, which
 // the host writes straight to the pad's d-pad, cross and triangle.
 {action:'MENU_UP',label:'▲',code:'MenuUp'},{action:'MENU_DOWN',label:'▼',code:'MenuDown'},
 {action:'MENU_LEFT',label:'◀',code:'MenuLeft'},{action:'MENU_RIGHT',label:'▶',code:'MenuRight'},
 {action:'MENU_BACK',label:'Back',code:'MenuBack'},{action:'MENU_SELECT',label:'Select',code:'MenuSelect'},
];
/** How long the weapon icon is held to open the arsenal rather than step the weapon. */
const ARSENAL_HOLD_MS=500;
/** How far the stick's knob travels from where the thumb came down, in CSS pixels. */
const STICK_RADIUS=56;
/** Keeps a finger's later events on the element it came down on; a pointer the browser no longer tracks throws. */
const capture=(element:Element,pointerId:number)=>{try{element.setPointerCapture?.(pointerId);}catch{/* the pointer is already gone */}};
/** Camera drag gain: a finger's pixels to the mouse's movement units. */
const LOOK_GAIN=1.6;
export class TouchControls {
 readonly element=document.createElement('div');
 private stickBase=document.createElement('div');
 private stickKnob=document.createElement('div');
 private stickPointer?:number;private stickOrigin={x:0,y:0};
 private lookPointer?:number;private lookLast={x:0,y:0};
 private held=new Map<number,string>();
 private context:{action:string;element:HTMLButtonElement}[]=[];
 private latched=new Set<string>();
 private buttons:{spec:ButtonSpec;element:HTMLButtonElement}[]=[];
 private mode?:TouchMode;
 private offered=new Set<string>();
 private abort=new AbortController();
 constructor(private readonly input:Input,parent:HTMLElement,private readonly actions:{pause:()=>void;arsenal:()=>void},private settings:TouchSettings=DEFAULT_TOUCH,private readonly changeSettings:(settings:TouchSettings)=>void=()=>{}){
  const options={signal:this.abort.signal};
  this.element.className='touch-controls';this.element.setAttribute('aria-label','Touch controls');
  const look=document.createElement('div');look.className='touch-look';
  const stickZone=document.createElement('div');stickZone.className='touch-stick-zone';
  this.stickBase.className='touch-stick';this.stickKnob.className='touch-stick-knob';this.stickBase.append(this.stickKnob);this.stickBase.hidden=true;
  stickZone.append(this.stickBase);
  const pad=document.createElement('div');pad.className='touch-buttons';
  for(const spec of BUTTONS){
   const button=document.createElement('button');button.type='button';button.className=`touch-button ${spec.className}`;button.dataset.code=spec.code;button.setAttribute('aria-label',spec.label);
   if(spec.icon)button.innerHTML=touchIconSvg(spec.icon);else button.textContent=spec.label;
   button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();capture(button,e.pointerId);
    this.buzz();if(spec.toggle){if(this.latched.has(spec.code)){this.latched.delete(spec.code);input.release(spec.code);button.classList.remove('on');}else{this.latched.add(spec.code);input.hold(spec.code);button.classList.add('on');}return;}
    this.held.set(e.pointerId,spec.code);input.hold(spec.code);button.classList.add('on');},options);
   const up=(e:PointerEvent)=>{if(spec.toggle)return;const code=this.held.get(e.pointerId);if(code===undefined)return;this.held.delete(e.pointerId);if(![...this.held.values()].includes(code))input.releaseAfterFrame(code);button.classList.remove('on');};
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
  // that (the game underneath stays as it is). Play anyway keeps it upright for the rest of the visit.
  const rotate=document.createElement('div');rotate.className='touch-rotate';rotate.setAttribute('role','status');
  const rotateText=document.createElement('p');rotateText.textContent='Turn your phone sideways to play';
  const rotateDismiss=document.createElement('button');rotateDismiss.type='button';rotateDismiss.className='touch-button small';rotateDismiss.textContent='Play anyway';
  rotateDismiss.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();rotate.classList.add('dismissed');},options);
  rotate.append(rotateText,rotateDismiss);
  const context=document.createElement('div');context.className='touch-context';
  for(const {action,label,code} of CONTEXT){
   const button=document.createElement('button');button.type='button';button.textContent=label;button.className='touch-button small';button.dataset.code=code;button.hidden=true;
   button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();capture(button,e.pointerId);this.held.set(e.pointerId,code);input.hold(code);button.classList.add('on');this.buzz();},options);
   const up=(e:PointerEvent)=>{if(this.held.get(e.pointerId)!==code)return;this.held.delete(e.pointerId);if(![...this.held.values()].includes(code))input.releaseAfterFrame(code);button.classList.remove('on');};
   button.addEventListener('pointerup',up,options);button.addEventListener('pointercancel',up,options);
   context.append(button);this.context.push({action,element:button});
  }
  // The port's steering popup: the first time at the wheel it asks how to steer, and keeps the answer (the touch settings
  // change it later).
  this.steeringPopup.className='touch-steering-choice';this.steeringPopup.hidden=true;this.steeringPopup.setAttribute('role','dialog');this.steeringPopup.setAttribute('aria-label','Choose steering');
  this.steeringPopup.innerHTML='<p>How do you want to steer?</p><div></div>';
  for(const [value,label] of [['stick','Stick'],['arrows','Arrow buttons'],['tilt','Tilt the device']] as const){
   const button=document.createElement('button');button.type='button';button.className='touch-button small';button.textContent=label;button.dataset.steering=value;
   // On the lift (pointerup): the touch layer takes the click a tap would make, and a lift still lets iOS ask for the
   // motion sensors.
   button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();},options);
   button.addEventListener('pointerup',async e=>{e.preventDefault();e.stopPropagation();const steering=value==='tilt'&&!await motionAllowed()?'stick':value;
    const next={...this.settings,steering,steeringChosen:true};this.apply(next);this.changeSettings(next);this.steeringPopup.hidden=true;},options);
   this.steeringPopup.querySelector('div')!.append(button);
  }
  this.element.append(look,stickZone,pad,top,rotate,context,this.steeringPopup);parent.append(this.element);
  // The HUD's weapon icon is the weapon button, as the mobile ports': a tap takes the next weapon (E) and a swipe to the
  // left the one before (Q), on foot.
  const slot=parent.querySelector<HTMLElement>('.weapon-slot');
  if(slot){let press:{id:number;x:number;timer:number;held:boolean}|undefined;
   slot.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();capture(slot,e.pointerId);
    const p={id:e.pointerId,x:e.clientX,held:false,timer:window.setTimeout(()=>{p.held=true;actions.arsenal();},ARSENAL_HOLD_MS)};press=p;},options);
   slot.addEventListener('pointerup',e=>{if(press?.id!==e.pointerId)return;const p=press;press=undefined;window.clearTimeout(p.timer);
    if(!p.held&&(this.mode==='foot'||this.mode==='scope'))input.tap(e.clientX-p.x<-24?'KeyQ':'KeyE');},options);
   slot.addEventListener('pointercancel',()=>{if(press)window.clearTimeout(press.timer);press=undefined;},options);
   // No click or long-press menu after the finger lifts: held, the icon opens the arsenal, whose close button lies under
   // the same spot and would take the click the lift makes.
   slot.addEventListener('touchstart',e=>{if(e.cancelable)e.preventDefault();},{...options,passive:false});
   slot.addEventListener('contextmenu',e=>e.preventDefault(),options);}
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
  look.addEventListener('pointerdown',e=>{if(this.lookPointer!==undefined)return;e.preventDefault();capture(look,e.pointerId);this.lookPointer=e.pointerId;this.lookLast={x:e.clientX,y:e.clientY};},options);
  look.addEventListener('pointermove',e=>{if(e.pointerId!==this.lookPointer)return;input.lookX+=(e.clientX-this.lookLast.x)*LOOK_GAIN*this.settings.lookSpeed;input.lookY+=(e.clientY-this.lookLast.y)*LOOK_GAIN*this.settings.lookSpeed;this.lookLast={x:e.clientX,y:e.clientY};input.touches++;},options);
  const lookUp=(e:PointerEvent)=>{if(e.pointerId===this.lookPointer)this.lookPointer=undefined;};
  look.addEventListener('pointerup',lookUp,options);look.addEventListener('pointercancel',lookUp,options);
  // No page scroll, zoom or long-press menu under the thumbs.
  this.element.addEventListener('touchstart',e=>{if(e.cancelable)e.preventDefault();},{...options,passive:false});
  this.element.addEventListener('contextmenu',e=>e.preventDefault(),options);
  this.setMode('foot');
  // Tilt steering reads the device's orientation (the port's accelerometer option).
  window.addEventListener('deviceorientation',e=>{this.orientation={beta:e.beta,gamma:e.gamma};this.steer();},options);
  this.apply(settings);
 }
 private moveStick(x:number,y:number){
  let dx=x-this.stickOrigin.x,dy=y-this.stickOrigin.y;const length=Math.hypot(dx,dy);
  if(length>STICK_RADIUS){dx*=STICK_RADIUS/length;dy*=STICK_RADIUS/length;}
  this.stickKnob.style.transform=`translate(${dx}px,${dy}px)`;
  const stick={x:dx/STICK_RADIUS,y:-dy/STICK_RADIUS};this.input.stick=stick;
  // A light push walks (the PC's walk key); past half way CJ runs.
  if(Math.hypot(stick.x,stick.y)<.55)this.input.hold('AltLeft');else this.input.release('AltLeft');
 }
 /** On foot, through a scope, swimming, at the wheel, flying or watching a scene: the other modes' buttons are hidden,
  * and a latched aim is let go anywhere it cannot aim. */
 setMode(mode:TouchMode){
  if(mode===this.mode)return;
  this.mode=mode;this.element.dataset.mode=mode;
  this.showButtons();this.steer();
  // A cutscene's camera is the script's, and a scope's is the weapon's own.
  this.cameraButton.hidden=mode==='cutscene'||mode==='scope';
  this.steeringPopup.hidden=!(mode==='vehicle'&&!this.settings.steeringChosen);
  if(mode!=='foot'&&mode!=='scope')for(const code of [...this.latched]){this.latched.delete(code);this.input.release(code);}
  for(const {spec,element} of this.buttons)if(spec.toggle)element.classList.toggle('on',this.latched.has(spec.code));
 }
 /** The contextual buttons (by class) the game offers now: Enter beside a vehicle, in one, or when a prompt asks. */
 setOffered(classNames:Iterable<string>){
  const next=new Set(classNames);
  if(next.size===this.offered.size&&[...next].every(c=>this.offered.has(c)))return;
  this.offered=next;this.showButtons();
 }
 private showButtons(){
  const mode=this.mode??'foot';
  for(const {spec,element} of this.buttons){
   const hidden=(spec.modes?!spec.modes.includes(mode):mode==='cutscene')||!!spec.contextual&&!this.offered.has(spec.className)||!!spec.steering&&spec.steering!==this.settings.steering;
   if(element.hidden===hidden)continue;element.hidden=hidden;
   // A button that goes while a finger holds it lets go of its key.
   if(hidden&&!spec.toggle){for(const [id,code] of this.held)if(code===spec.code&&element.classList.contains('on'))this.held.delete(id);if(![...this.held.values()].includes(spec.code))this.input.release(spec.code);element.classList.remove('on');}
  }
 }
 /** The pad actions the help box and prompt name now: their context buttons show, the rest hide (let go if held). */
 setPrompts(actions:Iterable<string>){
  const asked=new Set(actions);
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
  this.showButtons();this.steer();
 }
 /** Feeds the tilt to the input while it steers: in a car, on a bike or in a boat with tilt steering chosen. */
 private steer(){
  const angle=globalThis.screen?.orientation?.angle??(globalThis as {orientation?:number}).orientation??0;
  this.input.tilt=this.settings.steering==='tilt'&&this.mode==='vehicle'&&!this.element.hidden?tiltSteering(this.orientation.beta,this.orientation.gamma,((angle%360)+360)%360):undefined;
 }
 /** A press's buzz, as a phone game's buttons give: a short one where the browser can vibrate (not iOS Safari). */
 private buzz(){if(this.settings.vibration)try{navigator.vibrate?.(12);}catch{/* vibration refused */}}
 /** Hidden under the menus: everything held is let go so nothing stays pressed behind them. */
 setVisible(visible:boolean){
  if(this.element.hidden===!visible)return;
  this.element.hidden=!visible;
  this.steer();
  if(!visible){for(const code of new Set([...this.held.values(),...this.latched]))this.input.release(code);this.held.clear();this.latched.clear();this.input.stick=undefined;this.input.release('AltLeft');this.stickPointer=this.lookPointer=undefined;this.stickBase.hidden=true;
   for(const {element} of this.buttons)element.classList.remove('on');}
 }
 private weaponWatch?:MutationObserver;
 private steeringPopup=document.createElement('section');
 private cameraButton=document.createElement('button');
 dispose(){this.abort.abort();this.weaponWatch?.disconnect();this.element.remove();}
}

/** The pause menu's touch settings, the iOS and Android port's own: steering by the stick, the arrows or tilting the
 * device, lock-on aim assist or free aim, the camera drag's speed, the buttons' size and the vibration. `change` gets each new set. Choosing
 * tilt asks iOS for the motion sensors (it asks only on a tap), and stays on the stick if refused. */
/** Choosing tilt asks iOS for the motion sensors, which it asks only on a tap; refused, the choice stays where it was. */
async function motionAllowed(){
 const request=(globalThis as {DeviceOrientationEvent?:{requestPermission?:()=>Promise<string>}}).DeviceOrientationEvent?.requestPermission;
 try{return request?await request()==='granted':true;}catch{return false;}
}
export function touchSettingsPanel(current:()=>TouchSettings,change:(settings:TouchSettings)=>void){
 const panel=document.createElement('p');panel.className='touch-settings';
 panel.innerHTML=`<b>Touch</b><label>Steering <select class="touch-steering" aria-label="Steering"><option value="stick">Stick</option><option value="arrows">Arrow buttons</option><option value="tilt">Tilt the device</option></select></label>
<label>Aim <select class="touch-aim" aria-label="Aim"><option value="assist">Lock-on assist</option><option value="free">Free aim</option></select></label>
<label>Look speed <input type="range" class="touch-look-speed" aria-label="Look speed" min="${LOOK_SPEED_RANGE.min}" max="${LOOK_SPEED_RANGE.max}" step="0.1"></label>
<label>Button size <input type="range" class="touch-button-size" aria-label="Button size" min="${BUTTON_SCALE_RANGE.min}" max="${BUTTON_SCALE_RANGE.max}" step="0.05"></label>
<label>Vibration <input type="checkbox" class="touch-vibration" aria-label="Vibration"></label>
<label>Population <select class="touch-density" aria-label="Population"><option value="full">Full</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
<small class="touch-note"></small>`;
 const steering=panel.querySelector<HTMLSelectElement>('.touch-steering')!,aim=panel.querySelector<HTMLSelectElement>('.touch-aim')!;
 const look=panel.querySelector<HTMLInputElement>('.touch-look-speed')!,size=panel.querySelector<HTMLInputElement>('.touch-button-size')!,note=panel.querySelector<HTMLElement>('.touch-note')!;
 const vibration=panel.querySelector<HTMLInputElement>('.touch-vibration')!;
 const density=panel.querySelector<HTMLSelectElement>('.touch-density')!;
 // The settings can change outside the panel (the steering popup): it shows them afresh each time it is opened.
 const refresh=()=>{const settings=current();steering.value=settings.steering;aim.value=settings.aimAssist?'assist':'free';look.value=String(settings.lookSpeed);size.value=String(settings.buttonScale);vibration.checked=settings.vibration;density.value=settings.density;note.textContent='';};refresh();
 vibration.onchange=()=>update({vibration:vibration.checked});
 density.onchange=()=>update({density:density.value==='full'||density.value==='low'?density.value:'medium'});
 const update=(next:Partial<TouchSettings>)=>change({...current(),...next});
 steering.onchange=async()=>{
  note.textContent='';
  if(steering.value!=='tilt'){update({steering:steering.value==='arrows'?'arrows':'stick',steeringChosen:true});return;}
  if(await motionAllowed())update({steering:'tilt',steeringChosen:true});else{steering.value='stick';note.textContent='Motion sensors were not allowed, so steering stays on the stick.';}
 };
 aim.onchange=()=>update({aimAssist:aim.value==='assist'});
 look.oninput=()=>update({lookSpeed:Number(look.value)});size.oninput=()=>update({buttonScale:Number(size.value)});
 return {element:panel,refresh};
}
