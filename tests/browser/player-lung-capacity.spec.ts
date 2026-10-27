import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('native lung stats reach swimming, recovery, reset and the visible breath bar',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const rows:any[]=[];
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const initial=await page.evaluate(()=>{const g=(window as any).__game,stats=g.missionForProfiling().runtime.game.stats;return {lung:stats.get(225),stamina:stats.get(22),capacity:g.sim.playerLungCapacity(),position:{...g.sim.player.position}};});
 expect(initial).toMatchObject({lung:0,stamina:100,capacity:1150});rows.push({mode:'initial',...initial});
 const bar=page.getByRole('progressbar',{name:'Breath',exact:true});
 const read=()=>page.evaluate(()=>{const g=(window as any).__game,e=document.querySelector('.breath-bar') as HTMLElement;return {breath:g.sim.player.breath,capacity:g.sim.playerLungCapacity(),health:g.sim.player.health,swimming:g.sim.player.swimming,state:g.sim.player.swimState,minute:g.sim.timeMinutes,max:e.getAttribute('aria-valuemax'),fill:parseFloat((e.querySelector('i') as HTMLElement).style.width),hidden:e.hidden};});
 try{
  await page.evaluate(()=>{const g=(window as any).__game;g.sim.player.breath=575;g.sim.player.requireHandleBreath=false;});
  await expect(bar).toBeVisible();await expect(bar).toHaveAttribute('aria-valuemax','1150');const half=await read();rows.push({mode:'initial half',...half});expect(half.fill).toBeGreaterThanOrEqual(50);expect(half.fill).toBeLessThan(60);
  await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinatesNoOffset(1,2600,-2600,-4));
  await page.waitForFunction(()=>{const g=(window as any).__game;return !g.state().terrainHold&&g.sim.player.swimming&&g.sim.player.swimState===4;},undefined,{timeout:60000});
  const start=await page.evaluate(()=>{const g=(window as any).__game;g.sim.resetPlayerBreath();return {minute:g.sim.timeMinutes,health:g.sim.player.health};});
  await page.waitForFunction(minute=>{const g=(window as any).__game;return (g.sim.timeMinutes-minute+1440)%1440>=4;},start.minute,{timeout:60000});
  const under=await read();rows.push({mode:'underwater after four simulated seconds',...under});expect(under.swimming).toBe(true);expect(under.state).toBe(4);expect(under.breath).toBeGreaterThan(600);expect(under.breath).toBeLessThan(1000);expect(under.health).toBe(start.health);
  const change=await page.evaluate(()=>{const g=(window as any).__game,stats=g.missionForProfiling().runtime.game.stats,before=g.sim.player.breath;stats.set(225,1000);stats.set(22,1000);return {before,after:g.sim.player.breath,capacity:g.sim.playerLungCapacity()};});
  rows.push({mode:'stat change',...change});expect(change.capacity).toBe(4000);expect(change.after).toBe(change.before);
  await page.evaluate(p=>{const g=(window as any).__game;g.missionForProfiling().runtime.world.setPedCoordinatesNoOffset(1,p.x,-p.z,p.y);g.sim.player.breath=2000;g.sim.player.requireHandleBreath=false;},initial.position);
  await page.waitForFunction(()=>{const g=(window as any).__game;return !g.state().terrainHold&&!g.sim.player.swimming;},undefined,{timeout:60000});
  await expect(bar).toBeVisible();await expect(bar).toHaveAttribute('aria-valuemax','4000');const recovered=await read();rows.push({mode:'dry recovery and scaled HUD',...recovered});expect(recovered.breath).toBeGreaterThan(2000);expect(recovered.fill).toBeGreaterThanOrEqual(50);expect(recovered.fill).toBeLessThan(70);
  const reset=await page.evaluate(()=>{const g=(window as any).__game;g.sim.resetPlayerBreath();return {breath:g.sim.player.breath,handled:g.sim.player.requireHandleBreath};});rows.push({mode:'reset',...reset});expect(reset).toEqual({breath:4000,handled:false});await expect(bar).toBeHidden();
  await page.screenshot({path:'artifacts/player-lung-capacity.png'});
 }finally{writeFileSync('artifacts/player-lung-capacity.json',JSON.stringify({rows,errors},null,2));await page.evaluate(v=>{const s=(window as any).__game.missionForProfiling().runtime.game.stats;s.set(225,v.lung);s.set(22,v.stamina);},initial);}
 expect(errors).toEqual([]);
});
