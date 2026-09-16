import {chromium,expect} from '@playwright/test';
import {preview} from 'vite';
import {mkdir} from 'node:fs/promises';
const remote=process.argv[2];
const region=process.env.GTA_PLAY_AREA;
const server=remote?undefined:await preview({base:'/web-gta/',preview:{host:'127.0.0.1',port:5190,strictPort:true}});
const url=remote??`http://127.0.0.1:5190/web-gta/${region?'?area='+encodeURIComponent(region):''}`;
const area=new URL(url).searchParams.get('area');
const grove=area==='grove-street';
const label='San Andreas';
const browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],failures=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
 await page.goto(url,{waitUntil:'domcontentloaded'});
 const play=page.getByRole('button',{name:`Explore ${label}`,exact:true});await expect(play).toBeEnabled({timeout:120000});
 await expect(page.locator('#save, #continue, #import, #export, .radar-wrap')).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Play the driving sandbox'})).toHaveCount(0);
 await expect(page.locator('.scene-choices')).toHaveCount(0);
 await play.click();await expect(page.locator('.menu-backdrop')).not.toBeVisible();
 await page.keyboard.press('KeyM');await expect(page.locator('.world-map-panel')).toBeVisible();await expect(page.locator('.map-status')).toContainText('North is up');await page.locator('.world-map-panel canvas').click({position:{x:100,y:100}});await expect(page.locator('.map-status')).toContainText('Waypoint');await page.keyboard.press('KeyM');
 const before=await page.screenshot();await page.keyboard.down('KeyW');await page.waitForTimeout(1500);await page.keyboard.up('KeyW');
 const after=await page.screenshot();expect(before.equals(after)).toBe(false);
 await page.keyboard.down('KeyA');await page.waitForTimeout(700);await page.keyboard.up('KeyA');await page.keyboard.press('KeyF');await expect(page.locator('.prompt')).toContainText('Greenwood · W/S drive');await page.keyboard.down('KeyW');await page.waitForTimeout(2000);await page.keyboard.up('KeyW');
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/pages-${remote?'live':'production'}${grove?'-grove':''}.png`});
 await page.keyboard.press('Escape');const resume=page.getByRole('button',{name:'Resume game',exact:true});await expect(resume).toBeVisible();
 await resume.click();await expect(page.locator('.menu-backdrop')).not.toBeVisible();
 await page.keyboard.down('Space');await page.waitForTimeout(2500);await page.keyboard.up('Space');await page.keyboard.press('KeyF');
 // The choreographed exit no longer emits the old transient 'On foot' prompt.
 await page.mouse.move(750,420);await page.mouse.down({button:'right'});await expect(page.locator('.weapon-crosshair')).toBeVisible({timeout:10000});await page.mouse.up({button:'right'});
 await page.keyboard.press('KeyM');await page.getByLabel('Aircraft',{exact:true}).selectOption('476');await page.getByRole('button',{name:'Fly from Verdant Meadows',exact:true}).click();
 await expect(page.locator('.flight-instruments')).toBeVisible({timeout:120000});
 await page.keyboard.down('KeyW');await page.waitForTimeout(6500);await page.keyboard.up('KeyW');await page.keyboard.down('ArrowDown');await page.waitForTimeout(1000);await page.keyboard.up('ArrowDown');
 await expect.poll(async()=>Number((await page.locator('.flight-instruments').innerText()).match(/(\d+) m AGL/)?.[1]),{timeout:20000}).toBeGreaterThan(12);
 await page.keyboard.press('KeyG');await expect(page.locator('.flight-instruments')).toContainText('Gear UP');
 await page.screenshot({path:`artifacts/pages-${remote?'live':'production'}-flight.png`});
 expect(errors).toEqual([]);expect(failures).toEqual([]);expect(await page.evaluate(()=>typeof window.__game)).toBe('undefined');
 console.log(JSON.stringify({url,loaded:true,walkingFramesChanged:true,nativeCarEntered:true,nativeMapWaypoint:true,pauseResume:true,aircraftTakeoff:true,landingGear:true,errors,failedRequests:failures}));
}finally{await browser.close();await server?.close();}
