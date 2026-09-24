import {test,expect} from '@playwright/test';
/** CPlayerInfo::StreamParachuteWeapon arms the parachute while the aircraft is over 50 units up, and
 * GivePlayerParachute hands it over as CJ bails out. */
test('bailing out of a high helicopter hands CJ a parachute',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await page.waitForFunction(()=>!!(window as any).__game.fleet(),undefined,{timeout:60000});
 const ok=await page.evaluate(async()=>{const g=(window as any).__game,p=g.state().player;const heli=await g.fleet().spawnCheatVehicle(487,p.position,p.heading);if(!heli)return false;
  heli.finishEnter();const t=heli.body.translation();heli.body.setTranslation({x:t.x,y:t.y+120,z:t.z},true);return true;});
 expect(ok).toBe(true);
 await page.waitForTimeout(1500);
 const before=await page.evaluate(()=>(window as any).__game.weapons().snapshot().id);
 await page.evaluate(()=>{const heli=[...(window as any).__game.fleet().planes].find((p:any)=>p.occupied);heli.exitAir();});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.weapons().snapshot().id),{timeout:5000}).toBe(46);
 expect(before).not.toBe(46);
 expect(errors).toEqual([]);
});
