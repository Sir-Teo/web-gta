import {afterEach,expect,test} from 'vitest';
import {controlsNamedIn,gxtHudText,useTouchControlNames} from '../src/assets/gxt';
afterEach(()=>useTouchControlNames(false));
test('help text names the touch buttons on a touch screen and the keys otherwise',()=>{
 const text='Press ~k~~CONVERSATION_YES~ to accept or ~k~~CONVERSATION_NO~ to decline.~n~~k~~VEHICLE_ENTER_EXIT~ leaves.';
 expect(gxtHudText(text)).toBe('Press Y to accept or N to decline.\nF leaves.');
 useTouchControlNames(true);
 expect(gxtHudText(text)).toBe('Press YES to accept or NO to decline.\nENTER leaves.');
 // A control with no touch button keeps its key.
 expect(gxtHudText('~k~~CAMERA_CHANGE_VIEW_ALL_SITUATIONS~ changes the view')).toBe('V changes the view');
});
test('the controls a shown text asks for are known from the text itself',()=>{
 useTouchControlNames(true);
 const shown=gxtHudText('Press ~k~~PED_ANSWER_PHONE~ to collect the weapon.');
 expect(controlsNamedIn(shown)).toEqual(['PED_ANSWER_PHONE']);
 expect(controlsNamedIn('A line that names nothing')).toEqual([]);
 expect(controlsNamedIn(gxtHudText('Tags sprayed'))).toEqual([]);
});
