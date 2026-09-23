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
 // The opening runs its whole thread set. Nothing gives up any more, so the test waits for the last of the
 // threads to be started rather than for a thread to stop.
 await expect.poll(async()=>await page.evaluate(()=>((window as any).__game.scm()?.threads?.length??0)),{timeout:30000}).toBeGreaterThanOrEqual(26);
 // The intro plays two cutscenes and sets its own time of day while it does; waiting for them keeps this test
 // reading one moment of the script rather than whichever moment the machine happened to reach.
 await expect.poll(async()=>await page.evaluate(()=>((window as any).__game.scm()?.cutscenes??0)),{timeout:30000}).toBeGreaterThanOrEqual(2);
 const scm=await page.evaluate(()=>(window as any).__game.scm());
 console.log('SCM '+JSON.stringify(scm));
 // The clock the script set, the relationships it declared and the wanted ceiling it chose.
 // The opening sets eight o'clock, and the intro then sets its own half past six, which is one of the fifty
 // times the script itself sets. CClock is the world's clock too: it has run on from there, a minute a second.
 expect(scm.clock.hours).toBe(6);expect(scm.clock.minutes).toBeGreaterThanOrEqual(30);expect(scm.clock.minutes).toBeLessThan(45);
 const world=await page.evaluate(()=>(window as any).__game.state().timeMinutes);
 expect(Math.floor(world/60)).toBe(6);expect(Math.abs(world%60-scm.clock.minutes)).toBeLessThan(3);
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
 // Every command the script reaches is now handled, so no thread gives up and none stops the script.
 expect(scm.gaveUp).toEqual([]);
 // The intro asked for two cutscenes, a model and an area clear on its way through.
 expect(scm.cutscenes).toBe(2);
 expect(scm.requestedModels).toBeGreaterThan(0);
 // All twenty-six threads the opening starts are running their own waits.
 expect(scm.threads.length).toBe(26);
 for(const name of ['A_CONT','APCHECK','COLLS','CRANES','GFAGNT','GYM','HJ','INTMAN','INTRO','MAIN','TRAINSL'])
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
