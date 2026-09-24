import {test,expect} from '@playwright/test';
// CTaskSimpleSwim::ProcessEffects: the crawl throws water_swim splashes from the hands and feet, and a dive throws one
// big splash.
test('the sprint crawl splashes its strokes and a dive throws a big splash',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 for(let i=0;i<40&&!(await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(560,1.5,1950);return g.state().player.swimming;}));i++)await page.waitForTimeout(400);
 await page.waitForTimeout(800);
 const seen=new Set<string>();
 const watch=async(ms:number)=>{const end=Date.now()+ms;while(Date.now()<end){for(const name of (await state()).fx.active)seen.add(name);await page.waitForTimeout(50);}};
 await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');
 await watch(4000);
 await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');
 expect(seen.has('water_swim')).toBe(true);
 await page.waitForTimeout(1200);
 await page.keyboard.down('ControlLeft');await watch(2500);await page.keyboard.up('ControlLeft');
 expect(seen.has('water_splash_big')).toBe(true);
 expect(errors).toEqual([]);
});
