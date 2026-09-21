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
 // INITIAL gives up at a command the runtime does not handle; MAIN keeps running.
 await expect.poll(async()=>await page.evaluate(()=>((window as any).__game.scm()?.gaveUp?.length??0)>0),{timeout:30000}).toBe(true);
 const scm=await page.evaluate(()=>(window as any).__game.scm());
 console.log('SCM '+JSON.stringify(scm));
 // The clock the script set, the relationships it declared and the wanted ceiling it chose.
 expect(scm.clock).toEqual({hours:8,minutes:0});
 expect(scm.relationships).toBe(22);
 // MAIN passes two ceilings: six, and then the four Los Santos starts under.
 expect(scm.maximumWantedLevel).toBe(4);
 expect(scm.totalMissions).toBe(147);
 expect(scm.progressTotal).toBe(187);
 // Its zone population reached the world's real zones.
 expect(scm.zones).toBeGreaterThan(100);
 // The opening now carries through the pickups, the restart points, the stunt jumps and the car generators.
 expect(scm.restartPoints).toEqual({hospitals:8,police:7});
 expect(scm.stuntJumps).toBe(70);
 expect(scm.carGenerators).toBe(208);
 expect(scm.objects).toBeGreaterThan(0);
 // Each thread gives up on its own command rather than one of them stopping the whole script. MAIN now runs
 // far enough to start the whole external thread set, and each of those stops at the first thing it needs from
 // a world the browser does not yet answer for: the peds and vehicles a started game would already hold.
 expect(scm.gaveUp.map((entry:{thread:string;command:string})=>[entry.thread,entry.command])).toEqual([
  ['INTMAN','GET_CHAR_AREA_VISIBLE'],
  ['HJ','IS_CHAR_IN_ANY_TRAIN'],
  ['MAIN','GIVE_PLAYER_CLOTHES_OUTSIDE_SHOP'],
  ['CRANES','LOCATE_CHAR_ANY_MEANS_OBJECT_2D'],
  ['GYM','CAN_PLAYER_START_MISSION'],
 ]);
 // Nineteen more threads are still running their own waits, the four that watch where the player is and
 // whether they are alive among them.
 expect(scm.threads.length).toBe(19);
 expect(scm.threads.map((thread:{name:string})=>thread.name)).toContain('APCHECK');
 expect(scm.stopped).toBeNull();
 expect(scm.entryExitFlags).toBe(41);
 // The zone population block ran: the script set the population of its own zones.
 expect(scm.zonesTouched).toBe(292);
 // The script's own player creation point is recorded; the browser had already placed the player.
 expect(scm.playerStart).toMatchObject({x:2488.562255859375});
 expect(errors).toEqual([]);
});
