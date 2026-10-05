import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
// CAEVehicleAudioEntity's AE_BIKE case: a motorbike's engine is the car's (ProcessPlayerVehicleEngine for the rider,
// ProcessDummyVehicleEngine otherwise) over its own banks, SPORTSBIKE_P and _D for the PCJ-600, rebuilt from the iOS
// bundle. Before, bikes had no audio entity and rode in silence.
test('a motorbike has an engine sound, idling and accelerating',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:90000}).toBe(true);
 await endStoryMission(page);
 await page.evaluate(()=>(window as any).__game.spawnVehicle(461));
 await expect.poll(()=>page.evaluate(()=>[...(window as any).__game.fleet().bikes].some((b:any)=>b.modelId===461)),{timeout:30000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>{const g=(window as any).__game;return g.bikeMount().ready([...g.fleet().bikes].find((b:any)=>b.modelId===461));}),{timeout:30000}).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__game,t=[...g.fleet().bikes].find((b:any)=>b.modelId===461).body.translation();g.placePlayer(t.x+1.5,g.groundAt(t.x+1.5,t.z,t.y+5)+.05,t.z);});
 await expect.poll(async()=>{const s=await state();return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);
 await page.waitForTimeout(500);await page.keyboard.press('KeyF');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.fleet().occupiedBike?.modelId),{timeout:90000}).toBe(461);
 const entity=()=>page.evaluate(()=>{const a=(window as any).__game.state().audio.native;return {bike:a.vehicles.find((v:any)=>v.model===461),slots:a.slots,banks:a.banks.slots};});
 // Getting on as the rider loads SPORTSBIKE_P into the player engine slot (40), and the engine idles (PLAYER_ID, 6).
 await expect.poll(async()=>(await entity()).banks.some(([slot,bank]:number[])=>slot===40&&bank===125),{timeout:30000}).toBe(true);
 await expect.poll(async()=>(await entity()).bike?.state,{timeout:30000}).toBe(6);
 expect((await entity()).bike.player).toBe(true);
 // Throttle on: full acceleration (PLAYER_AC_FULL, 3) or the wheelspin it may start with, then cruise; sounds play.
 await page.keyboard.down('KeyW');
 const seen=new Set<number>();let sounds=0;
 for(let i=0;i<40;i++){await page.waitForTimeout(150);const e=await entity();seen.add(e.bike?.state);sounds=Math.max(sounds,e.bike?.sounds.length??0);}
 await page.keyboard.up('KeyW');
 expect([...seen].some(s=>s===3||s===4||s===5)).toBe(true);
 expect(sounds).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});
// The quad is an automobile to the audio (AE_CAR, QUADBIKE 48 and 47): the car's engine over four wheels.
test('a quad has the car engine, idling and accelerating',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:90000}).toBe(true);
 await endStoryMission(page);
 await page.evaluate(()=>(window as any).__game.spawnVehicle(471));
 await expect.poll(()=>page.evaluate(()=>{const g=(window as any).__game,q=[...g.fleet().bikes].find((b:any)=>b.modelId===471);return !!q&&g.bikeMount().ready(q);}),{timeout:30000}).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__game,t=[...g.fleet().bikes].find((b:any)=>b.modelId===471).body.translation();g.placePlayer(t.x+1.8,g.groundAt(t.x+1.8,t.z,t.y+5)+.05,t.z);});
 await expect.poll(async()=>{const s=await state();return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);
 await page.waitForTimeout(500);await page.keyboard.press('KeyF');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.fleet().occupiedBike?.modelId),{timeout:90000}).toBe(471);
 const entity=()=>page.evaluate(()=>{const a=(window as any).__game.state().audio.native;return {quad:a.vehicles.find((v:any)=>v.model===471),banks:a.banks.slots};});
 await expect.poll(async()=>(await entity()).banks.some(([slot,bank]:number[])=>slot===40&&bank===48),{timeout:30000}).toBe(true);
 await expect.poll(async()=>(await entity()).quad?.state,{timeout:30000}).toBe(6);
 await page.keyboard.down('KeyW');
 const seen=new Set<number>();let sounds=0;
 for(let i=0;i<40;i++){await page.waitForTimeout(150);const e=await entity();seen.add(e.quad?.state);sounds=Math.max(sounds,e.quad?.sounds.length??0);}
 await page.keyboard.up('KeyW');
 expect([...seen].some(s=>s===3||s===4||s===5)).toBe(true);
 expect(sounds).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});
