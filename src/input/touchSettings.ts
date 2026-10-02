/* The touch controls' options, as the iOS and Android port's settings give them: the steering method (the stick, the
 * port's own left and right arrow buttons, or tilting the device like a wheel, its accelerometer option), lock-on aim
 * assist or free aim, how fast a drag turns the camera and whether up looks down, how big the buttons are, and whether
 * a press buzzes. Kept in the browser like the other settings. */
export type TouchSteering='stick'|'arrows'|'tilt';
/** How many peds and cars a phone keeps about (the port's own settings thin its density): a share of the original's. */
export type TouchDensity='full'|'medium'|'low';
export const DENSITY_SCALE:Readonly<Record<TouchDensity,number>>={full:1,medium:.65,low:.4};
export interface TouchSettings {steering:TouchSteering;aimAssist:boolean;lookSpeed:number;buttonScale:number;vibration:boolean;density:TouchDensity;
 /** A drag up looks down, as an inverted pad's stick (the mouse's own setting is hidden on a touch screen). */
 invertLook:boolean;
 /** Where the player has moved buttons (the port's Adjust Controls): by layout and slot ("foot:jump"), how far from
  * their place, in hundredths of the screen's short side. */
 layout:Readonly<Record<string,readonly [number,number]>>;
 /** Whether the player has picked a steering method (the port asks the first time at the wheel). */
 steeringChosen:boolean}
export const DEFAULT_TOUCH:TouchSettings={steering:'stick',aimAssist:true,lookSpeed:1,buttonScale:1,vibration:true,density:'medium',invertLook:false,layout:{},steeringChosen:false};
/** How far a button may be moved from its place: most of the way across a sideways screen and up it. */
export const LAYOUT_RANGE={x:{min:-200,max:20},y:{min:-100,max:20}};
const LAYOUT_KEY=/^(?:foot|vehicle|aircraft):[a-z-]+$/;
function parseLayout(value:unknown):Record<string,[number,number]>{
 const out:Record<string,[number,number]>={};if(!value||typeof value!=='object')return out;
 for(const [key,offset] of Object.entries(value))if(LAYOUT_KEY.test(key)&&Array.isArray(offset)&&offset.length===2&&offset.every(n=>typeof n==='number'&&Number.isFinite(n)))
  out[key]=[Math.min(LAYOUT_RANGE.x.max,Math.max(LAYOUT_RANGE.x.min,offset[0])),Math.min(LAYOUT_RANGE.y.max,Math.max(LAYOUT_RANGE.y.min,offset[1]))];
 return out;
}
export const LOOK_SPEED_RANGE={min:.5,max:2},BUTTON_SCALE_RANGE={min:.8,max:1.3};
const KEY='grove-touch-v1';
const clamp=(value:unknown,range:{min:number;max:number},fallback:number)=>typeof value==='number'&&Number.isFinite(value)?Math.min(range.max,Math.max(range.min,value)):fallback;
export function parseTouchSettings(value:unknown):TouchSettings{
 const data=value&&typeof value==='object'?value as Partial<TouchSettings>:{};
 return {steering:data.steering==='tilt'||data.steering==='arrows'?data.steering:'stick',aimAssist:typeof data.aimAssist==='boolean'?data.aimAssist:DEFAULT_TOUCH.aimAssist,
  lookSpeed:clamp(data.lookSpeed,LOOK_SPEED_RANGE,DEFAULT_TOUCH.lookSpeed),buttonScale:clamp(data.buttonScale,BUTTON_SCALE_RANGE,DEFAULT_TOUCH.buttonScale),
  vibration:typeof data.vibration==='boolean'?data.vibration:DEFAULT_TOUCH.vibration,
  density:data.density==='full'||data.density==='low'||data.density==='medium'?data.density:DEFAULT_TOUCH.density,
  invertLook:typeof data.invertLook==='boolean'?data.invertLook:DEFAULT_TOUCH.invertLook,layout:parseLayout(data.layout),
  // Settings kept before the question was asked chose by keeping a steering method.
  steeringChosen:typeof data.steeringChosen==='boolean'?data.steeringChosen:data.steering!==undefined};
}
export function readTouchSettings():TouchSettings{
 try{return parseTouchSettings(JSON.parse(localStorage.getItem(KEY)??'null'));}catch{return {...DEFAULT_TOUCH};}
}
export function saveTouchSettings(settings:TouchSettings){
 try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{/* The session keeps its settings. */}
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
const SCREEN_AXES:readonly (readonly [number,number,number,number])[]=[[1,0,0,1],[0,-1,1,0],[-1,0,0,-1],[0,1,-1,0]];
/** The vehicles whose side mission the submission button (the PC's 2) starts and ends, by model: taxi, paramedic,
 * firefighter, vigilante, pimping, burglary and freight. The port shows its mission start and cancel widgets in them. */
export const SIDE_MISSION_VEHICLES:ReadonlySet<number>=new Set([420,438,416,407,544,596,597,598,599,523,427,490,528,432,425,430,447,575,609,537,538]);
