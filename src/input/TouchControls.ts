import type {Input} from './Input';
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
/** A button: its label, the key or mouse button it holds, and whether a tap latches it (aim) rather than holds it. */
interface ButtonSpec {label:string;code:string;className:string;toggle?:boolean;onFoot?:boolean;inVehicle?:boolean}
const BUTTONS:ButtonSpec[]=[
 {label:'Fire',code:'ControlLeft',className:'fire'},
 {label:'Aim',code:'MouseAim',className:'aim',toggle:true,onFoot:true},
 {label:'Jump',code:'Space',className:'jump',onFoot:true},
 {label:'Brake',code:'Space',className:'jump',inVehicle:true},
 {label:'Sprint',code:'ShiftLeft',className:'sprint',onFoot:true},
 {label:'Horn',code:'KeyH',className:'sprint',inVehicle:true},
 {label:'Enter',code:'KeyF',className:'enter'},
 {label:'Crouch',code:'KeyC',className:'crouch',onFoot:true},
 {label:'Look',code:'KeyQ',className:'crouch',inVehicle:true},
 {label:'Weapon',code:'KeyE',className:'weapon',onFoot:true},
 {label:'Reload',code:'KeyR',className:'reload',onFoot:true},
];
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
 private latched=new Set<string>();
 private buttons:{spec:ButtonSpec;element:HTMLButtonElement}[]=[];
 private inVehicle=false;
 private abort=new AbortController();
 constructor(private readonly input:Input,parent:HTMLElement,private readonly actions:{pause:()=>void;map:()=>void;arsenal:()=>void}){
  const options={signal:this.abort.signal};
  this.element.className='touch-controls';this.element.setAttribute('aria-label','Touch controls');
  const look=document.createElement('div');look.className='touch-look';
  const stickZone=document.createElement('div');stickZone.className='touch-stick-zone';
  this.stickBase.className='touch-stick';this.stickKnob.className='touch-stick-knob';this.stickBase.append(this.stickKnob);this.stickBase.hidden=true;
  stickZone.append(this.stickBase);
  const pad=document.createElement('div');pad.className='touch-buttons';
  for(const spec of BUTTONS){
   const button=document.createElement('button');button.type='button';button.textContent=spec.label;button.className=`touch-button ${spec.className}`;button.dataset.code=spec.code;
   button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();capture(button,e.pointerId);
    if(spec.toggle){if(this.latched.has(spec.code)){this.latched.delete(spec.code);input.release(spec.code);button.classList.remove('on');}else{this.latched.add(spec.code);input.hold(spec.code);button.classList.add('on');}return;}
    this.held.set(e.pointerId,spec.code);input.hold(spec.code);button.classList.add('on');},options);
   const up=(e:PointerEvent)=>{if(spec.toggle)return;const code=this.held.get(e.pointerId);if(code===undefined)return;this.held.delete(e.pointerId);if(![...this.held.values()].includes(code))input.release(code);button.classList.remove('on');};
   button.addEventListener('pointerup',up,options);button.addEventListener('pointercancel',up,options);
   pad.append(button);this.buttons.push({spec,element:button});
  }
  const top=document.createElement('div');top.className='touch-top';
  for(const [label,action] of [['☰',actions.pause],['Map',actions.map],['Guns',actions.arsenal]] as const){
   const button=document.createElement('button');button.type='button';button.textContent=label;button.className='touch-button small';
   button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();action();},options);top.append(button);
  }
  // A phone held upright squeezes the HUD, which is laid out for a sideways screen: until it is turned, a card asks for
  // that (the game underneath stays as it is). Play anyway keeps it upright for the rest of the visit.
  const rotate=document.createElement('div');rotate.className='touch-rotate';rotate.setAttribute('role','status');
  const rotateText=document.createElement('p');rotateText.textContent='Turn your phone sideways to play';
  const rotateDismiss=document.createElement('button');rotateDismiss.type='button';rotateDismiss.className='touch-button small';rotateDismiss.textContent='Play anyway';
  rotateDismiss.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();rotate.classList.add('dismissed');},options);
  rotate.append(rotateText,rotateDismiss);
  this.element.append(look,stickZone,pad,top,rotate);parent.append(this.element);
  // The stick floats: it is centred where the thumb lands in the left zone and follows it out to its radius.
  stickZone.addEventListener('pointerdown',e=>{if(this.stickPointer!==undefined)return;e.preventDefault();capture(stickZone,e.pointerId);
   this.stickPointer=e.pointerId;this.stickOrigin={x:e.clientX,y:e.clientY};const r=stickZone.getBoundingClientRect();
   this.stickBase.style.left=`${e.clientX-r.left}px`;this.stickBase.style.top=`${e.clientY-r.top}px`;this.stickBase.hidden=false;this.moveStick(e.clientX,e.clientY);},options);
  stickZone.addEventListener('pointermove',e=>{if(e.pointerId===this.stickPointer)this.moveStick(e.clientX,e.clientY);},options);
  const stickUp=(e:PointerEvent)=>{if(e.pointerId!==this.stickPointer)return;this.stickPointer=undefined;this.stickBase.hidden=true;input.stick=undefined;input.release('AltLeft');this.stickKnob.style.transform='';};
  stickZone.addEventListener('pointerup',stickUp,options);stickZone.addEventListener('pointercancel',stickUp,options);
  // The right side drags the camera as the mouse does.
  look.addEventListener('pointerdown',e=>{if(this.lookPointer!==undefined)return;e.preventDefault();capture(look,e.pointerId);this.lookPointer=e.pointerId;this.lookLast={x:e.clientX,y:e.clientY};},options);
  look.addEventListener('pointermove',e=>{if(e.pointerId!==this.lookPointer)return;input.lookX+=(e.clientX-this.lookLast.x)*LOOK_GAIN;input.lookY+=(e.clientY-this.lookLast.y)*LOOK_GAIN;this.lookLast={x:e.clientX,y:e.clientY};input.touches++;},options);
  const lookUp=(e:PointerEvent)=>{if(e.pointerId===this.lookPointer)this.lookPointer=undefined;};
  look.addEventListener('pointerup',lookUp,options);look.addEventListener('pointercancel',lookUp,options);
  // No page scroll, zoom or long-press menu under the thumbs.
  this.element.addEventListener('touchstart',e=>{if(e.cancelable)e.preventDefault();},{...options,passive:false});
  this.element.addEventListener('contextmenu',e=>e.preventDefault(),options);
  this.setMode(false);
 }
 private moveStick(x:number,y:number){
  let dx=x-this.stickOrigin.x,dy=y-this.stickOrigin.y;const length=Math.hypot(dx,dy);
  if(length>STICK_RADIUS){dx*=STICK_RADIUS/length;dy*=STICK_RADIUS/length;}
  this.stickKnob.style.transform=`translate(${dx}px,${dy}px)`;
  const stick={x:dx/STICK_RADIUS,y:-dy/STICK_RADIUS};this.input.stick=stick;
  // A light push walks (the PC's walk key); past half way CJ runs.
  if(Math.hypot(stick.x,stick.y)<.55)this.input.hold('AltLeft');else this.input.release('AltLeft');
 }
 /** On foot or at the wheel: the buttons for the other are hidden, and a latched aim is let go in a vehicle. */
 setMode(inVehicle:boolean){
  if(inVehicle===this.inVehicle&&this.buttons.length&&this.element.dataset.mode)return;
  this.inVehicle=inVehicle;this.element.dataset.mode=inVehicle?'vehicle':'foot';
  for(const {spec,element} of this.buttons)element.hidden=inVehicle?!!spec.onFoot:!!spec.inVehicle;
  if(inVehicle)for(const code of [...this.latched]){this.latched.delete(code);this.input.release(code);}
  for(const {spec,element} of this.buttons)if(spec.toggle)element.classList.toggle('on',this.latched.has(spec.code));
 }
 /** Hidden under the menus: everything held is let go so nothing stays pressed behind them. */
 setVisible(visible:boolean){
  if(this.element.hidden===!visible)return;
  this.element.hidden=!visible;
  if(!visible){for(const code of new Set([...this.held.values(),...this.latched]))this.input.release(code);this.held.clear();this.latched.clear();this.input.stick=undefined;this.input.release('AltLeft');this.stickPointer=this.lookPointer=undefined;this.stickBase.hidden=true;
   for(const {element} of this.buttons)element.classList.remove('on');}
 }
 dispose(){this.abort.abort();this.element.remove();}
}
