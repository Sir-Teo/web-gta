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
 // The opening sets eight o'clock, and the intro then sets its own half past six, which is one of the fifty
 // times the script itself sets; nothing outside the script moves this clock.
 expect(scm.clock).toEqual({hours:6,minutes:30});
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
 // MAIN no longer gives up at all: the only thread that does is the intro, at the cutscene it wants to load.
 // INTRO now plays its cutscenes through; the one thread that gives up is the collectables flow.
 expect(scm.gaveUp.map((entry:{thread:string;command:string})=>[entry.thread,entry.command])).toEqual([
  ['COLLS','FIND_NUMBER_TAGS_TAGGED'],
 ]);
 // The intro asked for two cutscenes, a model and an area clear on its way through.
 expect(scm.cutscenes).toBe(2);
 expect(scm.requestedModels).toBeGreaterThan(0);
 // Twenty-five threads are still running their own waits, MAIN and the game's own flow among them.
 expect(scm.threads.length).toBe(25);
 for(const name of ['A_CONT','APCHECK','CRANES','GFAGNT','GYM','HJ','INTMAN','INTRO','MAIN','TRAINSL'])
  expect(scm.threads.map((thread:{name:string})=>thread.name)).toContain(name);
 // INTRO loaded its own block of mission text.
 expect(scm.missionText).toBe('INTRO1');
 // MAIN dressed the player and asked for their model to be rebuilt, and left them in control of themselves.
 expect(scm.playerModelsBuilt).toBe(1);
 expect(scm.playerControl).toBe(true);
 expect(scm.stopped).toBeNull();
 expect(scm.entryExitFlags).toBe(41);
 // The zone population block ran: the script set the population of its own zones.
 expect(scm.zonesTouched).toBe(292);
 // The script's own player creation point is recorded; the browser had already placed the player.
 expect(scm.playerStart).toMatchObject({x:2488.562255859375});
 expect(errors).toEqual([]);
});
