import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('in the air the player\'s car rolls on the steering with the gas off, and not on the ground',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).nativeCar?.occupied,{timeout:15000}).toBe(true);
 await page.waitForTimeout(800);
 // The roll rate about the car's own forward axis (radians a second).
 const roll=()=>page.evaluate(()=>{const g=(window as any).__game,car=g.fleet?.()?[...g.fleet().cars].find((c:any)=>c.occupied)??g.worldCar?.():undefined;
  const body=(car??g.nativeCarBody?.())?.car?.body;const w=body.angvel(),r=body.rotation();
  // forward = rotate (0,0,-1) by r
  const x=r.x,y=r.y,z=r.z,s=r.w;const f={x:-(2*(x*z+s*y)),y:-(2*(y*z-s*x)),z:-(1-2*(x*x+y*y))};
  return w.x*f.x+w.y*f.y+w.z*f.z;});
 // On its wheels: A steers, it does not roll the car.
 await page.keyboard.down('KeyA');await page.waitForTimeout(400);const grounded=Math.abs(await roll());await page.keyboard.up('KeyA');
 // Lifted twelve units, wheels in the air: A rolls it.
 await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;g.placeCar(p.x,p.y+12,p.z,0);});
 await page.waitForTimeout(100);
 await page.keyboard.down('KeyA');await page.waitForTimeout(300);const airborne=Math.abs(await roll());await page.keyboard.up('KeyA');
 expect(grounded).toBeLessThan(.3);expect(airborne).toBeGreaterThan(.3);
 expect(errors).toEqual([]);
});
