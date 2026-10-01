import {expect,test} from 'vitest';
import {wantsTouchControls} from '../src/input/TouchControls';
import {Input} from '../src/input/Input';
test('touch controls show on a coarse pointer, and the address can force them either way',()=>{
 expect(wantsTouchControls('',true)).toBe(true);expect(wantsTouchControls('',false)).toBe(false);
 expect(wantsTouchControls('?touch=1',false)).toBe(true);expect(wantsTouchControls('?touch=0',true)).toBe(false);
});
test('the touch stick reads as an analog stick, and held buttons read as their keys',()=>{
 // Input only listens on the window and the canvas it is given.
 const target={addEventListener(){}};(globalThis as any).window??=target;
 const input=new Input(target as unknown as HTMLCanvasElement,()=>{});
 expect(input.axes()).toMatchObject({x:0,y:0,forward:false,back:false});
 input.stick={x:.5,y:.8};expect(input.axes()).toEqual({x:.5,y:.8,forward:true,back:false});
 input.stick={x:0,y:-.6};expect(input.axes()).toMatchObject({forward:false,back:true});
 // A thumb resting in the dead zone is no push.
 input.stick={x:.05,y:.05};expect(input.axes()).toMatchObject({x:0,y:0});
 input.stick=undefined;input.hold('KeyF');expect(input.down('KeyF')).toBe(true);expect(input.consume('KeyF')).toBe(true);expect(input.consume('KeyF')).toBe(false);
 input.release('KeyF');expect(input.down('KeyF')).toBe(false);
 input.tap('KeyM');expect(input.down('KeyM')).toBe(false);expect(input.consume('KeyM')).toBe(true);
 input.dispose();
});
