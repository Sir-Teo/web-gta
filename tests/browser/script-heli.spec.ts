import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

/** HELI_GOTO_COORDS: CAutomobile::TellHeliToGoToCoors, then SteerAIHeliTowardsTargetCoors and
 * FlyAIHeliInCertainDirection (iOS 0x10019c430, 0x10019fcf4) flying it through FlyingControl. The port had no world
 * hook for it: fourteen missions' helicopters (BOAT, DRUGS4, ZERO4, DES3, SYN5, ...) were made in the air and fell. */
test('a script helicopter flies to its coordinates at its altitude, out past the draw range',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const p=await page.evaluate(()=>{const s=(window as any).__game.state().player.position;return {x:s.x,y:-s.z,z:s.y};});
 const heli=await page.evaluate(([x,y,z])=>(window as any).__game.missionForProfiling().runtime.world.createCar(487,x,y+30,z+30),[p.x,p.y,p.z] as const);
 await page.waitForFunction(b=>!!(window as any).__game.missionForProfiling().vehicles.entity(b),heli,{timeout:60000});
 const target={x:p.x,y:p.y+330,z:p.z+40};
 await page.evaluate(([b,t])=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.setHeliBladesFullSpeed(b);w.heliGotoCoords(b,t.x,t.y,t.z,10,t.z);},[heli,target] as const);
 const at=()=>page.evaluate(b=>(window as any).__game.missionForProfiling().runtime.world.vehiclePosition(b),heli);
 let lowest=Infinity,nearest=Infinity;
 for(let i=0;i<50;i++){await page.waitForTimeout(500);const q=await at();lowest=Math.min(lowest,q.z);nearest=Math.min(nearest,Math.hypot(q.x-target.x,q.y-target.y));}
 // It got there, more than 250 units from CJ, and held its height on the way: it never fell to the street.
 expect(nearest).toBeLessThan(25);
 expect(lowest).toBeGreaterThan(p.z+20);
 const end=await at();expect(Math.abs(end.z-target.z)).toBeLessThan(10);
 expect(errors).toEqual([]);
});
