import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
const threads=(page:Page)=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.active.map((a:any)=>a.thread.name as string));

// CCarGenerator::DoInternalProcessing (reversed): a generator whose own model is the hot-dog van (588) attaches a
// BMOCHIL vendor to the van it makes, and the random-ped brain MAIN gave his model starts hotdog.scm (HOTDOGV) on him.
// Standing on foot at the van's right side, 2 units out, CJ buys a hot dog: 50 health for a dollar.
test('a generated hot-dog van has its vendor, who sells CJ a hot dog',async({page})=>{
 test.setTimeout(420000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 // The generator by the lake north of Las Venturas' airport (680.8, 1831.3, 4.7), the van out of sight behind CJ.
 const gen=await page.evaluate(()=>(window as any).__game.fleet().records.find((r:any)=>r.modelId===588&&Math.hypot(r.position[0]-680.8,r.position[1]-1831.3)<5)?.position);
 expect(gen).toBeTruthy();
 await page.evaluate(([x,y,z])=>{const g=(window as any).__game;g.placePlayer(x+25,z+.5,-y);g.sim.money=100;g.sim.player.health=50;},gen);
 await expect.poll(async()=>(await threads(page)).includes('HOTDOGV'),{timeout:240000,intervals:[3000]}).toBe(true);
 const van=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),vendor=m.peds.handles.find((h:any)=>m.peds.modelOf(h)===168);
  const ride=m.peds.rideOf(vendor),car=m.vehicles.entity(ride.vehicle),p=car.car.body.translation(),q=car.car.body.rotation();
  return {vendor,ride,position:{x:p.x,y:p.y,z:p.z},rotation:{x:q.x,y:q.y,z:q.z,w:q.w}};});
 expect(van.ride.offset).toEqual({x:0,y:0,z:.6});
 // The serving side: GET_OFFSET_FROM_CAR_IN_WORLD_COORDS (2, 0, 0), the van's right, in renderer axes.
 await page.evaluate(v=>{const g=(window as any).__game,q=v.rotation,x=1-2*(q.y*q.y+q.z*q.z),z=2*(q.x*q.z-q.w*q.y);
  const at={x:v.position.x+x*2,z:v.position.z+z*2};g.placePlayer(at.x,g.groundAt(at.x,-at.z,v.position.y+3)??v.position.y,at.z);},van);
 await expect.poll(async()=>(await state(page)).player.health,{timeout:30000}).toBe(100);
 expect((await state(page)).money).toBe(99);
 await page.evaluate(v=>{const g=(window as any).__game,me=g.state().player.position;g.render().yaw=Math.atan2(v.position.x-me.x,v.position.z-me.z)+Math.PI;},van);
 await page.waitForTimeout(1500);
 await page.screenshot({path:'artifacts/hotdog-van.png'});
 expect(await page.evaluate(()=>(window as any).__game.missionForProfiling().snapshot().gaveUp)).toEqual([]);
 expect(errors).toEqual([]);
});
