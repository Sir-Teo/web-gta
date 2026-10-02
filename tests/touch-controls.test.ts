import {expect,test} from 'vitest';
import {goFullscreen,wantsTouchControls} from '../src/input/TouchControls';
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
test('starting on a phone takes the screen and holds it sideways, and a refusal leaves the page as it is',async()=>{
 const calls:string[]=[];
 const root={requestFullscreen:async(o:any)=>{calls.push(`fullscreen ${o.navigationUI}`);}} as unknown as Element;
 const orientation={lock:async(o:string)=>{calls.push(`lock ${o}`);}};
 await goFullscreen(root,{fullscreenElement:null},orientation);expect(calls).toEqual(['fullscreen hide','lock landscape']);
 // Already fullscreen (a resume): only the orientation is asked for again.
 calls.length=0;await goFullscreen(root,{fullscreenElement:root},orientation);expect(calls).toEqual(['lock landscape']);
 // An iPhone: no element fullscreen, so no lock either (it needs a fullscreen page).
 calls.length=0;await goFullscreen({} as Element,{fullscreenElement:null},orientation);expect(calls).toEqual([]);
 // A refused request does not throw out of the menu's button.
 const refused={requestFullscreen:async()=>{throw new TypeError('Permissions check failed');}} as unknown as Element;
 await expect(goFullscreen(refused,{fullscreenElement:null},orientation)).resolves.toBeUndefined();
});
