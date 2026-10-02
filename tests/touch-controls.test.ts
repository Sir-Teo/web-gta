import {expect,test} from 'vitest';
import {goFullscreen,offerInstall,suggestHomeScreen,wantsTouchControls} from '../src/input/TouchControls';
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
 // At the wheel the Gas and Brake pedals drive whatever the stick's push: full lock to the side still accelerates.
 input.stick={x:1,y:0};input.hold('KeyW');expect(input.axes()).toEqual({x:1,y:1,forward:true,back:false});
 input.release('KeyW');input.hold('KeyS');expect(input.axes()).toEqual({x:1,y:-1,forward:false,back:true});
 input.hold('KeyW');expect(input.axes()).toMatchObject({forward:true,back:true});input.release('KeyW');input.release('KeyS');
 input.stick=undefined;input.hold('KeyF');expect(input.down('KeyF')).toBe(true);expect(input.consume('KeyF')).toBe(true);expect(input.consume('KeyF')).toBe(false);
 input.release('KeyF');expect(input.down('KeyF')).toBe(false);
 input.tap('KeyM');expect(input.down('KeyM')).toBe(false);expect(input.consume('KeyM')).toBe(true);
 // A tap quicker than a frame stays held through one whole game frame, then goes.
 input.hold('MenuDown');input.releaseAfterFrame('MenuDown');expect(input.down('MenuDown')).toBe(true);
 input.frameStart();expect(input.down('MenuDown')).toBe(true);
 input.frameStart();expect(input.down('MenuDown')).toBe(false);
 // Held across a frame already, it goes at once.
 input.hold('KeyW');input.frameStart();input.releaseAfterFrame('KeyW');expect(input.down('KeyW')).toBe(false);
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
test('an iPhone in its browser is told the home screen plays full screen, not once it plays from there or can go fullscreen',()=>{
 const iphone={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'};
 expect(suggestHomeScreen({},iphone,false)).toBe(true);
 // Opened from the home screen (navigator.standalone, or the manifest's display mode).
 expect(suggestHomeScreen({},{...iphone,standalone:true},false)).toBe(false);expect(suggestHomeScreen({},iphone,true)).toBe(false);
 // A browser that can take the screen itself, and an Android phone.
 expect(suggestHomeScreen({requestFullscreen:()=>{}},iphone,false)).toBe(false);
 expect(suggestHomeScreen({},{userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36'},false)).toBe(false);
});
test('Android\'s install offer is held for the menu\'s button, which takes it once',async()=>{
 const target=new EventTarget(),button={hidden:true,onclick:null as null|(()=>void)},prompted:string[]=[];
 const stop=offerInstall(button as unknown as HTMLButtonElement,target);
 const offer=()=>Object.assign(new Event('beforeinstallprompt',{cancelable:true}),{prompt:async()=>{prompted.push('prompt');},userChoice:Promise.resolve({outcome:'accepted'})});
 // No offer, no button; the browser's own bar is held back for it.
 button.onclick!();expect(prompted).toEqual([]);
 const first=offer();target.dispatchEvent(first);expect(first.defaultPrevented).toBe(true);expect(button.hidden).toBe(false);
 button.onclick!();button.onclick!();expect(prompted).toEqual(['prompt']);expect(button.hidden).toBe(true);
 // Offered again (dismissed), then installed: the button goes.
 target.dispatchEvent(offer());expect(button.hidden).toBe(false);target.dispatchEvent(new Event('appinstalled'));expect(button.hidden).toBe(true);
 stop();target.dispatchEvent(offer());expect(button.hidden).toBe(true);
});
