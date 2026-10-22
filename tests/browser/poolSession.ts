import {expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** Enter the real Ganton BAR2 portal and step beside the opponent its POOL_SCRIPT brain creates. */
export async function enterPoolOpponent(page:Page){
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.entryExits?.count===376,undefined,{timeout:90000});await endStoryMission(page);
 const door=await page.evaluate(()=>{const e=(window as any).__game.entryExits().pool.filter((e:any)=>e.name==='BAR2'&&e.area===0).sort((a:any,b:any)=>Math.hypot((a.rect[0]+a.rect[2])/2-2495,(a.rect[1]+a.rect[3])/2+1687)-Math.hypot((b.rect[0]+b.rect[2])/2-2495,(b.rect[1]+b.rect[3])/2+1687))[0];return{x:(e.rect[0]+e.rect[2])/2,y:(e.rect[1]+e.rect[3])/2,z:e.entranceZ};});await page.evaluate(p=>(window as any).__game.placePlayer(p.x,p.z-1,-p.y),door);await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.lighting.area===11&&!s.entryExits.loading&&s.player.grounded;},undefined,{timeout:120000});
 await page.waitForFunction(()=>{const t=(window as any).__game.missionForProfiling().runtime.active.find((s:any)=>s.thread.name==='POOL')?.thread;return t?.locals.getInt32(3*4,true)===2;},undefined,{timeout:30000});
 const result=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),t=m.runtime.active.find((s:any)=>s.thread.name==='POOL').thread,opponent=t.locals.getInt32(4,true),p=m.peds.positionOf(opponent);g.sim.money=500;g.placePlayer(p.x+1,p.z,-p.y);return{opponent,table:t.locals.getInt32(0,true)};});await expect(page.locator('.help-box')).toContainText('play pool');return result;
}
