import {test,expect} from '@playwright/test';
/** The player and a car the script made: WARP_CHAR_INTO_CAR seats him, IS_CHAR_IN_CAR and STORE_CAR_CHAR_IS_IN name
 * that car by the script's own handle, SET_CHAR_COORDINATES moves the car with him in it, and
 * WARP_CHAR_FROM_CAR_TO_COORD sets him down on foot. */
test('the script puts the player in its car, moves him, and takes him out',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 const car=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;return m.vehicles.create(400,{x:p.x+6,y:-p.z,z:p.y},0);});
 await page.waitForFunction((car:number)=>!!(window as any).__game.missionForProfiling().vehicles.entity(car),car,{timeout:45000});
 const inside=await page.evaluate((car:number)=>{
  const w=(window as any).__game.missionForProfiling().runtime.world;w.warpPedIntoCar(1,car);
  return {vehicle:w.pedVehicle(1),using:w.pedCarInUse(1),driver:w.vehicleDriver(car)};
 },car);
 expect(inside).toEqual({vehicle:car,using:car,driver:1});
 await expect.poll(()=>page.evaluate((car:number)=>(window as any).__game.missionForProfiling().runtime.world.pedIsSittingInCar(1,car),car),{timeout:10000}).toBe(true);
 // SET_CHAR_COORDINATES with him in it: the car goes to the point.
 const moved=await page.evaluate((car:number)=>{
  const m=(window as any).__game.missionForProfiling(),w=m.runtime.world,c=m.vehicles.positionOf(car),to={x:c.x+10,y:c.y,z:c.z};
  w.setPedCoordinates(1,to.x,to.y,to.z);const after=m.vehicles.positionOf(car);return {dx:after.x-to.x,dy:after.y-to.y};
 },car);
 expect(Math.abs(moved.dx)).toBeLessThan(.01);expect(Math.abs(moved.dy)).toBeLessThan(.01);
 // WARP_CHAR_FROM_CAR_TO_COORD: out and on foot at the point.
 const out=await page.evaluate((car:number)=>{
  const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,c=m.vehicles.positionOf(car);
  w.warpPedFromCarToCoord(1,c.x+4,c.y,c.z);const p=g.state().player.position;
  return {vehicle:w.pedVehicle(1)??null,dx:p.x-(c.x+4),dz:-p.z-c.y};
 },car);
 expect(out.vehicle).toBe(null);expect(Math.abs(out.dx)).toBeLessThan(.01);expect(Math.abs(out.dz)).toBeLessThan(.01);
 // On foot, SET_CHAR_COORDINATES moves him.
 const walked=await page.evaluate(()=>{
  const g=(window as any).__game,w=g.missionForProfiling().runtime.world,p=g.state().player.position,to={x:p.x+3,y:-p.z,z:p.y};
  w.setPedCoordinates(1,to.x,to.y,to.z);const q=g.state().player.position;return Math.hypot(q.x-to.x,-q.z-to.y);
 });
 expect(walked).toBeLessThan(.01);
 // The player's side of the ped commands: heading, weapon hiding, the frozen pad, water and air, the playing clip.
 const player=await page.evaluate(()=>{
  const g=(window as any).__game,w=g.missionForProfiling().runtime.world;
  w.setCharHeading(1,90);const heading=w.pedHeading(1);
  w.hidePedWeaponForScriptedCutscene(1,true);w.hidePedWeaponForScriptedCutscene(1,false);
  w.freezePedPosition(1,true);w.freezePedPosition(1,false);
  w.setPedAreaVisible(1,0);w.shutPedUpForScriptedSpeech(1,true);w.startPedFacialTalk(1,1000);w.stopPedFacialTalk(1);
  return {heading,water:w.pedIsInWater(1),air:w.pedIsInAir(1),anim:w.pedIsPlayingAnim(1,'IDLE_chat')};
 });
 expect(player.heading).toBeCloseTo(90,3);expect(player).toMatchObject({water:false,air:false,anim:false});
 // TASK_ENTER_CAR_AS_DRIVER: CJ walks to the door and gets in through his own entry; TASK_LEAVE_ANY_CAR gets him out.
 const ENTER=0x05cb,LEAVE=0x0633;
 const status=(opcode:number)=>page.evaluate(opcode=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(1,opcode),opcode);
 await page.evaluate(({car,opcode})=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.setPlayerControl?.(0,false);w.givePedScriptedTask(1,{kind:'enterCarAsDriver',vehicle:car,time:-1,moveState:4},opcode);},{car,opcode:ENTER});
 await expect.poll(()=>status(ENTER),{timeout:60000}).toBe(7);
 expect(await page.evaluate((car:number)=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(1),car)).toBe(car);
 await page.evaluate(opcode=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(1,{kind:'leaveAnyCar'},opcode),LEAVE);
 await expect.poll(()=>status(LEAVE),{timeout:60000}).toBe(7);
 expect(await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(1)??null)).toBeNull();
 expect(errors).toEqual([]);
});
