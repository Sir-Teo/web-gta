/* The touch controls' options, as the iOS and Android port's settings give them: the steering method (the stick, the
 * port's own left and right arrow buttons, or tilting the device like a wheel, its accelerometer option), lock-on aim
 * assist or free aim, how fast a drag turns the camera and whether up looks down, how big the buttons are, and whether
 * a press buzzes. Kept in the browser like the other settings. */
import {DRAW_DISTANCE_DEFAULT} from '../render/lodDistance';
export type TouchSteering='stick'|'arrows'|'tilt';
/** How many peds and cars a phone keeps about (the port's own settings thin its density): a share of the original's. */
export type TouchDensity='full'|'medium'|'low';
export const DENSITY_SCALE:Readonly<Record<TouchDensity,number>>={full:1,medium:.65,low:.4};
export interface TouchSettings {steering:TouchSteering;aimAssist:boolean;lookSpeed:number;buttonScale:number;vibration:boolean;density:TouchDensity;
 /** The port's Visual Effects: the FX quality the game runs at (fewer particles, nearer grass, fewer clouds and no
  * real-time shadow below high). Max, very high, is not offered: every ped's real-time shadow is not drawn. */
 effects:'low'|'medium'|'high';
 /** The port's Draw Distance, 0 to 100 (70, its default, draws as the game does elsewhere): how far map models are
  * drawn before their low-detail stand-ins (lodDistance). */
 drawDistance:number;
 /** The port's Auto Climb (MOB_ATC, on by default): hanging from a ledge, the stick pushed forward climbs on as the
  * jump button held does. */
 autoClimb:boolean;
 /** The port's Analog Sensitivity (MOB_ANA, 20 to 45, 27 by default): the higher, the shorter the steering stick's
  * travel to full lock (portStickTravel). */
 analogSensitivity:number;
 /** The quality settings (visual effects, draw distance, resolution, population) are settled: chosen by the player,
  * or by the first play's measure (autoQuality). Until then a touch screen's first play may lower them. */
 qualityChosen:boolean;
 /** A drag up looks down, as an inverted pad's stick (the mouse's own setting is hidden on a touch screen). */
 invertLook:boolean;
 /** Aiming or through a scope, the phone turned turns the camera (gyroAim); off unless chosen. */
 gyroAim:boolean;
 /** How sharp the picture is: the renderer's one pixel per CSS pixel, the screen's own density up to twice it, or
  * three quarters of one (the port's Resolution setting; a phone's GPU pays for it in fill). */
 resolution:'low'|'standard'|'high';
 /** The port's Car Reflections: the cars' environment-mapped shine (off on its weakest device's preset). */
 carReflections:boolean;
 /** The port's Shadows: the player's real-time shadow (with Visual Effects at High; the peds' blob shadow otherwise),
  * a render pass a phone's GPU saves, off on the port's weakest device's preset. */
 shadows:boolean;
 /** Whether the resolution drops while the game falls behind (a phone held back as it warms) and comes back once it
  * keeps up (dynamicResolution). */
 dynamicResolution:boolean;
 /** Where the player has moved buttons (the port's Adjust Controls): by layout and slot ("foot:jump"), how far from
  * their place, in hundredths of the screen's short side. */
 layout:Readonly<Record<string,LayoutEntry>>;
 /** Whether the player has picked a steering method (the port asks the first time at the wheel). */
 steeringChosen:boolean}
export const DEFAULT_TOUCH:TouchSettings={steering:'stick',aimAssist:true,lookSpeed:1,buttonScale:1,vibration:true,density:'medium',effects:'high',drawDistance:DRAW_DISTANCE_DEFAULT,autoClimb:true,analogSensitivity:27,qualityChosen:false,invertLook:false,gyroAim:false,resolution:'standard',carReflections:true,shadows:true,dynamicResolution:true,layout:{},steeringChosen:false};
/** A moved button: how far across and down, and (when resized) its size against the others'. */
export type LayoutEntry=readonly [number,number]|readonly [number,number,number];
/** How far a button may be moved from its place (most of the way across a sideways screen and up it), and resized. */
/** What a kept layout's moves are measured from: the port's own places, in the layout file the device takes (a phone's
 * TouchDefaultPhoneWidescreen.cfg, an iPad's its own). Moves kept from the grid the buttons stood in before are
 * dropped, as they would carry a button off somewhere else. */
export const LAYOUT_ON='port-widescreen';
export const LAYOUT_RANGE={x:{min:-200,max:20},y:{min:-100,max:20},scale:{min:.6,max:1.6}};
const LAYOUT_KEY=/^(?:foot|vehicle|aircraft):[a-z-]+$/;
const within=(value:number,range:{min:number;max:number})=>Math.min(range.max,Math.max(range.min,value));
function parseLayout(value:unknown):Record<string,LayoutEntry>{
 const out:Record<string,LayoutEntry>={};if(!value||typeof value!=='object')return out;
 for(const [key,entry] of Object.entries(value))if(LAYOUT_KEY.test(key)&&Array.isArray(entry)&&(entry.length===2||entry.length===3)&&entry.every(n=>typeof n==='number'&&Number.isFinite(n))){
  const [x,y]=[within(entry[0],LAYOUT_RANGE.x),within(entry[1],LAYOUT_RANGE.y)];
  out[key]=entry.length===3?[x,y,within(entry[2],LAYOUT_RANGE.scale)]:[x,y];
 }
 return out;
}
export const LOOK_SPEED_RANGE={min:.5,max:2},BUTTON_SCALE_RANGE={min:.8,max:1.3},DRAW_DISTANCE_RANGE={min:0,max:100},ANALOG_SENSITIVITY_RANGE={min:20,max:45};
const KEY='grove-touch-v1';
const clamp=(value:unknown,range:{min:number;max:number},fallback:number)=>typeof value==='number'&&Number.isFinite(value)?Math.min(range.max,Math.max(range.min,value)):fallback;
export function parseTouchSettings(value:unknown):TouchSettings{
 const data=value&&typeof value==='object'?value as Partial<TouchSettings>:{};
 return {steering:data.steering==='tilt'||data.steering==='arrows'?data.steering:'stick',aimAssist:typeof data.aimAssist==='boolean'?data.aimAssist:DEFAULT_TOUCH.aimAssist,
  lookSpeed:clamp(data.lookSpeed,LOOK_SPEED_RANGE,DEFAULT_TOUCH.lookSpeed),buttonScale:clamp(data.buttonScale,BUTTON_SCALE_RANGE,DEFAULT_TOUCH.buttonScale),
  vibration:typeof data.vibration==='boolean'?data.vibration:DEFAULT_TOUCH.vibration,
  density:data.density==='full'||data.density==='low'||data.density==='medium'?data.density:DEFAULT_TOUCH.density,
  effects:data.effects==='low'||data.effects==='medium'?data.effects:'high',
  drawDistance:Math.round(clamp(data.drawDistance,DRAW_DISTANCE_RANGE,DRAW_DISTANCE_DEFAULT)),
  autoClimb:typeof data.autoClimb==='boolean'?data.autoClimb:DEFAULT_TOUCH.autoClimb,
  analogSensitivity:Math.round(clamp(data.analogSensitivity,ANALOG_SENSITIVITY_RANGE,DEFAULT_TOUCH.analogSensitivity)),
  qualityChosen:data.qualityChosen===true,
  invertLook:typeof data.invertLook==='boolean'?data.invertLook:DEFAULT_TOUCH.invertLook,gyroAim:data.gyroAim===true,layout:(data as {layoutOn?:unknown}).layoutOn===LAYOUT_ON?parseLayout(data.layout):{},resolution:data.resolution==='high'||data.resolution==='low'?data.resolution:'standard',
  carReflections:typeof data.carReflections==='boolean'?data.carReflections:DEFAULT_TOUCH.carReflections,
  shadows:typeof data.shadows==='boolean'?data.shadows:DEFAULT_TOUCH.shadows,
  dynamicResolution:typeof data.dynamicResolution==='boolean'?data.dynamicResolution:DEFAULT_TOUCH.dynamicResolution,
  // Settings kept before the question was asked chose by keeping a steering method.
  steeringChosen:typeof data.steeringChosen==='boolean'?data.steeringChosen:data.steering!==undefined};
}
export function readTouchSettings():TouchSettings{
 try{return parseTouchSettings(JSON.parse(localStorage.getItem(KEY)??'null'));}catch{return {...DEFAULT_TOUCH};}
}
export function saveTouchSettings(settings:TouchSettings){
 try{localStorage.setItem(KEY,JSON.stringify({...settings,layoutOn:LAYOUT_ON}));}catch{/* The session keeps its settings. */}
}
/** Degrees of tilt for full lock, and the dead zone a hand holding the phone level wobbles through. */
export const TILT_FULL_LOCK=25,TILT_DEAD_ZONE=3;
/** The steering a tilted device gives, −1 (left) to 1 (right), from a deviceorientation event's beta and gamma and the
 * screen's angle. A device held to play turns like a wheel about the axis out of its screen. The world's up, in the
 * device's axes, is (−cos β sin γ, sin β, cos β cos γ) for the event's Z-X'-Y'' angles; across the screen it leans by
 * the wheel's angle whatever the screen's lean back. The screen's right and up are the device's x and y turned by the
 * screen angle (90: up the device's x, right along its −y, a phone held sideways); lying flat there is no wheel. */
export function tiltSteering(beta:number|null,gamma:number|null,screenAngle:number){
 if(beta===null||gamma===null||!Number.isFinite(beta)||!Number.isFinite(gamma))return 0;
 const b=beta*Math.PI/180,g=gamma*Math.PI/180,x=-Math.cos(b)*Math.sin(g),y=Math.sin(b);
 const [rx,ry,ux,uy]=SCREEN_AXES[((Math.round(screenAngle/90)%4)+4)%4];
 const across=x*rx+y*ry,along=x*ux+y*uy;
 if(Math.hypot(across,along)<.2)return 0;
 const degrees=Math.atan2(-across,along)*180/Math.PI,magnitude=Math.max(0,Math.abs(degrees)-TILT_DEAD_ZONE)/(TILT_FULL_LOCK-TILT_DEAD_ZONE);
 return Math.sign(degrees)*Math.min(1,magnitude)||0;
}
/** The screen's right and up in the device's x and y, by quarter turns of the screen angle. */
export const SCREEN_AXES:readonly (readonly [number,number,number,number])[]=[[1,0,0,1],[0,-1,1,0],[-1,0,0,-1],[0,1,-1,0]];
/** The vehicles whose side mission the submission button (the PC's 2) starts and ends, by model: taxi, paramedic,
 * firefighter, vigilante, pimping, burglary and freight. The port shows its mission start and cancel widgets in them. */
export const SIDE_MISSION_VEHICLES:ReadonlySet<number>=new Set([420,438,416,407,544,596,597,598,599,523,427,490,528,432,425,430,447,575,609,537,538]);
/** The renderer's pixels per CSS pixel for a Resolution setting: Low three quarters (softer, for a GPU that cannot keep
 * up or a tablet's large screen), Standard one, High the screen's `density` up to twice. */
export const LOW_RESOLUTION=.75;
export function resolutionRatio(resolution:TouchSettings['resolution'],density=1){return resolution==='low'?LOW_RESOLUTION:resolution==='high'?Math.max(1,Math.min(2,density||1)):1;}
