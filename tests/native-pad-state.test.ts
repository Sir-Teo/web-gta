import {expect,test} from 'vitest';
import {heldPadActions,padStateFromActions} from '../src/input/nativePadState';
import {BUTTON,ScmPads} from '../src/engine/ScmPads';

test('on foot the keys fill CPad as AffectControllerStateOn_ButtonDown_ThirdPersonOnly does',()=>{
 const s=padStateFromActions(heldPadActions(c=>['KeyW','Space','ShiftLeft','KeyF','MouseAim'].includes(c)),'thirdPerson');
 expect(s.leftStickY).toBe(-128);expect(s.square).toBe(255);expect(s.cross).toBe(255);expect(s.triangle).toBe(255);expect(s.rightShoulder1).toBe(255);
 expect(s.circle).toBe(0);
 // Both directions down: CheckAndSetStick leaves 0.
 expect(padStateFromActions(['GO_LEFT','GO_RIGHT'],'thirdPerson').leftStickX).toBe(0);
 // GROUP_CONTROL_FWD writes the up d-pad; both group keys clear it.
 expect(padStateFromActions(['GROUP_CONTROL_FWD'],'thirdPerson').dpadUp).toBe(255);
 const both=padStateFromActions(['GROUP_CONTROL_FWD','GROUP_CONTROL_BWD'],'thirdPerson');expect([both.dpadUp,both.dpadDown]).toEqual([0,0]);
});
test('at the wheel the same keys drive, brake and sound the horn',()=>{
 const s=padStateFromActions(heldPadActions(c=>['KeyW','Space','KeyH','KeyQ','KeyE','Numpad2'].includes(c)),'driving');
 expect(s.cross).toBe(255);expect(s.rightShoulder1).toBe(255);expect(s.leftShock).toBe(255);
 expect([s.leftShoulder2,s.rightShoulder2]).toEqual([255,255]);expect(s.rightStickY).toBe(128);
 // Jump and sprint are on-foot actions only.
 expect(s.square).toBe(0);expect(s.leftStickY).toBe(0);
});
test('first person zooms on square and cross and the script reads it through GetPadState',()=>{
 const pads=new ScmPads();
 padStateFromActions(heldPadActions(c=>c==='PageUp'),'firstPerson',false,pads.pads[0]);
 expect(pads.isPressed(0,BUTTON.square)).toBe(true);
 padStateFromActions([],'firstPerson',false,pads.pads[0]);expect(pads.isPressed(0,BUTTON.square)).toBe(false);
});
