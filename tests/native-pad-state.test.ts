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
test('the PC defaults the script reads: H for the group, Y and N for answers, the arrows and 2 at the wheel',()=>{
 const foot=(code:string)=>padStateFromActions(heldPadActions(c=>c===code),'thirdPerson');
 expect(foot('KeyH').dpadDown).toBe(255);
 expect(foot('KeyY').dpadRight).toBe(255);expect(foot('KeyN').dpadLeft).toBe(255);
 expect(foot('KeyQ').leftShoulder2).toBe(255);expect(foot('KeyE').rightShoulder2).toBe(255);
 const wheel=(code:string)=>padStateFromActions(heldPadActions(c=>c===code),'driving');
 // H at the wheel is the horn alone; the group button is on-foot only.
 expect([wheel('KeyH').leftShock,wheel('KeyH').dpadDown]).toEqual([255,0]);
 expect(wheel('KeyN').dpadLeft).toBe(255);
 expect(wheel('Digit2').rightShock).toBe(255);expect(wheel('NumpadAdd').rightShock).toBe(255);
 expect(wheel('ArrowUp').leftStickY).toBe(-128);expect(wheel('ArrowDown').leftStickY).toBe(128);
});
