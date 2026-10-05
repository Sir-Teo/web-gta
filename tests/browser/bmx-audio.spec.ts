import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
// CAEVehicleAudioEntity's AE_BMX case: ProcessPlayerBicycle (from the iOS executable) over BICYCLE_D and _P, rebuilt
// from the iOS bundle: the tyres as the bike rolls, the freewheel's tick as the rider coasts, and the bell. Before,
// bicycles had no audio entity.
test('a BMX rolls on its tyres, ticks as it coasts and rings its bell',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:90000}).toBe(true);
 await endStoryMission(page);
 await page.evaluate(()=>(window as any).__game.spawnVehicle(481));
 const find="[...window.__game.fleet().bikes].find(b=>b.modelId===481)";
 await expect.poll(()=>page.evaluate(`!!${find}`),{timeout:30000}).toBe(true);
 await expect.poll(()=>page.evaluate(`window.__game.bikeMount().ready(${find})`),{timeout:30000}).toBe(true);
 await page.evaluate(`(()=>{const g=window.__game,t=${find}.body.translation();g.placePlayer(t.x+1.5,g.groundAt(t.x+1.5,t.z,t.y+5)+.05,t.z);})()`);
 await expect.poll(async()=>{const s=await state();return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);
 await page.waitForTimeout(500);await page.keyboard.press('KeyF');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.fleet().occupiedBike?.modelId),{timeout:90000}).toBe(481);
 const bmx=()=>page.evaluate(()=>{const a=(window as any).__game.state().audio.native;return {e:a.vehicles.find((v:any)=>v.model===481),banks:a.banks.slots};});
 // Getting on loads BICYCLE_P into the player engine slot; the tyre loop (type 1) plays.
 await expect.poll(async()=>(await bmx()).banks.some(([slot,bank]:number[])=>slot===40&&bank===19),{timeout:30000}).toBe(true);
 await page.keyboard.down('KeyW');
 await expect.poll(async()=>(await bmx()).e?.sounds.includes(1),{timeout:30000}).toBe(true);
 await page.waitForTimeout(1500);await page.keyboard.up('KeyW');
 // Coasting: the bike freewheels and the ratchet (type 2) plays.
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.fleet().occupiedBike.freewheeling),{timeout:10000}).toBe(true);
 await expect.poll(async()=>(await bmx()).e?.sounds.includes(2),{timeout:10000}).toBe(true);
 // The horn key rings the bell.
 await page.keyboard.down('KeyH');
 await expect.poll(async()=>(await bmx()).e?.horn,{timeout:10000}).toBe(true);
 await page.keyboard.up('KeyH');
 expect(errors).toEqual([]);
});
