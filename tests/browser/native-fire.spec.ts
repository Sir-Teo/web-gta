import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('a molotov lights native fires that burn CJ and a nearby pedestrian',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 mkdirSync('artifacts',{recursive:true});const timeline:any[]=[];
 const state=async()=>{const result=await page.evaluate(()=>{const g=(window as any).__game;return {state:g.state(),gameMs:g.weapons().nowMs};});timeline.push({wallMs:Date.now(),gameMs:result.gameMs,health:result.state.player.health,grounded:result.state.player.grounded,position:result.state.player.position,fires:result.state.weapons.fires});writeFileSync('artifacts/native-fire-timeline.json',JSON.stringify(timeline,null,2));return result.state;};
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.people?.filter((p:any)=>!p.officer&&p.health>0).length??0,{timeout:30000}).toBeGreaterThan(0);
 // CJ on the open road, a civilian four metres away, and a molotov at CJ's feet.
 await page.evaluate(()=>(window as any).__game.placePlayer(2480,12.6,1668));
 // Street civilians arrive once the popcycle targets and the zone roster exist; the debug ped is one of them.
 await expect.poll(async()=>(await state()).pedestrians.people.some((p:any)=>!p.officer&&p.health>0),{timeout:60000}).toBe(true);
 const id=await page.evaluate(()=>(window as any).__game.placePed(2484,12.55,1668));
 await page.waitForTimeout(400);
 // A new game's starting loadout gives full armour, which takes fire as it takes every blow but a fall's or drowning's
 // (CPedDamageResponseCalculator::AdjustPedArmour); it is health this is about.
 await page.evaluate(()=>{(window as any).__game.sim.player.armour=0;});
 const before=(await state()).player.health;
 const ignitionMs=await page.evaluate(()=>{const g=(window as any).__game;g.explodeAt(2480,12.8,1668,1);return g.weapons().nowMs;});
 // The molotov's explosion window sets the ground alight (SetWorldOnFire) and the civilian (SetPedsOnFire, 6-unit box).
 await expect.poll(async()=>(await state()).weapons.fires,{timeout:30000}).toBeGreaterThan(1);
 await expect.poll(async()=>(await state()).pedestrians.people.find((p:any)=>p.id===id)?.health??100,{timeout:30000}).toBeLessThan(100);
 expect(await page.evaluate(()=>(window as any).__game.weapons().nowMs)-ignitionMs).toBeLessThan(1000);
 // Fire deals 0.5 raw health per 50-Hz step, then the native player multiplier (0.33).
 // SwiftShader can advance far less game time than wall time while drawing the fire effects.
 await expect.poll(async()=>(await state()).player.health,{timeout:30000}).toBeLessThan(before);
 const burnStart=await page.evaluate(()=>({gameMs:(window as any).__game.weapons().nowMs,health:(window as any).__game.sim.player.health})),wallStart=Date.now();
 await page.waitForFunction(start=>(window as any).__game.weapons().nowMs-start>=2000,burnStart.gameMs,{timeout:30000});
 const burnEnd=await page.evaluate(()=>({gameMs:(window as any).__game.weapons().nowMs,health:(window as any).__game.sim.player.health}));
 writeFileSync('artifacts/native-fire-game-clock.json',JSON.stringify({before,burnStart,burnEnd,wallMs:Date.now()-wallStart},null,2));
 expect(burnEnd.health).toBeLessThan(before-10);
 // CTaskComplexOnFire: the burning civilian sprints away from CJ without flinching, then dies with KO_SHOT_FRONT_0.
 const burning=(await state()).pedestrians.people.find((p:any)=>p.id===id);
 if(burning.health>0){expect(burning.state).toBe('flee');expect(burning.reaction===null||burning.reaction==='ko_shot_front').toBe(true);}
 await expect.poll(async()=>(await state()).pedestrians.people.find((p:any)=>p.id===id)?.health,{timeout:15000}).toBe(0);
 expect((await state()).pedestrians.people.find((p:any)=>p.id===id).reaction).toBe('ko_shot_front');
 // CFire::ProcessFire keeps the fire on the body, a unit lower, until it burns out.
 const corpse=(await state()).pedestrians.people.find((p:any)=>p.id===id).handle;
 expect((await state()).weapons.pedFires).toContain(corpse);
 expect(errors).toEqual([]);
});
