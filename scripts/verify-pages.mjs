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
const executablePath=process.env.PW_CHROMIUM_EXECUTABLE;
const browser=await chromium.launch(executablePath?{executablePath}:{channel:'chrome'});
let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[],failures=[];
 // Exercise the supported saved-game return to free roam. A new game's INTRO owns the controls and fades while
 // the smoke test tries to drive, aim and fly; it is covered by the separate opening/mission browser checks.
 await page.addInitScript(()=>localStorage.setItem('web-gta.progress.v1',JSON.stringify({version:1,money:0,savedLocation:{x:2493,y:-1683,z:13.3,heading:Math.PI,timeMinutes:480}})));
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
 await page.goto(url,{waitUntil:'domcontentloaded'});
 const play=page.getByRole('button',{name:`Explore ${label}`,exact:true});await expect(play).toBeEnabled({timeout:120000});
 await expect(page.locator('#save, #continue, #import, #export, .radar-wrap')).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Play the driving sandbox'})).toHaveCount(0);
 await expect(page.locator('.scene-choices')).toHaveCount(0);
 await page.evaluate(()=>{
  window.__productionOpeningReady=false;
  const hud=document.querySelector('.game-ui'),observer=new MutationObserver(records=>{
   if(records.some(r=>(r.oldValue??'').split(' ').includes('screen-faded'))&&!hud.classList.contains('screen-faded')){window.__productionOpeningReady=true;observer.disconnect();}
  });
  observer.observe(hud,{attributes:true,attributeFilter:['class'],attributeOldValue:true});
 });
 await play.click();await expect(page.locator('.menu-backdrop')).not.toBeVisible();
 await page.waitForFunction(()=>window.__productionOpeningReady,undefined,{timeout:120000});
 await expect(page.locator('.screen-fade')).toHaveCSS('opacity','0',{timeout:30000});
 await page.keyboard.press('KeyM');await expect(page.locator('.world-map-panel')).toBeVisible();await expect(page.locator('.map-status')).toContainText('North is up');await page.locator('.world-map-panel canvas').click({position:{x:100,y:100}});await expect(page.locator('.map-status')).toContainText('Waypoint');await page.keyboard.press('KeyM');
 const before=await page.screenshot();await page.keyboard.down('KeyW');await page.waitForTimeout(800);await page.keyboard.up('KeyW');
 const after=await page.screenshot();expect(before.equals(after)).toBe(false);
 // Stay inside the native ten-unit search around the Greenwood at (2491, -1680); its task walks to the door.
 await page.keyboard.press('KeyF');
 // Entry is the native door-and-seat task, which shows no instruction prompt: CHud names the car once CJ is in it.
 await expect(page.locator('.game-ui')).toHaveClass(/\bin-vehicle\b/,{timeout:30000});
 await expect(page.locator('.vehicle-name')).toContainText('Greenwood');await page.keyboard.down('KeyW');await page.waitForTimeout(2000);await page.keyboard.up('KeyW');
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/pages-${remote?'live':'production'}${grove?'-grove':''}.png`});
 await page.keyboard.press('Escape');const resume=page.getByRole('button',{name:'Resume game',exact:true});await expect(resume).toBeVisible();
 await resume.click();await expect(page.locator('.menu-backdrop')).not.toBeVisible();
 await page.keyboard.down('Space');await page.waitForTimeout(2500);await page.keyboard.up('Space');await page.keyboard.press('KeyF');
 await expect(page.locator('.game-ui')).not.toHaveClass(/\bin-vehicle\b/,{timeout:30000});
 // The choreographed exit no longer emits the old transient 'On foot' prompt.
 // Fists aim without a crosshair, as in the original: equip the pistol from the arsenal first.
 await page.keyboard.press('Backquote');await page.locator('.arsenal [data-weapon="22"]').click();if(await page.locator('.arsenal').isVisible())await page.locator('.arsenal-close').click();await expect(page.locator('.arsenal')).toBeHidden();
 await page.mouse.move(750,420);await page.mouse.down({button:'right'});await expect(page.locator('.weapon-crosshair')).toBeVisible({timeout:10000});await page.mouse.up({button:'right'});
 await page.keyboard.press('KeyM');await page.getByLabel('Aircraft',{exact:true}).selectOption('476');await page.getByRole('button',{name:'Fly from Verdant Meadows',exact:true}).click();
 await expect(page.locator('.flight-instruments')).toBeVisible({timeout:120000});
 // Native aircraft throttle follows the held pedal; releasing W before the climb cuts the engine.
 await page.keyboard.down('KeyW');
 await expect.poll(async()=>Number((await page.locator('.flight-instruments').innerText()).match(/(\d+) km\/h/)?.[1]),{timeout:45000}).toBeGreaterThan(100);
 await page.keyboard.down('ArrowDown');
 await expect.poll(async()=>Number((await page.locator('.flight-instruments').innerText()).match(/(\d+) m AGL/)?.[1]),{timeout:20000}).toBeGreaterThan(15);
 await page.keyboard.up('ArrowDown');
 await page.keyboard.up('KeyW');
 await page.keyboard.press('KeyG');await expect(page.locator('.flight-instruments')).toContainText('Gear UP');
 await page.screenshot({path:`artifacts/pages-${remote?'live':'production'}-flight.png`});
 expect(errors).toEqual([]);expect(failures).toEqual([]);expect(await page.evaluate(()=>typeof window.__game)).toBe('undefined');
 console.log(JSON.stringify({url,loaded:true,saveResume:true,walkingFramesChanged:true,nativeCarEntered:true,nativeMapWaypoint:true,pauseResume:true,aircraftTakeoff:true,landingGear:true,errors,failedRequests:failures}));
}catch(error){
 if(page){await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/pages-${remote?'live':'production'}-failure.png`}).catch(()=>{});console.error(JSON.stringify({flight:await page.locator('.flight-instruments').textContent({timeout:1000}).catch(()=>null)}));}
 throw error;
}finally{await browser.close();await server?.close();}
