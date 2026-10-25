import {chromium,expect} from '@playwright/test';
import {preview} from 'vite';
const remote=process.argv[2],server=remote?undefined:await preview({base:'/web-gta/',preview:{host:'127.0.0.1',port:5190,strictPort:true}});
const url=remote??'http://127.0.0.1:5190/web-gta/';
const executablePath=process.env.PW_CHROMIUM_EXECUTABLE;
const browser=await chromium.launch(executablePath?{executablePath}:{channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Observe actual worker messages; input and terrain requests remain entirely game-owned.
 await page.addInitScript(()=>{
  window.__worldMessages=[];const OriginalWorker=window.Worker;
  window.Worker=class extends OriginalWorker{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if(data.type==='terrain'||data.type==='error')window.__worldMessages.push({type:data.type,message:data.message,followId:data.followId,stats:data.stats,parts:data.parts?.length});});}};
 });
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');await page.waitForTimeout(3200);await page.keyboard.up('KeyW');await page.keyboard.down('KeyA');
 try{await expect.poll(()=>page.evaluate(()=>window.__worldMessages.length),{timeout:120000,intervals:[1000]}).toBeGreaterThan(0);}
 finally{await page.keyboard.up('KeyA');await page.keyboard.up('ShiftLeft');}
 const messages=await page.evaluate(()=>window.__worldMessages);expect(messages.some(m=>m.type==='error')).toBe(false);expect(messages.some(m=>m.type==='terrain'&&m.parts>0)).toBe(true);
 await page.waitForTimeout(1000);await expect(page.locator('.menu-backdrop')).not.toBeVisible();
 await page.screenshot({path:`artifacts/world-${remote?'live':'production'}.png`});
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Resume game',exact:true})).toBeVisible();expect(errors).toEqual([]);
 console.log(JSON.stringify({url,streamedTerrain:true,messages,errors}));
}finally{await browser.close();await server?.close();}
