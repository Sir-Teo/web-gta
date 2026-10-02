/* The touch controls' options, as the iOS and Android port's settings give them: the steering method (the stick, or tilting
 * the device like a wheel, the port's accelerometer option), lock-on aim assist or free aim, how fast a drag turns the
 * camera, and how big the buttons are. Kept in the browser like the other settings. */
export type TouchSteering='stick'|'tilt';
export interface TouchSettings {steering:TouchSteering;aimAssist:boolean;lookSpeed:number;buttonScale:number}
export const DEFAULT_TOUCH:TouchSettings={steering:'stick',aimAssist:true,lookSpeed:1,buttonScale:1};
export const LOOK_SPEED_RANGE={min:.5,max:2},BUTTON_SCALE_RANGE={min:.8,max:1.3};
const KEY='grove-touch-v1';
const clamp=(value:unknown,range:{min:number;max:number},fallback:number)=>typeof value==='number'&&Number.isFinite(value)?Math.min(range.max,Math.max(range.min,value)):fallback;
export function parseTouchSettings(value:unknown):TouchSettings{
 const data=value&&typeof value==='object'?value as Partial<TouchSettings>:{};
 return {steering:data.steering==='tilt'?'tilt':'stick',aimAssist:typeof data.aimAssist==='boolean'?data.aimAssist:DEFAULT_TOUCH.aimAssist,
  lookSpeed:clamp(data.lookSpeed,LOOK_SPEED_RANGE,DEFAULT_TOUCH.lookSpeed),buttonScale:clamp(data.buttonScale,BUTTON_SCALE_RANGE,DEFAULT_TOUCH.buttonScale)};
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
