import {test,expect} from '@playwright/test';
// CWeapon::TakePhotograph: the camera spends film and marks the peds it catches for HAS_CHAR_BEEN_PHOTOGRAPHED.
test('a photo spends film and marks the ped in frame as photographed',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:45000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians.people.some((p:any)=>!p.officer&&p.health>0),{timeout:60000}).toBe(true);
 await page.keyboard.press('Backquote');await page.locator('[data-weapon="43"]').click();
 await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 const film=(await state()).weapons.clip;
 await page.mouse.move(720,450);await page.mouse.down({button:'right'});await page.waitForTimeout(1200);
 const id=await page.evaluate(()=>{const g=(window as any).__game,c=g.render().camera,d=c.getWorldDirection(c.position.clone()),p=c.getWorldPosition(c.position.clone());const s=g.state().player.position;return g.placePed(p.x+d.x*12,s.y,p.z+d.z*12);});
 await page.waitForTimeout(800);
 await page.mouse.down();await page.waitForTimeout(80);await page.mouse.up();await page.waitForTimeout(800);
 const photographed=await page.evaluate(id=>((window as any).__game.pedestrians().people as any[]).find(q=>q.id===id)?.photographed??null,id);
 expect(id).not.toBeNull();expect(photographed).toBe(true);
 expect((await state()).weapons.clip).toBe(film-1);
});
