import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());

test('a paintjob puts its dictionary\'s texture on the body\'s remap materials, whitens the primary colour, and comes off again',async({page})=>{
 test.setTimeout(240000);
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2486,g.groundAt(2486,1662,40)+.05,1662);});
 await page.waitForTimeout(2500);
 // A Sultan (three paintjobs: sultan1-3.txd) beside CJ.
 const before=await page.evaluate(async()=>{
  const g=(window as any).__game,fleet=g.fleet();
  const car=await fleet.spawnScriptCar(560,{x:2481,y:g.groundAt(2481,1666,40),z:1666},Math.PI/2);(window as any).__sultan=car;
  const remap=car.car.materialBindings().filter((b:any)=>b.source.texture.toLowerCase().startsWith('remap'));
  return {remaps:fleet.catalog.upgrades.remapsOf('sultan'),materials:remap.length,maps:remap.map((b:any)=>b.material.map?.uuid),colours:[...car.assets.colourIndices],paintjob:car.paintjob};
 });
 expect(before.remaps).toEqual(['sultan1','sultan2','sultan3']);
 expect(before.materials).toBeGreaterThan(0);expect(before.paintjob).toBe(-1);
 const worn=async()=>page.evaluate(()=>{const car=(window as any).__sultan;
  const remap=car.car.materialBindings().filter((b:any)=>b.source.texture.toLowerCase().startsWith('remap'));
  return {maps:remap.map((b:any)=>b.material.map?.uuid),size:remap[0]?.material.map?.image?.width??remap[0]?.material.map?.mipmaps?.[0]?.width??null,colours:[...car.assets.colourIndices],paintjob:car.paintjob};});
 // CVehicle::SetRemap(1): sultan2.txd's one texture on every remap material once read, the primary colour 1.
 await page.evaluate(()=>(window as any).__game.fleet().setRemap((window as any).__sultan,1));
 await expect.poll(async()=>(await worn()).maps.every((m:string,i:number)=>m!==before.maps[i]),{timeout:10000}).toBe(true);
 const on=await worn();
 expect(new Set(on.maps).size).toBe(1);expect(on.paintjob).toBe(1);
 expect(on.colours).toEqual([1,...before.colours.slice(1)]);
 await page.evaluate(()=>{const g=(window as any).__game,car=(window as any).__sultan,r=g.render(),t=car.car.body.translation(),cam=r.camera.position.clone();
  r.fixedCamera={position:cam.clone().set(t.x+5,t.y+2.2,t.z+4),target:()=>cam.clone().set(t.x,t.y+.4,t.z)};});
 await page.waitForTimeout(600);
 await page.screenshot({path:test.info().outputPath('sultan-paintjob.png'),scale:'css'});
 // An index past the model's remaps takes it off, as -1 does: the materials' own texture back.
 await page.evaluate(()=>(window as any).__game.fleet().setRemap((window as any).__sultan,3));
 const off=await worn();
 expect(off.maps).toEqual(before.maps);expect(off.paintjob).toBe(-1);
});
