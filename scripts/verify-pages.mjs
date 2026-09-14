import {chromium,expect} from '@playwright/test';
import {preview} from 'vite';
import {mkdir} from 'node:fs/promises';
const remote=process.argv[2];
const region=process.env.GTA_PLAY_AREA;
const server=remote?undefined:await preview({base:'/web-gta/',preview:{host:'127.0.0.1',port:5190,strictPort:true}});
const url=remote??`http://127.0.0.1:5190/web-gta/${region?'?area='+encodeURIComponent(region):''}`;
const area=new URL(url).searchParams.get('area');
const grove=area==='grove-street';
const label=grove?'Grove Street':area==='verdant-meadows'?'Verdant Meadows':'San Andreas';
const browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],failures=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
 await page.goto(url,{waitUntil:'domcontentloaded'});
 const play=page.getByRole('button',{name:`Explore ${label}`,exact:true});await expect(play).toBeEnabled({timeout:120000});
 await expect(page.locator('#save, #continue, #import, #export, .radar-wrap')).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Play the driving sandbox'})).toHaveCount(0);
 await play.click();await expect(page.locator('.menu-backdrop')).not.toBeVisible();
 const before=await page.screenshot();await page.keyboard.down('KeyW');await page.waitForTimeout(1500);await page.keyboard.up('KeyW');
 const after=await page.screenshot();expect(before.equals(after)).toBe(false);
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/pages-${remote?'live':'production'}${grove?'-grove':''}.png`});
 await page.keyboard.press('Escape');const resume=page.getByRole('button',{name:'Resume game',exact:true});await expect(resume).toBeVisible();
 await resume.click();await expect(page.locator('.menu-backdrop')).not.toBeVisible();
 expect(errors).toEqual([]);expect(failures).toEqual([]);expect(await page.evaluate(()=>typeof window.__game)).toBe('undefined');
 console.log(JSON.stringify({url,loaded:true,walkingFramesChanged:true,pauseResume:true,errors,failedRequests:failures}));
}finally{await browser.close();await server?.close();}
