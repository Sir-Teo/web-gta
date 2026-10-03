/* Gyro aiming, a touch setting off by default: while aiming or through a scope, the phone turned turns the camera, as
 * phone shooters offer and a thumb on the glass cannot match for small corrections. Not the iOS port's (it tilts only to
 * steer); the browser's devicemotion rotation rate gives it. */
import {SCREEN_AXES} from './touchSettings';

/** Degrees a second under which a hand's tremor and the gyroscope's drift turn nothing. */
export const GYRO_DEAD_ZONE=1.5;

/** The camera's turn for a devicemotion rotation rate (degrees a second about the device's x, y and z: `beta`, `gamma`
 * and `alpha`, counter-clockwise seen from each axis' end) over `seconds`, the screen at `screenAngle`: `yaw` to the
 * left and `pitch` up, in radians. Turning about the screen's up axis turns the view (the back of the phone swings
 * left as the rotation is counter-clockwise from above); about its right axis the top edge coming toward the player
 * looks up. Rolling it like a wheel, about the axis out of the screen, aims nothing. */
export function gyroLook(rate:{alpha?:number|null;beta?:number|null;gamma?:number|null}|null|undefined,screenAngle:number,seconds:number,deadZone=GYRO_DEAD_ZONE){
 const x=finite(rate?.beta),y=finite(rate?.gamma);
 const [rx,ry,ux,uy]=SCREEN_AXES[((Math.round(screenAngle/90)%4)+4)%4];
 const radians=(degreesPerSecond:number)=>Math.abs(degreesPerSecond)<deadZone?0:degreesPerSecond*Math.PI/180*Math.max(0,Math.min(.1,seconds));
 return {yaw:radians(x*ux+y*uy),pitch:radians(x*rx+y*ry)};
}
const finite=(v:number|null|undefined)=>typeof v==='number'&&Number.isFinite(v)?v:0;
