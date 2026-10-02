import {afterEach,expect,test} from 'vitest';
import {controlsNamedIn,gxtHudText,useTouchControlNames} from '../src/assets/gxt';
afterEach(()=>useTouchControlNames(false));
test('help text names the touch buttons on a touch screen and the keys otherwise',()=>{
 const text='Press ~k~~CONVERSATION_YES~ to accept or ~k~~CONVERSATION_NO~ to decline.~n~~k~~VEHICLE_ENTER_EXIT~ leaves.';
 expect(gxtHudText(text)).toBe('Press Y to accept or N to decline.\nF leaves.');
 useTouchControlNames(true);
 expect(gxtHudText(text)).toBe('Press YES to accept or NO to decline.\nENTER leaves.');
 // A control with no touch button keeps its key.
 expect(gxtHudText('~k~~VEHICLE_TURRETUP~ lowers the crate')).toBe('NUM 2 lowers the crate');
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
test('looking and firing are named by the buttons that do them, at the wheel and flying',()=>{
 useTouchControlNames(true);
 expect(gxtHudText('To do a drive-by, first look left or right using ~k~~VEHICLE_LOOKLEFT~ or ~k~~VEHICLE_LOOKRIGHT~'))
  .toBe('To do a drive-by, first look left or right using ◀ LOOK or LOOK ▶');
 expect(gxtHudText('You can do a bunny hop by holding down ~k~~VEHICLE_FIREWEAPON_ALT~ then releasing it.')).toBe('You can do a bunny hop by holding down FIRE then releasing it.');
 // One button for both: named once.
 expect(gxtHudText('Use ~k~~VEHICLE_RADIO_STATION_UP~ and ~k~~VEHICLE_RADIO_STATION_DOWN~ to change radio station.')).toBe('Use RADIO to change radio station.');
 expect(gxtHudText('Use ~k~~PED_FIREWEAPON~ or ~k~~VEHICLE_FIREWEAPON_ALT~ to fire the water cannon.')).toBe('Use FIRE to fire the water cannon.');
 // Flying, the look keys are the rudder and the on-foot fire the rockets; the steering setting stays as it was.
 useTouchControlNames(true,'arrows',true);
 expect(gxtHudText('Press ~k~~VEHICLE_LOOKLEFT~ to turn left and ~k~~VEHICLE_LOOKRIGHT~ to turn right using the rudder.')).toBe('Press ◀ YAW to turn left and YAW ▶ to turn right using the rudder.');
 expect(gxtHudText('Press ~k~~VEHICLE_FIREWEAPON_ALT~ to fire the guns and ~k~~PED_FIREWEAPON~ to fire rockets.')).toBe('Press FIRE to fire the guns and ROCKET to fire rockets.');
 useTouchControlNames(true,undefined,false);
 expect(gxtHudText('~k~~VEHICLE_LOOKLEFT~ ~k~~VEHICLE_STEERLEFT~')).toBe('◀ LOOK LEFT ARROW');
 // Off, the keys again, and the touch steering and flying forgotten.
 useTouchControlNames(false);useTouchControlNames(true);expect(gxtHudText('~k~~VEHICLE_STEERLEFT~ ~k~~PED_FIREWEAPON~')).toBe('STICK LEFT FIRE');
});
