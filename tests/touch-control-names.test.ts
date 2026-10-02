import {afterEach,expect,test} from 'vitest';
import {controlsNamedIn,gxtHudText,useTouchControlNames} from '../src/assets/gxt';
afterEach(()=>useTouchControlNames(false));
test('help text names the touch buttons on a touch screen and the keys otherwise',()=>{
 const text='Press ~k~~CONVERSATION_YES~ to accept or ~k~~CONVERSATION_NO~ to decline.~n~~k~~VEHICLE_ENTER_EXIT~ leaves.';
 expect(gxtHudText(text)).toBe('Press Y to accept or N to decline.\nF leaves.');
 useTouchControlNames(true);
 expect(gxtHudText(text)).toBe('Press YES to accept or NO to decline.\nENTER leaves.');
 // A control with no touch button keeps its key.
 expect(gxtHudText('~k~~PED_LOOKBEHIND~ looks behind')).toBe('MIDDLE MOUSE looks behind');
 expect(gxtHudText('~k~~CAMERA_CHANGE_VIEW_ALL_SITUATIONS~ changes the view')).toBe('CAMERA changes the view');
});
test('the stick\'s directions listed one by one are the stick, and steering is named as the settings steer',()=>{
 const move='Use ~k~~GO_FORWARD~, ~k~~GO_BACK~, ~k~~GO_LEFT~ and ~k~~GO_RIGHT~ to move Carl.',steer='Use ~k~~VEHICLE_STEERLEFT~ and ~k~~VEHICLE_STEERRIGHT~ to steer.';
 expect(gxtHudText(move)).toBe('Use W, S, A and D to move Carl.');
 useTouchControlNames(true);
 expect(gxtHudText(move)).toBe('Use the STICK to move Carl.');
 expect(gxtHudText(steer)).toBe('Use the STICK to steer.');
 // One direction alone stays a direction.
 expect(gxtHudText('Push ~k~~GO_FORWARD~ to walk.')).toBe('Push STICK UP to walk.');
 useTouchControlNames(true,'arrows');expect(gxtHudText(steer)).toBe('Use the ARROWS to steer.');
 expect(gxtHudText('Hold ~k~~VEHICLE_STEERLEFT~ to turn.')).toBe('Hold LEFT ARROW to turn.');
 // On foot the stick still walks, whatever steers the car.
 expect(gxtHudText(move)).toBe('Use the STICK to move Carl.');
 useTouchControlNames(true,'tilt');expect(gxtHudText(steer)).toBe('Use TILT to steer.');
});
test('the controls a shown text asks for are known from the text itself',()=>{
 useTouchControlNames(true);
 const shown=gxtHudText('Press ~k~~PED_ANSWER_PHONE~ to collect the weapon.');
 expect(controlsNamedIn(shown)).toEqual(['PED_ANSWER_PHONE']);
 expect(controlsNamedIn('A line that names nothing')).toEqual([]);
 expect(controlsNamedIn(gxtHudText('Tags sprayed'))).toEqual([]);
});
