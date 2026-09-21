import {test,expect} from '@playwright/test';
/** CGame::Initialise starts MAIN.SCM. The published game boots the original script, runs its opening in the
 * frame loop and stops at the first command the runtime has not ported, which its snapshot reports. */
test('the published game runs the original script’s opening',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.scm()?.started??false),{timeout:30000}).toBe(true);
 // The opening runs until it meets a command the runtime does not handle.
 await expect.poll(async()=>await page.evaluate(()=>!!(window as any).__game.scm()?.stopped),{timeout:30000}).toBe(true);
 const scm=await page.evaluate(()=>(window as any).__game.scm());
 console.log('SCM '+JSON.stringify(scm));
 // The clock the script set, the relationships it declared and the wanted ceiling it chose.
 expect(scm.clock).toEqual({hours:8,minutes:0});
 expect(scm.relationships).toBe(22);
 expect(scm.maximumWantedLevel).toBe(6);
 expect(scm.totalMissions).toBe(147);
 expect(scm.progressTotal).toBe(187);
 // Its zone population reached the world's real zones.
 expect(scm.zones).toBeGreaterThan(100);
 // MAIN launched INITIAL, which is the thread that stopped.
 expect(scm.threads.some((thread:{name:string})=>thread.name==='MAIN')).toBe(true);
 // The opening now carries through the pickups, the restart points, the stunt jumps and the car generators.
 expect(scm.restartPoints).toEqual({hospitals:8,police:7});
 expect(scm.stuntJumps).toBe(70);
 expect(scm.carGenerators).toBe(10);
 expect(scm.objects).toBeGreaterThan(0);
 // It stops at the timed rotation the reference does not reverse.
 expect(scm.stopped.command).toBe('ROTATE_OBJECT');
 expect(scm.entryExitFlags).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});
