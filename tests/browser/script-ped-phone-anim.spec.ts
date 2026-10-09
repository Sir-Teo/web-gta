import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

/** A ped on TASK_USE_MOBILE_PHONE holds the cellphone model in its hand. That model's frames once kept their own
 * frame tags, so the next clip a script gave the ped (HOODS5's phone call, then a GANGS clip) failed to bind:
 * "Animation binding requires one model instance". */
test('a script ped given a clip after a phone call plays it',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const ped=await page.evaluate(()=>{const w=(window as any).__game.missionForProfiling().runtime.world,p=w.pedPosition(1);return w.createChar(24,106,p.x+3,p.y+3,p.z);});
 await page.waitForFunction((h:number)=>(window as any).__game.missionForProfiling().peds.entity(h)!==undefined,ped,{timeout:60000});
 await page.evaluate((h:number)=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(h,{kind:'useMobilePhone',start:true},0x0729),ped);
 // The phone is in his hand once its model has been read.
 await expect.poll(()=>page.evaluate((h:number)=>{const e=(window as any).__game.missionForProfiling().peds.entity(h);let n=0;e?.view?.hand?.()?.traverse((o:any)=>{if(o.isMesh)n++;});return n;},ped),{timeout:30000}).toBeGreaterThan(0);
 await page.evaluate((h:number)=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(h,{kind:'playAnim',animationName:'PRTIAL_GNGTLKH',animationFile:'GANGS',blendSpeed:4,loop:false,lockX:false,lockY:false,keepLastFrame:false,time:-1,interruptable:false},0x0812),ped);
 await expect.poll(()=>page.evaluate((h:number)=>(window as any).__game.missionForProfiling().peds.entity(h)?.view?.hasReaction?.('prtial_gngtlkh')??false,ped),{timeout:30000}).toBe(true);
 expect(errors).toEqual([]);
});
