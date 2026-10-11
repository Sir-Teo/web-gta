import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CCamera's fixed mode: the script puts the camera at a source looking at a point, and gives it back with a
 * restore. The browser's own camera runs until it is asked for and again as soon as it is handed back. */
test('the camera goes where the script puts it and comes back when it is restored',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);

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
 // ATTACH_CAMERA_TO_CHAR_LOOK_AT_CHAR (gf_date rides the camera on the car and looks at the girlfriend): the camera
 // stands at the offset in the ped's own space, five behind and two up, and follows him as he is moved.
 const attached=await page.evaluate(async()=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),camera=mission.runtime.game.camera,adapter=(mission as any).runtime.world;
  camera.takeControlAttachToEntity(undefined,{kind:'ped',handle:1},{x:0,y:-5,z:2},{x:0,y:2,z:0},0,1,2);
  await new Promise(r=>setTimeout(r,500));
  const m=adapter.pedMatrix(1),expected={x:m.position.x-m.forward.x*5,y:m.position.y-m.forward.y*5,z:m.position.z+2};
  const at={...game.render().camera.position};
  camera.restoreWithJumpCut(adapter.playerCameraState());
  return {at,expected:{x:expected.x,y:expected.z,z:-expected.y}};
 });
 expect(Math.hypot(attached.at.x-attached.expected.x,attached.at.y-attached.expected.y,attached.at.z-attached.expected.z)).toBeLessThan(.05);
 // The tilt (degrees) rolls the view about its direction (CCam::Process_AttachedCam, iOS): 30 leans the top of the
 // view right, the camera's up taking sin 30° of its right.
 const rolled=await page.evaluate(async()=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),camera=mission.runtime.game.camera,adapter=(mission as any).runtime.world;
  camera.takeControlAttachToEntity(undefined,{kind:'ped',handle:1},{x:0,y:-5,z:2},{x:0,y:2,z:0},30,1,1);
  await new Promise(r=>setTimeout(r,500));
  const cam=game.render().camera,e=cam.matrixWorld.elements,right={x:e[0],y:e[1],z:e[2]},up={x:e[4],y:e[5],z:e[6]};
  camera.restoreWithJumpCut(adapter.playerCameraState());
  // The world's up across the view, as the camera sees it: + to the left for a top leaning right.
  return {upRight:right.y,upUp:up.y};
 });
 expect(rolled.upRight).toBeLessThan(-.3);expect(rolled.upUp).toBeGreaterThan(.6);
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
 // SET_CAMERA_POSITION_UNFIXED (MUSIC1's 0.031, -2.152): the follow camera's vertical and horizontal angles, the
 // camera at the target plus (cos β cos α, sin β cos α, −sin α) native.
 const unfixed=await page.evaluate(async()=>{
  const game=(window as any).__game,adapter=(game.missionForProfiling() as any).runtime.world,render=game.render();
  adapter.setActiveCameraAngles(.031,-2.152);
  await new Promise(r=>setTimeout(r,300));
  const c=render.camera.position,t=render.target,d={x:c.x-t.x,y:-(c.z-t.z),z:c.y-t.y},n=Math.hypot(d.x,d.y,d.z);
  return {x:d.x/n,y:d.y/n,z:d.z/n};
 });
 const alpha=.031,beta=-2.152;
 expect(unfixed.x).toBeCloseTo(Math.cos(beta)*Math.cos(alpha),2);expect(unfixed.y).toBeCloseTo(Math.sin(beta)*Math.cos(alpha),2);
 expect(unfixed.z).toBeCloseTo(-Math.sin(alpha),2);

 expect(errors).toEqual([]);
});
