import {test,expect} from '@playwright/test';
/** CCamera's fixed mode: the script puts the camera at a source looking at a point, and gives it back with a
 * restore. The browser's own camera runs until it is asked for and again as soon as it is handed back. */
test('the camera goes where the script puts it and comes back when it is restored',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);

 const out=await page.evaluate(async()=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),p=game.state().player.position;
  const camera=mission.runtime.game.camera,adapter=(mission as any).runtime.world;
  const before={...game.render().camera.position};
  // Twenty east of the player and ten up, looking at the player.
  const source={x:p.x+20,y:-p.z,z:p.y+10},target={x:p.x,y:-p.z,z:p.y};
  camera.setCamPositionForFixedMode(source,{x:0,y:0,z:0});
  camera.takeControlNoEntity(target,1,2);
  await new Promise(r=>setTimeout(r,500));
  const fixed={...game.render().camera.position};
  // What the script reads back of its own camera, in its own coordinates.
  const read=adapter.activeCameraSource();
  camera.restoreWithJumpCut(adapter.playerCameraState());
  await new Promise(r=>setTimeout(r,500));
  const restored={...game.render().camera.position};
  return {before,fixed,restored,read,
   expected:{x:source.x,y:source.z,z:-source.y},movedBack:Math.hypot(restored.x-fixed.x,restored.y-fixed.y,restored.z-fixed.z)};
 });
 // The camera stands where the script put it, in the renderer's axes.
 expect(Math.hypot(out.fixed.x-out.expected.x,out.fixed.y-out.expected.y,out.fixed.z-out.expected.z)).toBeLessThan(.001);
 // And the script reads back the same point in its own.
 expect(Math.hypot(out.read.x-(out.expected.x),out.read.y+out.expected.z,out.read.z-out.expected.y)).toBeLessThan(.001);
 // A restore hands the camera back, and the browser's own moves it away again.
 expect(out.movedBack).toBeGreaterThan(1);
 // SET_CAMERA_BEHIND_PLAYER swings the string camera straight behind the ped, and its counterpart in front.
 const swung=await page.evaluate(async()=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),adapter=(mission as any).runtime.world;
  const render=game.render(),player=()=>game.state().player;
  const behindOf=(h:number)=>{const d=render.yaw-(h+Math.PI);return Math.abs(Math.atan2(Math.sin(d),Math.cos(d)));};
  const frontOf=(h:number)=>{const d=render.yaw-h;return Math.abs(Math.atan2(Math.sin(d),Math.cos(d)));};
  // Look somewhere else first so the swing has something to undo.
  render.yaw=player().heading+1.5;
  adapter.setCameraBehindPlayer();
  await new Promise(r=>setTimeout(r,300));
  const behind=behindOf(player().heading);
  render.yaw=player().heading+1.5;
  adapter.setCameraInFrontOfPlayer();
  await new Promise(r=>setTimeout(r,300));
  const front=frontOf(player().heading);
  return {behind,front};
 });
 // The camera sits along its own direction from the ped, so behind him is his facing turned half round.
 expect(swung.behind).toBeLessThan(.2);
 expect(swung.front).toBeLessThan(.2);

 expect(errors).toEqual([]);
});
