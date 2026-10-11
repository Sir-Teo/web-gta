import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** TASK_SWIM_TO_COORD and SET_SWIM_SPEED (CTaskSimpleSwim::ProcessControlAI): SYN5's target dives off the Esplanade and
 * swims for a boat, SET_SWIM_SPEED 2.3 putting him on the crawl; the triathlon's swimmers do the same. The browser's
 * peds could not swim, and the thread gave up at the task. */
const SWIM_TO_COORD=0x07e1;
test('a script ped swims to a point at the surface, faster on the crawl once its swim speed is set',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 // SYN5's dock on the Esplanade, and its swimmer's start in the bay beside it.
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,-1616.5,1402.9,6.2));
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.player.grounded&&!s.terrainHold;},undefined,{timeout:90000});
 await page.waitForTimeout(1000);
 // Made on the dock, then put in the water with his task in the same script frame, as SYN5 does it.
 const ped=await page.evaluate(()=>(window as any).__game.missionForProfiling().peds.create(4,'MALE01',{x:-1612,y:1402.9,z:6.2}));
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:45000});
 const water=await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.waterHeightAtCoords(-1543.9,1401.6,false));
 const target={x:-1570,y:1425,z:0};
 await page.evaluate(({ped,target,opcode})=>{const w=(window as any).__game.missionForProfiling().runtime.world;
  w.setPedFlag(ped,'drownsInWater',false);w.setPedCoordinates(ped,-1543.9,1401.6,0);w.givePedScriptedTask(ped,{kind:'swimToCoord',...target},opcode);},{ped,target,opcode:SWIM_TO_COORD});
 const at=()=>page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.pedPosition(h),ped);
 const left=async()=>{const p=await at();return Math.hypot(p.x-target.x,p.y-target.y);};
 const status=()=>page.evaluate(({ped,op})=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(ped,op),{ped,op:SWIM_TO_COORD});
 await page.waitForTimeout(500);
 const start=await left();
 // The breaststroke at half its shift (no swim speed yet): on his way, at the surface, the task running.
 await page.waitForTimeout(3000);
 const slow=start-await left();
 expect(slow).toBeGreaterThan(2);
 const p=await at();expect(Math.abs(p.z-(water-.4))).toBeLessThan(.5);
 expect(await status()).not.toBe(7);
 // SET_SWIM_SPEED 2.3: the crawl, much faster.
 await page.evaluate(ped=>(window as any).__game.missionForProfiling().runtime.world.setPedSwimSpeed(ped,2.3),ped);
 const before=await left();await page.waitForTimeout(2000);
 if(before>8)expect(before-await left()).toBeGreaterThan(slow);
 // At the point he treads water there, still on the task.
 await expect.poll(left,{timeout:20000}).toBeLessThan(1.5);
 expect(await status()).not.toBe(7);
 expect(errors).toEqual([]);
});
