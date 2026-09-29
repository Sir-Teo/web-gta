import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
test('live pursuit populates off camera and remains playable while shooting and turning',async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await page.keyboard.type('turnuptheheat');await expect.poll(async()=>(await state()).wanted.level).toBe(2);
 await expect.poll(async()=>(await state()).police?.units.length??0,{timeout:20000}).toBeGreaterThan(0);
 await page.keyboard.down('KeyW');await page.waitForTimeout(1800);await page.keyboard.up('KeyW');
 await page.keyboard.press('Backquote');await page.locator('[data-weapon="22"]').click();await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 await page.mouse.move(400,400);await page.mouse.down();await page.mouse.move(1250,400,{steps:20});await page.mouse.up();
 await page.mouse.down({button:'right'});await page.keyboard.press('ControlLeft');await page.mouse.up({button:'right'});
 await page.waitForTimeout(6000);await page.screenshot({path:'artifacts/combat-pursuit-playtest.png'});
 const s=await state();expect(s.police.error).toBeNull();expect(s.pedestrians.error).toBeNull();expect(s.weapons.error).toBeNull();expect(errors).toEqual([]);
 console.log(JSON.stringify({wanted:s.wanted.level,officers:s.pedestrians.people.filter((p:any)=>p.officer),police:s.police,draws:s.draws}));
});
