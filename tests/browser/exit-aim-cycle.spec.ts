import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** One session's worth of the interactions that used to leave the player wrong: get into the Greenwood, drive, stop
 * and get out; aim-walk the pistol and the rifle, shooting; bail out at speed (CTaskSimpleCarJumpOut, then the
 * roll-out and get-up); aim again at once; then spam the enter button through an entry. After each the on-foot
 * state is what a fresh spawn has: no entry phase, collider on, camera free, no vehicle clip, at rest, idle, not
 * aiming. Game-time waits: the headless frame rate makes wall time meaningless. */
test('car exits, aim-walking and entry spam leave the player state clean',async({page})=>{
 test.setTimeout(420000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 const clock=()=>page.evaluate(()=>(window as any).__game.gameTimeMs()/1000);
 const gameWait=async(s:number)=>{const t0=await clock();await expect.poll(clock,{timeout:60000}).toBeGreaterThan(t0+s);};
 const probe=()=>page.evaluate(()=>{const g=(window as any).__game,s=g.state(),sim=g.sim,nc=s.nativeCharacter,p=s.player.position;
  return {phase:s.carEntry.phase,occupied:!!s.nativeCar?.occupied,grounded:s.player.grounded,speed:s.player.speed,blend:s.player.moveBlend,knockdown:s.knockdown,collider:sim.playerCollider.isEnabled(),camExcluded:!!sim.cameraExcludedBody,
   action:nc?.action,vehicleClip:nc?.vehicleClip??null,reaction:nc?.reaction??null,lowered:nc?.gun?.lowered??null,aiming:g.weapons().aiming,health:s.player.health,x:p.x,z:p.z,heading:s.player.heading,yaw:g.render().yaw,carSpeed:s.nativeCar?Math.hypot(s.nativeCar.velocity.x,s.nativeCar.velocity.z):0};});
 const clean=async(tag:string)=>{await gameWait(1.2);const p=await probe();
  expect({tag,phase:p.phase,occupied:p.occupied,grounded:p.grounded,collider:p.collider,camExcluded:p.camExcluded,vehicleClip:p.vehicleClip,reaction:p.reaction,action:p.action,aiming:p.aiming,knockdown:p.knockdown,blend:p.blend,alive:p.health>0})
   .toEqual({tag,phase:null,occupied:false,grounded:true,collider:true,camExcluded:false,vehicleClip:null,reaction:null,action:'idle',aiming:false,knockdown:0,blend:0,alive:true});
  expect(p.speed,tag).toBeLessThan(.3);return p;};
 const dist=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.locator('canvas.world').click({position:{x:400,y:300}});await gameWait(.5);
 for(const weapon of [22,30]){await page.keyboard.press('Backquote');await page.locator(`[data-weapon="${weapon}"]`).click();await expect.poll(async()=>(await state()).weapons.ready,{timeout:30000}).toBe(true);}
 const enter=async()=>{
  await page.evaluate(()=>(window as any).__game.placeCar(2491,13.3,1680,0));await gameWait(.5);
  await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2491,g.groundAt(2491,1684,300)+.05,1684);g.turnPlayer(0);});
  await expect.poll(async()=>{const s=await state();return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);await gameWait(.5);
  await page.keyboard.press('KeyF');
  await expect.poll(async()=>(await state()).carEntry.phase,{timeout:20000}).toBe('seated');await gameWait(.3);
  expect((await probe()).collider).toBe(false);
 };
 // CTaskSimpleUseGun's GunMove clips carry CJ facing the aim: forward, strafing (firing on the move where the weapon
 // allows) and back; the released aim leaves him idle with the gun down.
 const aimWalk=async(weapon:number,tag:string)=>{
  await page.keyboard.press('Backquote');await page.locator(`[data-weapon="${weapon}"]`).click();await expect.poll(async()=>(await state()).weapons.ready,{timeout:30000}).toBe(true);
  await page.mouse.move(720,450);await page.mouse.down({button:'right'});await gameWait(.4);
  const aimed=await probe();expect(aimed.action,tag).toBe('gunMove');
  await page.keyboard.down('KeyW');await gameWait(1);const fwd=await probe();await page.keyboard.up('KeyW');
  expect(fwd.action,tag).toBe('gunMove');expect(dist(fwd,aimed),tag).toBeGreaterThan(.8);
  await page.keyboard.down('KeyA');await gameWait(.6);const left=await probe();
  await page.mouse.down({button:'left'});await gameWait(.6);const fire=await probe();await page.mouse.up({button:'left'});await page.keyboard.up('KeyA');
  expect(left.action,tag).toBe('gunMove');expect(dist(left,fwd),tag).toBeGreaterThan(.5);expect(fire.reaction,tag).toMatch(/fire/);
  await page.keyboard.down('KeyS');await gameWait(.8);const back=await probe();await page.keyboard.up('KeyS');
  expect(back.action,tag).toBe('gunMove');expect(dist(back,left),tag).toBeGreaterThan(.5);
  // The camera turned while aiming: CJ faces it.
  await page.mouse.move(1100,450,{steps:8});await gameWait(.5);const turned=await probe();
  expect(Math.abs(Math.atan2(Math.sin(turned.heading-(turned.yaw+Math.PI)),Math.cos(turned.heading-(turned.yaw+Math.PI)))),tag).toBeLessThan(.35);
  await page.mouse.up({button:'right'});await clean(tag+' released');
 };
 // A. Drive, stop, get out with F: at rest and clean, and the next push walks at once.
 await enter();
 await page.keyboard.down('KeyW');await gameWait(1.5);await page.keyboard.up('KeyW');await page.keyboard.down('Space');await gameWait(1.5);await page.keyboard.up('Space');
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).carEntry.phase??null,{timeout:20000}).toBeNull();
 const out=await clean('A exited');
 // East, along the open street: north is the houses' porches.
 await page.evaluate(()=>(window as any).__game.turnPlayer(Math.PI/2));
 await page.keyboard.down('KeyW');await gameWait(1.5);const walk=await probe();await page.keyboard.up('KeyW');
 expect(dist(walk,out)).toBeGreaterThan(1);expect(['walk','run','sprint','walkStart']).toContain(walk.action);
 await clean('A stopped');
 // B. Aim-walk, pistol then rifle.
 await aimWalk(22,'B pistol');
 await aimWalk(30,'B rifle');
 // C. Bail out at speed: CanPedJumpOutCar needs 0.316 units a frame, more than the cul-de-sac's run-up gives, so the
 //    seated car is given 17 m/s.
 await enter();
 await page.keyboard.down('KeyW');await gameWait(.4);
 await page.evaluate(()=>{const b=(window as any).__game.fleet().occupied.car.body;b.setLinvel({x:0,y:0,z:-17},true);});await gameWait(.25);
 expect((await probe()).carSpeed).toBeGreaterThan(8);
 await page.keyboard.press('KeyF');
 const phases=new Set<string>();
 await expect.poll(async()=>{const s=await state();if(s.carEntry.phase)phases.add(s.carEntry.phase);return s.nativeCar?.occupied;},{timeout:20000}).toBe(false);
 await page.keyboard.up('KeyW');
 expect([...phases]).toContain('jumpOut');
 await expect.poll(async()=>(await state()).carEntry.phase??null,{timeout:20000}).toBeNull();
 await expect.poll(async()=>{const s=await state();return s.knockdown===0&&s.player.grounded;},{timeout:20000}).toBe(true);
 await clean('C bailed');
 await page.evaluate(()=>(window as any).__game.turnPlayer(Math.PI/2));
 await aimWalk(22,'C pistol after the bail-out');
 // D. Enter with the button pressed three times in a row: the second press quits the approach, the third restarts it.
 await page.evaluate(()=>(window as any).__game.placeCar(2491,13.3,1680,0));await gameWait(.5);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2491,g.groundAt(2491,1684,300)+.05,1684);g.turnPlayer(0);});
 await expect.poll(async()=>{const s=await state();return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);await gameWait(.5);
 await page.keyboard.press('KeyF');await gameWait(.3);await page.keyboard.press('KeyF');await gameWait(.3);
 expect((await state()).carEntry.phase??null).toBeNull();
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).carEntry.phase,{timeout:30000}).toBe('seated');await gameWait(.5);
 await page.keyboard.press('KeyF');await expect.poll(async()=>(await state()).carEntry.phase??null,{timeout:30000}).toBeNull();
 await clean('D after the spam');
 expect(errors).toEqual([]);
});
