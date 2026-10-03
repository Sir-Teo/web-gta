import {expect,test} from 'vitest';
import {PORT_LAYOUTS,PORT_SIZE,goFullscreen,portStickTravel,isTabletScreen,offerInstall,portLayoutFile,suggestHomeScreen,wantsTouchControls,type PortLayoutFile} from '../src/input/TouchControls';
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
 // Marked as the touch stick's, which the vehicles steer on the port's curve (a pad's stick is not).
 input.stick={x:.5,y:.8};expect(input.axes()).toEqual({x:.5,y:.8,forward:true,back:false,touchStick:true});
 input.stick={x:0,y:-.6};expect(input.axes()).toMatchObject({forward:false,back:true});
 // A thumb resting in the dead zone is no push.
 input.stick={x:.05,y:.05};expect(input.axes()).toMatchObject({x:0,y:0});
 // At the wheel the Gas and Brake pedals drive whatever the stick's push: full lock to the side still accelerates.
 input.stick={x:1,y:0};input.hold('KeyW');expect(input.axes()).toEqual({x:1,y:1,forward:true,back:false,touchStick:true});
 input.release('KeyW');input.hold('KeyS');expect(input.axes()).toEqual({x:1,y:-1,forward:false,back:true,touchStick:true});
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
test('the touch layout is the port\'s file for the device: a phone\'s or a tablet\'s, 3:2 and wider or narrower',()=>{
 // CTouchInterface: the UIDevice idiom picks phone or iPad, and a screen at least 1.5 across its height the widescreen file.
 expect(portLayoutFile(844,390,false)).toBe('TouchDefaultPhoneWidescreen');expect(portLayoutFile(480,320,false)).toBe('TouchDefaultPhoneWidescreen');
 expect(portLayoutFile(560,400,false)).toBe('TouchDefaultPhone3x2');
 expect(portLayoutFile(1024,768,true)).toBe('TouchDefaultTablet4x3');expect(portLayoutFile(1194,834,true)).toBe('TouchDefaultTablet4x3');
 // An iPad under Safari's bars is a wider page.
 expect(portLayoutFile(1194,760,true)).toBe('TouchDefaultTabletWidescreen');
 expect(isTabletScreen({width:390,height:844})).toBe(false);expect(isTabletScreen({width:430,height:932})).toBe(false);
 expect(isTabletScreen({width:744,height:1133})).toBe(true);expect(isTabletScreen({width:1366,height:1024})).toBe(true);
});
test('each layout puts the buttons at its own file\'s widgets, sized as the port reads them',()=>{
 // SCALE_SMALL, _MEDIUM, _LARGE and _LARGER from the executable.
 expect(PORT_SIZE).toEqual({small:17,medium:24,large:29,larger:32});
 const phone=PORT_LAYOUTS.TouchDefaultPhoneWidescreen;
 expect(phone.foot).toMatchObject({fire:[607,310,'medium'],aim:[553,310,'medium'],enter:[607,246,'medium'],sprint:[603,381,'large'],jump:[554,245,'medium'],crouch:[501,245,'medium'],reload:[501,310,'medium']});
 expect(phone.vehicle).toMatchObject({gas:[602,380,'large'],reverse:[541,381,'large'],sprint:[614,191,'small'],'steer-left':[36,380,'large']});
 // A drive-by's ◀ Look and Look ▶ are the port's VEHICLE_SHOOT_LEFT and _RIGHT widgets, above the steering arrows.
 expect(phone.vehicle).toMatchObject({'look-left':[42,310,'medium'],'look-right':[97,310,'medium']});
 expect(PORT_LAYOUTS.TouchDefaultTablet4x3.vehicle).toMatchObject({'look-left':[42,335,'medium'],'look-right':[97,335,'medium']});
 // A yes and a no are the port's POSITIVE and NEGATIVE: low in the middle of a phone, high on an iPad's 4:3.
 expect(phone.vehicle).toMatchObject({'reply-yes':[390,424,'small'],'reply-no':[240,424,'small']});
 // A shop's Select and Back are its STORE_ACCEPT and STORE_CANCEL, large under the right thumb on a phone.
 expect(phone.vehicle).toMatchObject({'store-accept':[535,405,'large'],'store-cancel':[600,405,'large']});expect(PORT_LAYOUTS.TouchDefaultTablet4x3.vehicle).toMatchObject({'store-accept':[547,415,'medium'],'store-cancel':[600,415,'medium']});expect(PORT_LAYOUTS.TouchDefaultTablet4x3.vehicle).toMatchObject({'reply-yes':[458,71,'small'],'reply-no':[412,71,'small']});
 // An iPad's 4:3: rows lower, the attack inside the aim; a 3:2 phone's buttons larger.
 expect(PORT_LAYOUTS.TouchDefaultTablet4x3.foot).toMatchObject({fire:[552,335,'medium'],aim:[605,335,'medium'],enter:[605,284,'medium'],crouch:[499,284,'medium']});
 expect(PORT_LAYOUTS.TouchDefaultPhone3x2.vehicle).toMatchObject({gas:[598,383,'larger'],fire:[538,315,'large'],nitro:[476,315,'large']});
 // At the port's sizes no two buttons of a layout touch on a screen of its shape: centres at their places over the
 // screen, radii by its width (no wider than 16:9 of its height).
 const screens:Record<PortLayoutFile,readonly [number,number]>={TouchDefaultPhoneWidescreen:[844,390],TouchDefaultPhone3x2:[560,400],TouchDefaultTabletWidescreen:[1194,760],TouchDefaultTablet4x3:[1024,768]};
 for(const [file,[width,height]] of Object.entries(screens) as [PortLayoutFile,readonly [number,number]][])for(const places of Object.values(PORT_LAYOUTS[file])){
  // (Skip shows in a cutscene, and a shop's accept and cancel while its menu is up, each with no other button.)
 const buttons=Object.entries(places).filter(([name])=>!['skip','store-accept','store-cancel'].includes(name)),unit=Math.min(width,height*16/9)/640;
  for(const [i,[,a]] of buttons.entries())for(const [,b] of buttons.slice(i+1))
   expect(Math.hypot((a[0]-b[0])/640*width,(a[1]-b[1])/448*height)).toBeGreaterThan((PORT_SIZE[a[2]]+PORT_SIZE[b[2]])*unit);
 }
});
test('the stick travels as far as the port\'s widgets let the thumb go, on its 640-wide screen',()=>{
 // On foot CWidgetRegionMove's 0.45 of PED_MOVE's half width: 54 on a phone, less on a tablet's narrower region.
 expect(portStickTravel('TouchDefaultPhoneWidescreen','foot')).toBeCloseTo(54,4);expect(portStickTravel('TouchDefaultTablet4x3','foot')).toBeCloseTo(47.25,4);
 expect(portStickTravel('TouchDefaultTabletWidescreen','swim')).toBeCloseTo(40.5,4);
 // At the wheel and flying the steering stick's (0.65 - Analog Sensitivity / 100) × 130: 49.4 at its default 27.
 expect(portStickTravel('TouchDefaultPhoneWidescreen','vehicle')).toBeCloseTo(49.4,4);expect(portStickTravel('TouchDefaultTablet4x3','aircraft')).toBeCloseTo(49.4,4);
 expect(portStickTravel('TouchDefaultPhoneWidescreen','vehicle',45)).toBeCloseTo(26,4);
});
