import {test} from '@playwright/test';
test('radar shot',async({page})=>{
 test.setTimeout(180000);
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 const poll=async(f:()=>Promise<boolean>,ms:number)=>{const t=Date.now();while(Date.now()-t<ms){if(await f())return true;await page.waitForTimeout(200);}return false;};
 await poll(async()=>(await state()).player.grounded,60000);await poll(async()=>(await state()).gangWars!=null,30000);await page.waitForTimeout(2000);
 const s=await state();console.log('overlays',s.gangWars.overlays,'here',JSON.stringify(s.gangWars.here));
 await page.screenshot({path:'scratch/radar/radar.png',clip:{x:0,y:520,width:420,height:380}});
 await page.keyboard.press('KeyM');await page.waitForTimeout(1500);await page.screenshot({path:'scratch/radar/map.png'});
});
