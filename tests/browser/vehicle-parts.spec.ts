import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());

test('tuning parts are drawn at the car\'s upgrade positions, a linked pair both sides, and come off again',async({page})=>{
 test.setTimeout(240000);
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2486,g.groundAt(2486,1662,40)+.05,1662);});
 await page.waitForTimeout(2500);
 // A Sultan: its spoiler position hangs from the boot, the roof and both wing positions from the chassis.
 const ids=await page.evaluate(async()=>{
  const g=(window as any).__game,fleet=g.fleet(),up=fleet.catalog.upgrades;
  const car=await fleet.spawnScriptCar(560,{x:2481,y:g.groundAt(2481,1666,40),z:1666},Math.PI/2);(window as any).__sultan=car;
  const ids={spoiler:up.idOf('spl_a_s_b'),roof:up.idOf('rf_a_s'),skirtLeft:up.idOf('wg_l_a_s'),skirtRight:up.idOf('wg_r_a_s')};
  for(const id of [ids.spoiler,ids.roof,ids.skirtLeft])fleet.drawUpgradePart(car,id);
  return ids;
 });
 const parts=async()=>page.evaluate(()=>{const car=(window as any).__sultan,out:Record<string,{parent:string;meshes:number;painted:boolean}>={};
  for(const name of ['ug_spoiler','ug_roof','ug_wing_left','ug_wing_right']){
   const frame=car.car.root.getObjectByName(name);let meshes=0,painted=false;
   frame?.traverse((o:any)=>{if(o!==frame&&o.isMesh){meshes++;}});
   // The part's primary-colour materials take the car's paint.
   const primary=car.assets.colors[0].map((v:number)=>v/255);
   frame?.traverse((o:any)=>{if(o.isMesh)for(const m of [o.material].flat())if(m.color&&Math.abs(m.color.r-primary[0])<.01&&Math.abs(m.color.g-primary[1])<.01&&Math.abs(m.color.b-primary[2])<.01)painted=true;});
   out[name]={parent:frame?.parent?.name??'',meshes,painted};
  }
  return out;});
 await expect.poll(async()=>Object.values(await parts()).every(p=>p.meshes>0),{timeout:15000}).toBe(true);
 const on=await parts();
 expect(on.ug_spoiler.parent).toBe('boot_dummy');expect(on.ug_roof.parent).toBe('chassis');
 expect(on.ug_wing_right.meshes).toBeGreaterThan(0);
 expect(Object.values(on).some(p=>p.painted)).toBe(true);
 expect(await page.evaluate(()=>(window as any).__game.fleet().drawnUpgradeParts((window as any).__sultan).sort())).toEqual([ids.spoiler,ids.roof,ids.skirtLeft,ids.skirtRight].sort());
 await page.evaluate(()=>{const g=(window as any).__game,car=(window as any).__sultan,r=g.render(),t=car.car.body.translation(),cam=r.camera.position.clone();
  r.fixedCamera={position:cam.clone().set(t.x-4,t.y+2.4,t.z+5),target:()=>cam.clone().set(t.x,t.y+.4,t.z)};});
 await page.waitForTimeout(800);
 await page.screenshot({path:test.info().outputPath('sultan-parts.png'),scale:'css'});
 // RemoveVehicleUpgrade: the skirts go together; another spoiler in the same position replaces the first.
 await page.evaluate(id=>{const g=(window as any).__game,car=(window as any).__sultan,fleet=g.fleet();fleet.removeUpgradePart(car,id);fleet.drawUpgradePart(car,fleet.catalog.upgrades.idOf('spl_c_s_b'));},ids.skirtLeft);
 await expect.poll(async()=>{const p=await parts();return [p.ug_wing_left.meshes,p.ug_wing_right.meshes];},{timeout:10000}).toEqual([0,0]);
 const after=await page.evaluate(()=>(window as any).__game.fleet().drawnUpgradeParts((window as any).__sultan));
 expect(after).toContain(await page.evaluate(()=>(window as any).__game.fleet().catalog.upgrades.idOf('spl_c_s_b')));
 expect(after).not.toContain(ids.spoiler);
});
