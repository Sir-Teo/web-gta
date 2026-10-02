import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A phone's screen stays on while the game plays (the Screen Wake Lock, let go under the pause menu) and the touch
 * buttons buzz where the browser vibrates, unless the Vibration setting is off. The browser APIs are stand-ins that
 * record what the game asks of them. */
test.use({hasTouch:true});
test('a phone keeps its screen on while playing, and its buttons buzz',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const w=window as any;w.__device=[];
  Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async(type:string)=>{w.__device.push(`lock ${type}`);const s={released:false,release:async()=>{s.released=true;w.__device.push('release');}};return s;}}});
  Object.defineProperty(navigator,'vibrate',{configurable:true,value:(ms:number)=>{w.__device.push(`buzz ${ms}`);return true;}});});
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const device=()=>page.evaluate(()=>[...(window as any).__device] as string[]);
 expect(await device()).toEqual(['lock screen']);
 // A button press buzzes.
 const press=async(selector:string,id:number)=>{for(const type of ['pointerdown','pointerup'])await page.evaluate(({selector,type,id})=>{const b=document.querySelector(selector)!,r=b.getBoundingClientRect();
  b.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:r.x+r.width/2,clientY:r.y+r.height/2,bubbles:true,cancelable:true}));},{selector,type,id});};
 await press('.touch-button.jump:not([hidden])',11);expect((await device()).filter(e=>e.startsWith('buzz')).length).toBe(1);
 // The pause menu lets the screen go; Resume keeps it on again.
 await page.getByRole('button',{name:'Pause',exact:true}).dispatchEvent('pointerdown',{pointerType:'touch'});
 await expect.poll(async()=>(await device()).at(-1)).toBe('release');
 // Vibration off: no more buzzing.
 await page.getByRole('button',{name:'Controls',exact:true}).click();await page.getByLabel('Vibration',{exact:true}).uncheck();
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 await expect.poll(async()=>(await device()).at(-1)).toBe('lock screen');
 await press('.touch-button.jump:not([hidden])',12);await page.waitForTimeout(300);
 expect((await device()).filter(e=>e.startsWith('buzz')).length).toBe(1);
 expect(errors).toEqual([]);
});
