import {test,expect} from '@playwright/test';
/** A new game hands CJ the whole arsenal with full clips (melee weapons, gifts and goggles hold no ammo) and full body armour, and INTRO's closing
 * REMOVE_ALL_CHAR_WEAPONS gives it back rather than leaving him with his fists. */
test('a new game starts with every weapon loaded and full armour, and keeps them through INTRO\'s clear-out',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 const loadout=()=>page.evaluate(()=>{const g=(window as any).__game,inv=g.weapons().inventory;
  return {owned:inv.owned.size,empty:[...inv.owned].filter((id:number)=>inv.magazine(id)>0&&inv.ammo.get(id).clip<inv.magazine(id)),armour:g.state().player.armour};});
 const start=await loadout();
 expect(start.owned).toBe(44);expect(start.empty).toEqual([]);expect(start.armour).toBe(100);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.runtime.active.some((a:any)=>a.thread.base>0&&a.thread.name==='INTRO')??false),{timeout:90000}).toBe(true);
 // INTRO's clear-out, run from the INTRO thread as the script runs it.
 await page.evaluate(()=>{const r=(window as any).__game.missionForProfiling().runtime,intro=r.active.find((a:any)=>a.thread.name==='INTRO').thread;
  const previous=r.currentThread;r.currentThread=intro;try{r.world.removeAllPedWeapons(1);}finally{r.currentThread=previous;}});
 const after=await loadout();
 expect(after.owned).toBe(44);expect(after.empty).toEqual([]);expect(after.armour).toBe(100);
 // Any other script's clear-out still takes them.
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.removeAllPedWeapons(1));
 expect((await loadout()).owned).toBe(1);
 expect(errors).toEqual([]);
});
