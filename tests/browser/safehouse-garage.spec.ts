import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
// CGarage::Update's hideout case (the iOS executable's): the Johnson house garage (cjsafe) opens for CJ walking up to
// it and shuts once he walks away. Before, a safehouse garage's door never moved.
test('the Johnson house garage opens for CJ on foot and shuts when he walks off',async({page})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:90000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.missionForProfiling()?.runtime),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const garage=()=>page.evaluate(()=>{const g=(window as any).__game.missionForProfiling().runtime.game.garages.garages.find((x:any)=>x.name==='cjsafe');return g&&{state:g.doorState,position:+g.doorPosition.toFixed(3)};});
 await expect.poll(garage,{timeout:30000}).toMatchObject({state:0,position:0});
 // The garage's box runs from native y -1699.36 north; CJ stands 3 units south of its door (browser z = -native y).
 const stand=(southOfDoor:number)=>page.evaluate(d=>{const g=(window as any).__game,z=1699.36+d;g.placePlayer(2505.5,g.groundAt(2505.5,z,20)+.05,z);},southOfDoor);
 await stand(3);
 await expect.poll(async()=>(await garage())?.state,{timeout:30000}).toBe(1);
 expect((await garage())?.position).toBe(1);
 // Fifteen units off on foot (past four), the door comes down and the garage is shut.
 await stand(15);
 await expect.poll(async()=>(await garage())?.state,{timeout:30000}).toBe(0);
 expect((await garage())?.position).toBe(0);
 expect(errors).toEqual([]);
});
