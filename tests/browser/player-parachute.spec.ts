import {test,expect} from '@playwright/test';
/* player_parachute.scm, which MAIN starts while CJ carries the parachute: past 10 units a second down with 20 units
 * under him the free fall starts (FALL_SKYDIVE, the fall capped at 30 a second), the stick pitches and banks him
 * (SET_CHAR_ROTATION), the open press puts the canopy object over him and eases the fall to 5 a second, and on the
 * ground the script lands him, takes the canopy and the parachute away and ends. */
test('the parachute script flies the free fall and the canopy and lands CJ',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 // A saved game, so INTRO's opening (which holds CJ and the camera) is ended as it starts.
 await page.addInitScript(()=>{localStorage.setItem('web-gta.progress.v1',JSON.stringify({version:1,money:0,savedLocation:{x:2510,y:-1680,z:13.2,heading:1,timeMinutes:720}}));});
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await page.waitForFunction(()=>((window as any).__game.missionForProfiling()?.runtime.active.length??0)>2,undefined,{timeout:60000});
 const threads=()=>page.evaluate(()=>(window as any).__game.missionForProfiling().snapshot().threads.map((t:any)=>String(t.name).toLowerCase()));
 const global=(n:number,float=false)=>page.evaluate(({n,float})=>{const g=(window as any).__game.missionForProfiling().runtime.globals;return float?g.getFloat32(n*4,true):g.getInt32(n*4,true);},{n,float});
 const playing=(name:string)=>page.evaluate(name=>!!(window as any).__game.missionForProfiling().runtime.world.pedIsPlayingAnim(1,name),name);
 await page.evaluate(()=>{(window as any).__game.weapons().inventory.give(46,1);});
 await expect.poll(threads,{timeout:60000}).toContain('plchute');
 // The script makes the canopy (PARACHUTE, model 3131) at once, hidden and hung from CJ; it is drawn once built.
 const canopy=()=>page.evaluate(()=>{const g=(window as any).__game,o=[...g.missionForProfiling().runtime.game.objects.objects.values()].find((o:any)=>o.model==='PARACHUTE');return o?{handle:o.handle,attached:o.attachedTo?.handle??null,built:!!g.scriptObjectViews()?.groupFor(o.handle)}:null;});
 await expect.poll(canopy,{timeout:90000}).toEqual({handle:expect.any(Number),attached:1,built:true});
 // Up 150 units over where he stands: he drops into the free fall, and is turned to the canopy object and flags.
 const start=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),p=m.runtime.world.pedPosition(1);m.runtime.world.setPedCoordinates(1,p.x,p.y,p.z+150);return p;});
 await expect.poll(()=>global(1513),{timeout:30000}).toBe(1);
 await expect.poll(()=>playing('FALL_SKYDIVE'),{timeout:10000}).toBe(true);
 // Holding forward pitches him: the stick's 128 over 4.267 is the 30 degrees 3@ eases to.
 await page.keyboard.down('KeyW');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().player.tilt?.x??0),{timeout:10000}).toBeLessThan(-.1);
 await page.keyboard.up('KeyW');
 const falling=await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.pedVelocity(1).z*50);
 // The script holds it at 30 a frame; the reading is a step or two of gravity past that.
 expect(falling).toBeLessThan(-10);expect(falling).toBeGreaterThan(-33);
 // $1512 opens it as the button would (the same IF ORs them).
 await page.evaluate(()=>{(window as any).__game.missionForProfiling().runtime.globals.setInt32(1512*4,1,true);});
 await expect.poll(()=>global(1513),{timeout:10000}).toBe(3);
 await page.evaluate(()=>{(window as any).__game.missionForProfiling().runtime.globals.setInt32(1512*4,0,true);});
 // The canopy eases the fall the script sets to 5 units a second ($1501); the reading adds the frame's gravity.
 await expect.poll(()=>global(1509,true),{timeout:20000}).toBeGreaterThan(-5.5);
 expect(await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.pedVelocity(1).z*50)).toBeGreaterThan(-10);
 // The canopy hangs over him, drawn where he is.
 const drawn=await page.evaluate(()=>{const g=(window as any).__game,o=[...g.missionForProfiling().runtime.game.objects.objects.values()].find((o:any)=>o.model==='PARACHUTE'),group=g.scriptObjectViews().groupFor(o.handle),p=g.state().player.position;return {visible:group.visible,distance:Math.hypot(group.position.x-p.x,group.position.z-p.z)};});
 expect(drawn.visible).toBe(true);expect(drawn.distance).toBeLessThan(1);
 await page.screenshot({path:'artifacts/player-parachute-canopy.png'});
 // Landed: the canopy and the parachute go and the script ends; CJ stands, unhurt by the landing.
 await expect.poll(threads,{timeout:120000}).not.toContain('plchute');
 const end=await page.evaluate(()=>{const g=(window as any).__game,s=g.state();return {weapon:g.weapons().inventory.owned.has(46),health:s.player.health,grounded:s.player.grounded,tilt:s.player.tilt??null};});
 expect(end).toEqual({weapon:false,health:expect.any(Number),grounded:true,tilt:null});
 expect(end.health).toBeGreaterThan(0);
 expect(start).toBeTruthy();
 expect(errors).toEqual([]);
});
