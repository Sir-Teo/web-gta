import type {Input} from './Input';
/* A game controller (the browser's Gamepad API, its standard mapping) played as SA's own pad, the way the iOS and
 * Android port takes an MFi or Bluetooth controller: the PS2 original's layout, its buttons holding the keys the PC binds
 * to the same actions, so everything that reads the keyboard (and the script's pad, which reads it too) sees them. The
 * left stick is an analog stick like the touch one, walking under half way and steering at the wheel; the right stick
 * turns the camera. Under the pause menu the D-pad moves between its buttons and cross presses one; Start pauses and
 * resumes. */
/** The standard mapping's buttons, by the PlayStation names SA's own controls use. */
export const PAD={cross:0,circle:1,square:2,triangle:3,l1:4,r1:5,l2:6,r2:7,select:8,start:9,l3:10,r3:11,up:12,down:13,left:14,right:15} as const;
type PadButton=keyof typeof PAD;
/** On foot: cross sprints, square jumps, triangle enters, circle attacks, R1 targets, L1 is the action button, L2 and R2
 * step the weapon, L3 crouches, R3 looks behind, select changes the view, the D-pad's up and down lead and hold the
 * crew and its left and right say no and yes. */
const FOOT:Readonly<Partial<Record<PadButton,string>>>={cross:'ShiftLeft',square:'Space',triangle:'KeyF',circle:'ControlLeft',r1:'MouseAim',l1:'Tab',
 l2:'KeyQ',r2:'KeyE',l3:'KeyC',r3:'MouseMiddle',select:'KeyV',up:'KeyG',down:'KeyH',left:'KeyN',right:'KeyY'};
/** At the wheel: cross accelerates, square brakes and reverses, R1 is the handbrake, circle fires, triangle gets out,
 * L2 and R2 look left and right (both behind), L1 and L3 sound the horn, R3 starts the vehicle's side mission, select
 * changes the view and the D-pad's up and down tune the radio. */
const VEHICLE:Readonly<Partial<Record<PadButton,string>>>={cross:'KeyW',square:'KeyS',r1:'Space',circle:'ControlLeft',triangle:'KeyF',
 l2:'KeyQ',r2:'KeyE',l1:'KeyH',l3:'KeyH',r3:'Digit2',select:'KeyV',up:'KeyN',down:'KeyN'};
/** Through a scope square and cross zoom in and out (the PC's X and Z), as the PS2's did. */
const SCOPE:Readonly<Partial<Record<PadButton,string>>>={...FOOT,square:'KeyX',cross:'KeyZ'};
/** Flying, circle fires the rockets and L1 the guns (the help's PED_FIREWEAPON and VEHICLE_FIREWEAPON_ALT), L2 and R2
 * are the rudder, and L3 the horn. */
const AIRCRAFT:Readonly<Partial<Record<PadButton,string>>>={...VEHICLE,circle:'KeyB',l1:'ControlLeft',up:undefined,down:undefined};
/** What the pad plays: on foot, through a scope, at the wheel, flying, or a menu. */
export type PadContext='foot'|'scope'|'vehicle'|'aircraft'|'menu';
const MAPS:Readonly<Record<Exclude<PadContext,'menu'>,Readonly<Partial<Record<PadButton,string>>>>>={foot:FOOT,scope:SCOPE,vehicle:VEHICLE,aircraft:AIRCRAFT};
/** The keys a pad's pressed buttons hold in a context. */
export function padCodes(pressed:readonly boolean[],context:Exclude<PadContext,'menu'>):Set<string>{
 const map=MAPS[context],codes=new Set<string>();
 for(const [name,index] of Object.entries(PAD) as [PadButton,number][]){const code=map[name];if(code&&pressed[index])codes.add(code);}
 return codes;
}
/** A stick's dead zone (a resting stick drifts) and the camera's turn at full deflection, in mouse pixels a second. */
export const STICK_DEAD_ZONE=.2,LOOK_PIXELS_PER_SECOND=900;
interface PadState{readonly id?:string;readonly buttons:readonly {pressed:boolean;value:number}[];readonly axes:readonly number[];readonly mapping:string;readonly connected:boolean}
/** Whose names the buttons go by: a PlayStation pad's (Sony's vendor id, or its name), else the Xbox layout's letters
 * that MFi and most other pads print. */
export type PadFamily='playstation'|'xbox';
export const padFamily=(id='')=>/054c|playstation|dualshock|dualsense/i.test(id)?'playstation' as const:'xbox' as const;
export interface PadFrame{start:boolean;menuMove:-1|0|1;menuSelect:boolean}
export class GamepadInput {
 /** When a pad last moved a stick or pressed a button (performance.now()): the touch controls stand aside after it. */
 lastUsed=-Infinity;
 /** The family of the pad played last. */
 family:PadFamily='xbox';
 private held=new Set<string>();private ownsStick=false;private previous:boolean[]=[];
 constructor(private readonly input:Input,private readonly pads:()=>readonly (PadState|null)[]=()=>(navigator.getGamepads?.()??[]) as readonly (PadState|null)[]){}
 /** One frame: `context` is what the pad plays, the menu while the game is held. */
 poll(dt:number,context:PadContext,now=performance.now()):PadFrame{
  const pad=this.pads().find(p=>!!p&&p.connected&&p.mapping==='standard');
  if(pad)this.family=padFamily(pad.id);
  const pressed=pad?pad.buttons.map(b=>b.pressed||b.value>.5):[];
  const edge=(index:number)=>!!pressed[index]&&!this.previous[index];
  const frame:PadFrame={start:edge(PAD.start),menuMove:context==='menu'?(edge(PAD.up)?-1:edge(PAD.down)?1:0):0,menuSelect:context==='menu'&&edge(PAD.cross)};
  this.previous=pressed;
  const [lx=0,ly=0,rx=0,ry=0]=pad?.axes??[],dead=(x:number,y:number)=>Math.hypot(x,y)<STICK_DEAD_ZONE;
  if(pressed.some(Boolean)||!dead(lx,ly)||!dead(rx,ry))this.lastUsed=now;
  // The game's keys: the buttons held now, the ones let go released once the frame has seen them.
  const codes=context==='menu'?new Set<string>():padCodes(pressed,context);
  for(const code of this.held)if(!codes.has(code)){this.held.delete(code);this.input.releaseAfterFrame(code);}
  for(const code of codes)if(!this.held.has(code)){this.held.add(code);this.input.hold(code);}
  // The left stick as the touch stick's analog walk (a light push walks, the PC's Alt) and steer.
  if(context!=='menu'&&!dead(lx,ly)){
   const length=Math.min(1,Math.hypot(lx,ly)),scale=length/Math.hypot(lx,ly);
   this.input.stick={x:lx*scale,y:-ly*scale};this.input.stickFromPad=true;this.ownsStick=true;
   if(length<.55)this.input.hold('AltLeft');else this.input.release('AltLeft');
  }else if(this.ownsStick){this.input.stick=undefined;this.input.stickFromPad=false;this.input.release('AltLeft');this.ownsStick=false;}
  // The right stick turns the camera as a mouse would.
  if(context!=='menu'&&!dead(rx,ry)){this.input.lookX+=rx*LOOK_PIXELS_PER_SECOND*dt;this.input.lookY+=ry*LOOK_PIXELS_PER_SECOND*dt;this.input.touches++;}
  return frame;
 }
}
