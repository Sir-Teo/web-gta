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

/** HELI_FOLLOW_ENTITY (TRUTH2's police helicopter, DRUGS4, DES3): SteerAIHeliToFollowEntity (iOS 0x10019d400). */
test('a script helicopter made 150 units off comes to CJ and stays over him',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const p=await page.evaluate(()=>{const s=(window as any).__game.state().player.position;return {x:s.x,y:-s.z,z:s.y};});
 const heli=await page.evaluate(([x,y,z])=>(window as any).__game.missionForProfiling().runtime.world.createCar(497,x+150,y,z+30),[p.x,p.y,p.z] as const);
 await page.waitForFunction(b=>!!(window as any).__game.missionForProfiling().vehicles.entity(b),heli,{timeout:60000});
 await page.evaluate(b=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.setHeliBladesFullSpeed(b);w.heliFollowEntity(b,1,-1,20);},heli);
 const apart=async()=>{const [q,c]=await page.evaluate(b=>{const w=(window as any).__game.missionForProfiling().runtime.world;return [w.vehiclePosition(b),w.pedPosition(1)];},heli);return {along:Math.hypot(q.x-c.x,q.y-c.y),above:q.z-c.z};};
 // It closes on him and stays over him; with no brake but a back-off once he is behind it, it swings past him and
 // comes round again.
 const closest=async(seconds:number)=>{let nearest=Infinity,above=-Infinity;for(let i=0;i<seconds*2;i++){await page.waitForTimeout(500);const a=await apart();if(a.along<nearest){nearest=a.along;above=a.above;}}return {nearest,above};};
 const first=await closest(20);expect(first.nearest).toBeLessThan(20);expect(first.above).toBeGreaterThan(5);
 expect(errors).toEqual([]);
});

/** MAKE_HELI_COME_CRASHING_DOWN (WUZI5, SYN6, DES3, VCRASH1): MISSION_HELI_CRASH_AND_BURN (iOS 0x100199928) spins it
 * down, and CAutomobile::ProcessControl blows it up when it strikes the ground burning. */
test('a burning script helicopter told to crash spins down and blows up',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const p=await page.evaluate(()=>{const s=(window as any).__game.state().player.position;return {x:s.x,y:-s.z,z:s.y};});
 const heli=await page.evaluate(([x,y,z])=>(window as any).__game.missionForProfiling().runtime.world.createCar(487,x+40,y+40,z+40),[p.x,p.y,p.z] as const);
 await page.waitForFunction(b=>!!(window as any).__game.missionForProfiling().vehicles.entity(b),heli,{timeout:60000});
 await page.evaluate(([b,x,y,z])=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.setHeliBladesFullSpeed(b);w.heliGotoCoords(b,x+40,y+40,z+40,10,z+40);},[heli,p.x,p.y,p.z] as const);
 await page.waitForTimeout(2000);
 await page.evaluate(b=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.setVehicleHealth(b,240);w.makeHeliComeCrashingDown(b);},heli);
 const dead=()=>page.evaluate(b=>(window as any).__game.missionForProfiling().runtime.world.vehicleIsDeadForScript(b),heli);
 await expect.poll(dead,{timeout:15000}).toBe(true);
 expect(errors).toEqual([]);
});

/** HELI_LAND_AT_COORDS (GARAG1's RC Raider): MISSION_HELI_LAND, SteerAIHeliToLand (iOS 0x10019de50). */
test('a script helicopter told to land comes down on the spot and rests there',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const p=await page.evaluate(()=>{const s=(window as any).__game.state().player.position;return {x:s.x,y:-s.z,z:s.y};});
 const heli=await page.evaluate(([x,y,z])=>(window as any).__game.missionForProfiling().runtime.world.createCar(487,x+20,y+60,z+30),[p.x,p.y,p.z] as const);
 await page.waitForFunction(b=>!!(window as any).__game.missionForProfiling().vehicles.entity(b),heli,{timeout:60000});
 // The street beside CJ, where he stands.
 const spot={x:p.x+12,y:p.y,z:p.z};
 await page.evaluate(([b,s])=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.setHeliBladesFullSpeed(b);w.heliLandAtCoords(b,s.x,s.y,s.z,0,s.z+20);},[heli,spot] as const);
 const at=()=>page.evaluate(b=>(window as any).__game.missionForProfiling().runtime.world.vehiclePosition(b),heli);
 await expect.poll(async()=>{const q=await at();return Math.hypot(q.x-spot.x,q.y-spot.y)<12&&q.z<spot.z+4;},{timeout:40000,intervals:[500]}).toBe(true);
 await page.waitForTimeout(3000);const rest=await at();await page.waitForTimeout(2000);const still=await at();
 expect(Math.hypot(still.x-rest.x,still.y-rest.y,still.z-rest.z)).toBeLessThan(.5);
 expect(errors).toEqual([]);
});
