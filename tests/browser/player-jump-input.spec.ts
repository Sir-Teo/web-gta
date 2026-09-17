import {test,expect} from '@playwright/test';

test('the water task leaves a dry-land jump available to the player',async({page})=>{
 test.setTimeout(60000);
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:45000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().player.grounded)).toBe(true);
 const before=await page.evaluate(()=>(window as any).__game.state().player);
 expect(before.swimming).toBe(false);
 await page.keyboard.press('Space');
 await expect.poll(()=>page.evaluate(()=>{
  const s=(window as any).__game.state();
  return s.player.grounded?-Infinity:s.player.position.y;
 }),{intervals:[20],timeout:3000}).toBeGreaterThan(before.position.y+.2);
 await page.screenshot({path:'artifacts/player-dry-land-jump.png'});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().player.grounded)).toBe(true);
 expect(await page.evaluate(()=>(window as any).__game.state().player.swimming)).toBe(false);
});
