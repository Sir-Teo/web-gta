import {test} from '@playwright/test';
import {endStoryMission} from './freeRoam';
import {writeFileSync} from 'node:fs';
test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
test('heap',async({page,context})=>{
 test.setTimeout(400000);
 const cdp=await context.newCDPSession(page);
 await cdp.send('HeapProfiler.enable');await cdp.send('HeapProfiler.startSampling',{samplingInterval:32768});
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);await page.waitForTimeout(8000);
 await cdp.send('HeapProfiler.collectGarbage');
 const {profile}=await cdp.send('HeapProfiler.getSamplingProfile');
 writeFileSync('/tmp/claude-0/-home-user-web-gta/a8c3f5d1-3e75-5edb-9c39-2a5a64e2db58/scratchpad/heap.json',JSON.stringify(profile));
 console.log('DBG heap',await page.evaluate(()=>Math.round((performance as any).memory.usedJSHeapSize/1048576)));
});
