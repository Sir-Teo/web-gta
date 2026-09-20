import {test,expect} from '@playwright/test';

test('Grove Street streams only the black civilian models its INITIAL race mask admits',async({page})=>{
 test.setTimeout(180000);
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians.roster.length,{timeout:60000}).toBeGreaterThanOrEqual(4);
 const s=await state();
 const race=(name:string)=>{for(let i=0;i<2;i++){const c=name[i]?.toUpperCase();if(c==='B')return 1;if(c==='H')return 4;if(c==='O'||c==='I')return 3;if(c==='W')return 2;}return 0;};
 // Ganton's mask is 1 (black): every streamed model is black or raceless.
 for(const name of s.pedestrians.roster)expect([0,1]).toContain(race(name));
 const civilians=s.pedestrians.people.filter((p:any)=>!p.officer&&typeof p.model==='string');
 for(const p of civilians)expect([0,1]).toContain(race(p.model));
});
