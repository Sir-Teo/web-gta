import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
// CCheat::JetpackCheat gives the player CTaskSimpleJetPack: ROCKETMAN, then the forward key flies him off Grove Street.
test('the jetpack cheat flies the player',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 // Flight impulses are game-time inputs. Headless rendering can advance fewer world frames per wall-clock pulse.
 const gameWait=async(ms:number)=>{const start=await page.evaluate(()=>(window as any).__game.gameTimeMs());await expect.poll(()=>page.evaluate(start=>(window as any).__game.gameTimeMs()-start,start),{timeout:30000,intervals:[50]}).toBeGreaterThanOrEqual(ms);};
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 // Take off west along Grove Street; the opening's yard heading otherwise flies into its house/fence.
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2491,g.groundAt(2491,1668,40),1668);g.turnPlayer(-Math.PI/2);});
 await expect.poll(async()=>(await state()).player.grounded,{timeout:10000}).toBe(true);
 expect((await state()).jetPack).toBeNull();
 // The cheat string carries an M, which this port's map overlay also answers; close it again. Its E is the next-weapon
 // key too (typing a cheat presses the keys), so the weapon the pack saves is the one held after the last letter but one.
 await page.keyboard.type('ROCKETMA',{delay:30});await page.waitForTimeout(200);
 const held=(await state()).weapons.id;
 await page.keyboard.type('N',{delay:30});await page.keyboard.press('KeyM');
 await expect.poll(async()=>(await state()).jetPack!==null,{timeout:10000}).toBe(true);
 // RemoveWeaponWhenEnteringVehicle(true): the Uzi with ammo is taken up (Explore holds the whole arsenal).
 await expect.poll(async()=>(await state()).weapons.id).toBe(28);
 // Coasting, the nominal thrust is under gravity, so the pack lowers the player back to the ground.
 await gameWait(1500);
 expect((await state()).player.grounded).toBe(true);
 expect((await state()).jetPack.thrustFwd).toBe(0);
 const start={...(await state()).player.position};
 // Space supplies native GetAccelerate independently of the walk axis; pulse forward while maintaining lift.
 await page.keyboard.down('Space');
 let flying:Awaited<ReturnType<typeof state>>|undefined;
 const trail:{height:number;distance:number;grounded:boolean}[]=[];
 for(let i=0;i<16;i++){
  await page.keyboard.down('KeyW');await gameWait(350);
  // The flame's key time climbs 0.1 a game frame under thrust: give it the frames before the snapshot.
  if(!flying){await expect.poll(async()=>(await state()).jetPack?.fx??0,{timeout:4000}).toBe(1);flying=await state();}
  await page.keyboard.up('KeyW');await gameWait(250);
  const now=await state();
  trail.push({height:now.player.position.y-start.y,distance:Math.hypot(now.player.position.x-start.x,now.player.position.z-start.z),grounded:now.player.grounded});
  if(now.player.position.y-start.y>2.5&&Math.hypot(now.player.position.x-start.x,now.player.position.z-start.z)>20)break;
 }
 // Under power the thrust leans forward (the pad's forward axis is negative) and the flame is full.
 expect(flying!.player.grounded).toBe(false);
 expect(flying!.jetPack.thrustFwd).toBe(1);
 expect(flying!.jetPack.angle).toBeLessThan(-.2);
 expect(flying!.jetPack.fx).toBe(1);
 // The legs hang and swing under him.
 expect(Math.abs(flying!.jetPack.legs[0])).toBeGreaterThan(0);
 // The pack model rides the player's back with a `jetpack` flame on each thruster.
 expect(flying!.jetPack.error).toBeNull();
 expect(flying!.jetPack.worn).toBe(true);
 expect(flying!.jetPack.flames).toBe(2);
 // RenderJetPack swivels both jetballs by the forward lean's pitch.
 expect(flying!.jetPack.balls.length).toBe(2);
 for(const angle of flying!.jetPack.balls)expect(angle).toBeGreaterThan(5);
 expect(flying!.fx.active).toContain('jetpack');
 const flown=await state();
 expect(flown.player.position.y-start.y,JSON.stringify(trail)).toBeGreaterThan(2);
 expect(Math.hypot(flown.player.position.x-start.x,flown.player.position.z-start.z),JSON.stringify(trail)).toBeGreaterThan(20);
 await page.keyboard.up('Space');
 await page.screenshot({path:'artifacts/native-jetpack.png'});
 // Braking halves the lift and brings him down.
 await page.keyboard.down('ShiftLeft');
 await expect.poll(async()=>(await state()).jetPack.thrustFwd,{timeout:5000}).toBe(-1);
 await expect.poll(async()=>(await state()).player.grounded,{timeout:40000}).toBe(true);
 await page.keyboard.up('ShiftLeft');
 // Standing still, the exit-vehicle key drops the pack and the player walks again.
 await gameWait(500);
 await page.keyboard.down('KeyF');await gameWait(600);await page.keyboard.up('KeyF');
 await expect.poll(async()=>(await state()).jetPack,{timeout:10000}).toBeNull();
 // The pack off, the saved weapon comes back.
 await expect.poll(async()=>(await state()).weapons.id).toBe(held);
 // Dropping it takes the model and its flames away, once the last particles have burnt out.
 await expect.poll(async()=>(await state()).fx.active.includes('jetpack'),{timeout:10000}).toBe(false);
 // The dropped pack is left as a pickup, which hands it back when he walks into it.
 const spawned=(await state()).pickups.spawned;
 expect(spawned).toBeGreaterThan(0);
 // It lies two units ahead along his heading (which the camera-relative walk keys need not follow), so step onto it.
 {const s=await state(),p=s.player.position,h=s.player.heading;
  await page.evaluate(([x,y,z])=>(window as any).__game.placePlayer(x,y,z),[p.x+Math.sin(h)*2,p.y+.5,p.z+Math.cos(h)*2]);}
 await expect.poll(async()=>(await state()).jetPack!==null,{timeout:15000}).toBe(true);
 expect(errors).toEqual([]);
});
