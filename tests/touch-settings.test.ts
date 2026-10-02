import {expect,test} from 'vitest';
import {DEFAULT_TOUCH,LAYOUT_RANGE,TILT_FULL_LOCK,parseTouchSettings,tiltSteering} from '../src/input/touchSettings';
test('touch settings read back what was kept, and anything else falls back to the defaults',()=>{
 expect(parseTouchSettings(null)).toEqual(DEFAULT_TOUCH);
 expect(parseTouchSettings({steering:'tilt',aimAssist:false,lookSpeed:1.5,buttonScale:1.2,vibration:false})).toEqual({steering:'tilt',aimAssist:false,lookSpeed:1.5,buttonScale:1.2,vibration:false,density:'medium',invertLook:false,layout:{},resolution:'standard',steeringChosen:true});
 expect(parseTouchSettings({steering:'wheel',aimAssist:'yes',lookSpeed:9,buttonScale:.1,vibration:'on'})).toEqual({steering:'stick',aimAssist:true,lookSpeed:2,buttonScale:.8,vibration:true,density:'medium',invertLook:false,layout:{},resolution:'standard',steeringChosen:true});
 expect(parseTouchSettings({steering:'arrows'}).steering).toBe('arrows');
 // A phone keeps fewer peds and cars about unless told Full (or Low).
 expect(parseTouchSettings({density:'full'}).density).toBe('full');expect(parseTouchSettings({density:'low'}).density).toBe('low');expect(parseTouchSettings({density:'most'}).density).toBe('medium');
 // Invert look is kept when set, and off otherwise.
 expect(parseTouchSettings({invertLook:true}).invertLook).toBe(true);expect(parseTouchSettings({invertLook:'yes'}).invertLook).toBe(false);
 // Moved buttons come back by layout and slot, within reach of the screen; anything else is dropped.
 expect(parseTouchSettings({layout:{'foot:fire':[-12.5,-4],'vehicle:gas':[-999,999],'cutscene:skip':[1,1],'foot:jump':[1],'foot:aim':['a','b']}}).layout)
  .toEqual({'foot:fire':[-12.5,-4],'vehicle:gas':[LAYOUT_RANGE.x.min,LAYOUT_RANGE.y.max]});
 expect(parseTouchSettings({layout:'moved'}).layout).toEqual({});
 // The steering question is asked once: answered, or settings kept with a steering method from before it was asked.
 expect(parseTouchSettings({aimAssist:false}).steeringChosen).toBe(false);expect(parseTouchSettings({steeringChosen:true}).steeringChosen).toBe(true);
});
/** The deviceorientation beta and gamma of a phone held sideways (screen angle 90: its x axis up the screen, its y axis
 * to the left), leaning back `lean` degrees from upright and turned clockwise like a wheel by `wheel` degrees. */
function pose(wheel:number,lean:number){
 const w=wheel*Math.PI/180,a=Math.cos(lean*Math.PI/180),c=Math.sin(lean*Math.PI/180);
 // The world's up in the device's axes: a cos w up the screen (x), a sin w toward the device's y, c out of the screen.
 const ux=a*Math.cos(w),uy=a*Math.sin(w),uz=c;
 return {beta:Math.asin(uy)*180/Math.PI,gamma:Math.atan2(-ux,uz)*180/Math.PI};
}
test('tilting a phone held sideways steers like a wheel, however far the screen leans back',()=>{
 for(const lean of [10,45,70]){
  const level=pose(0,lean),right=pose(TILT_FULL_LOCK/2+1.5,lean),full=pose(40,lean),left=pose(-TILT_FULL_LOCK/2-1.5,lean);
  expect(tiltSteering(level.beta,level.gamma,90)).toBe(0);
  expect(tiltSteering(right.beta,right.gamma,90)).toBeCloseTo(.5,5);expect(tiltSteering(left.beta,left.gamma,90)).toBeCloseTo(-.5,5);
  expect(tiltSteering(full.beta,full.gamma,90)).toBe(1);
  // Held the other way round, the same turn as the player sees it reads the other way in the device's axes.
  expect(tiltSteering(-right.beta,-right.gamma,270)).toBeCloseTo(.5,5);
 }
 // A little wobble about level is no steering; lying flat there is no wheel.
 const wobble=pose(2,45);expect(tiltSteering(wobble.beta,wobble.gamma,90)).toBe(0);
 expect(tiltSteering(0,0,90)).toBe(0);expect(tiltSteering(null,null,90)).toBe(0);
 // A tablet whose own way up is sideways reads screen angle 0 held so: its x axis to the right, y up the screen.
 const w=(TILT_FULL_LOCK/2+1.5)*Math.PI/180,a=Math.cos(Math.PI/4),c=Math.sin(Math.PI/4);
 expect(tiltSteering(Math.asin(a*Math.cos(w))*180/Math.PI,Math.atan2(a*Math.sin(w),c)*180/Math.PI,0)).toBeCloseTo(.5,5);
});
