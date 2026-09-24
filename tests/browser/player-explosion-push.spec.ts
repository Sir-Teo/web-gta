import {test,expect} from '@playwright/test';

test('a blast CJ survives throws him away from it and up, with no knockout clip',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await page.waitForTimeout(1000);
 const start=(await state()).player.position;
 // A grenade-sized blast (type 0) five units to CJ's +x side, at his feet.
 await page.evaluate(({x,y,z})=>(window as any).__game.explodeAt(x-5,y+.2,z),start);
 let airborne=false,maxRise=0,reaction:string|null=null;
 for(let i=0;i<20;i++){await page.waitForTimeout(50);const s=await state();if(!s.player.grounded)airborne=true;maxRise=Math.max(maxRise,s.player.position.y-start.y);reaction??=s.nativeCharacter?.reaction??null;}
 const end=(await state()).player.position;
 expect(airborne).toBe(true);expect(maxRise).toBeGreaterThan(.2);
 // Thrown away from the blast: along +x.
 expect(end.x-start.x).toBeGreaterThan(.3);
 expect(reaction===null||!/^ko_/.test(reaction)).toBe(true);
 expect(errors).toEqual([]);
});
