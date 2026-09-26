import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const interiorsPublished=(JSON.parse(readFileSync('public/play/world/manifest.json','utf8')).archives??[]).some((a:{name:string})=>a.name==='gta_int.img');
/** CJ's bedroom disc (slot 0): area 3, above Grove Street and 20 units from the start. */
const seed=(page:Page)=>page.addInitScript(()=>{localStorage.setItem('web-gta.progress.v1',JSON.stringify({version:1,money:500,savedLocation:{x:2495.9,y:-1707.4,z:1013.3,heading:Math.PI,timeMinutes:600,area:3,enexStack:[]}}));});
const player=(page:Page)=>page.evaluate(()=>{const s=(window as any).__game.state();return {p:s.player.position,grounded:s.player.grounded,minutes:s.timeMinutes};});
const start=async(page:Page)=>{await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});};

test('a save made inside an interior loads back inside it',async({page})=>{
 test.skip(!interiorsPublished,'Requires gta_int.img published with the world.');test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await seed(page);await start(page);
 await expect.poll(async()=>{const s=await player(page);return s.grounded&&s.p.y>1000;},{timeout:120000}).toBe(true);
 // It stays there: the floor it stands on is the interior's.
 await page.waitForTimeout(5000);const s=await player(page);
 expect(Math.hypot(s.p.x-2495.9,s.p.z-1707.4)).toBeLessThan(3);expect(s.p.y).toBeGreaterThan(1010);expect(s.grounded).toBe(true);
 expect(errors).toEqual([]);
});

test('a save made inside an interior that cannot stream keeps its clock and leaves the player at the start',async({page})=>{
 test.skip(interiorsPublished,'Interiors are published.');test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await seed(page);await start(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(async()=>(await player(page)).minutes,{timeout:60000}).toBeGreaterThanOrEqual(600);
 // Not set down in the air where the house would be.
 await page.waitForTimeout(5000);const s=await player(page);
 expect(s.p.y).toBeLessThan(100);expect(s.grounded).toBe(true);expect(s.minutes).toBeLessThan(720);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('web-gta.progress.v1')!).savedLocation.area)).toBe(3);
 expect(errors).toEqual([]);
});
