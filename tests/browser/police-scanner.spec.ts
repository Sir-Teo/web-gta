import {test,expect} from '@playwright/test';
/** The police scanner: a crime that raises CJ's wanted level is reported. At Grove Street, on foot, the first list is an
 * opening, the crime's ten-code, "central" and Ganton (banks 150, 151, 149 and 147 of the SCRIPT pack, fetched as
 * they are asked for), then "suspect last seen" ... "on foot"; it is heard, and runs to its end. A saved game starts
 * him there, past the opening's ride, whose widescreen bars would hold any report back. */
test('a crime that raises the wanted level is reported over the police scanner',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const fetched:string[]=[];page.on('request',r=>{const u=r.url();if(u.includes('/play/audio/script/'))fetched.push(u.split('/play/audio/script/')[1]);});
 await page.addInitScript(()=>{localStorage.setItem('web-gta.progress.v1',JSON.stringify({version:1,money:0,savedLocation:{x:2495,y:-1680,z:13.3,heading:1,timeMinutes:720}}));});
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.state().fadeAlpha),{timeout:90000}).toBe(0);
 // The saved game has loaded and MAIN runs (a crime before then is cleared with the rest).
 await page.waitForFunction(()=>((window as any).__game.missionForProfiling()?.runtime.active.length??0)>2,undefined,{timeout:60000});
 const native=()=>page.evaluate(()=>(window as any).__game.state().audio.native);
 await expect.poll(async()=>(await native())?.banks?.slots?.length??0,{timeout:30000}).toBeGreaterThan(0);
 // CRIME_DESTROY_VEHICLE's 70 chaos is a star; unseen by the police, it is queued and reported 500 ms on.
 await page.evaluate(()=>(window as any).__game.crime(20));
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.state().wanted.level),{timeout:15000}).toBe(1);
 await expect.poll(async()=>(await native()).scanner.state,{timeout:5000}).toBeGreaterThan(0);
 const scanner=(await native()).scanner;
 expect(scanner.first.map(([bank]:number[])=>bank)).toEqual([150,151,-1,149,147]);
 expect(scanner.first.slice(3)).toEqual([[149,0],[147,51]]);
 expect(scanner.second).toEqual([[150,7],[-1,-1],[-1,-1],[-1,-1],[150,4]]);
 await expect.poll(async()=>(await native()).scanner.state,{timeout:20000}).toBe(7);
 expect(new Set(fetched)).toEqual(new Set(['script.json','bank-150.bin','bank-151.bin','bank-149.bin','bank-147.bin']));
 await expect.poll(async()=>(await page.evaluate(()=>(window as any).__game.state().audio)).rms,{timeout:5000}).toBeGreaterThan(.0005);
 await expect.poll(async()=>(await native()).scanner.reportsPlayed,{timeout:30000}).toBe(1);
 expect((await native()).scanner.state).toBe(0);
 expect(errors).toEqual([]);
});
