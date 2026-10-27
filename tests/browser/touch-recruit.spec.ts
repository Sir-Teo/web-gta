import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A touch screen recruits, talks to and commands a crew by the port's widgets: aiming at a Families member puts up
 * Recruit and Yes and No, and a crew to command puts up Follow and Stay. The help text names those buttons only the first time, so without
 * these a phone could not grow or order a crew after it. */
test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
test('a phone recruits a Grove homie with Aim and Recruit, then orders him to stay',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 // Supply native respect for this touch-control fixture; recruitment capacity follows stat 64.
 await page.evaluate(()=>{const stats=(window as any).__game.missionForProfiling().runtime.game.stats;stats.set(64,400);stats.set(68,400);});
 // A Families member on the street (Grove Street is their turf).
 await page.waitForFunction(()=>(window as any).__game.pedestrians()?.snapshot().people.some((p:any)=>p.gang===1&&!p.follow&&p.health>0),undefined,{timeout:120000});
 const press=async(selector:string,type:string,id:number)=>page.evaluate(({selector,type,id})=>{const b=document.querySelector(selector)!,r=b.getBoundingClientRect();
  b.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:r.x+r.width/2,clientY:r.y+r.height/2,bubbles:true,cancelable:true}));},{selector,type,id});
 const recruit=page.getByRole('button',{name:'Recruit',exact:true}),follow=page.getByRole('button',{name:'Follow',exact:true}),stay=page.getByRole('button',{name:'Stay',exact:true});
 await expect(recruit).toBeHidden();await expect(stay).toBeHidden();await expect(page.getByRole('button',{name:'Yes',exact:true})).toBeHidden();
 // CJ two units east of him, facing him, with Aim latched: Recruit comes up.
 const stand=()=>page.evaluate(()=>{const g=(window as any).__game,m=g.pedestrians().snapshot().people.find((p:any)=>p.gang===1&&!p.follow&&p.health>0);
  if(!m)return false;g.placePlayer(m.position.x+2,m.position.y+.05,m.position.z);g.turnPlayer(-Math.PI/2);return true;});
 expect(await stand()).toBe(true);
 await press('.touch-button.aim','pointerdown',5);await press('.touch-button.aim','pointerup',5);
 await expect.poll(async()=>{await stand();return recruit.isVisible();},{timeout:15000}).toBe(true);
 // Someone to talk to: Yes and No too (the port's Positive and Negative talk); Yes has him answer in kind.
 const yes=page.getByRole('button',{name:'Yes',exact:true});await expect(yes).toBeVisible();await expect(page.getByRole('button',{name:'No',exact:true})).toBeVisible();
 await press('.touch-controls button[data-code=KeyY]:not([hidden])','pointerdown',9);await press('.touch-controls button[data-code=KeyY]:not([hidden])','pointerup',9);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.pedestrians().people.some((p:any)=>p.chat?.reply==='greet')),{timeout:5000}).toBe(true);
 await press('.touch-context button[data-code=KeyG]:not([hidden])','pointerdown',6);await press('.touch-context button[data-code=KeyG]:not([hidden])','pointerup',6);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.pedestrians().snapshot().people.filter((p:any)=>p.follow).length),{timeout:10000}).toBe(1);
 // Aim let go: with a crew to command, Follow and Stay; Stay holds him where he is.
 await press('.touch-button.aim','pointerdown',7);await press('.touch-button.aim','pointerup',7);
 await expect(follow).toBeVisible({timeout:10000});await expect(stay).toBeVisible();await expect(recruit).toBeHidden();
 await press('.touch-context button[data-code=KeyH]:not([hidden])','pointerdown',8);await press('.touch-context button[data-code=KeyH]:not([hidden])','pointerup',8);
 // The crew holds its place (CPedGroupMembership's hold position: the dev hook reads the member's own).
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.pedestrians().people.find((p:any)=>p.follow)?.holdPosition),{timeout:10000}).toBe(true);
 expect(errors).toEqual([]);
});
