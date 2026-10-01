import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

/** The shops run from script.img's streamed scripts inside interiors, so they need MODELS\GTA_INT.IMG published. */
const interiorsPublished=(JSON.parse(readFileSync('public/play/world/manifest.json','utf8')).archives??[]).some((a:{name:string})=>a.name==='gta_int.img');
const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
const shop=(page:Page)=>page.evaluate(()=>{
 const g=(window as any).__game,m=g.missionForProfiling(),game=m.runtime.game;
 return {threads:m.runtime.active.map((a:any)=>a.thread.name as string),gaveUp:m.snapshot().gaveUp,money:g.sim.money as number,health:g.sim.player.health as number,
  weapon:g.state().weapons?.id as number,menu:game.menus.inUse.some((used:boolean)=>used),miniGame:game.miniGameInProgress as boolean};
});
/** Free roam with money, CJ walked through the named door and standing inside. */
async function inside(page:Page,door:string){
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await expect.poll(async()=>(await state(page)).entryExits?.count,{timeout:90000}).toBe(376);
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await page.evaluate(()=>{(window as any).__game.sim.money=5000;});
 const at=await page.evaluate(name=>{const e=(window as any).__game.entryExits().pool.find((p:any)=>p.name===name&&p.area===0);return {x:(e.rect[0]+e.rect[2])/2,y:(e.rect[1]+e.rect[3])/2,z:e.entranceZ};},door);
 await page.evaluate(p=>(window as any).__game.placePlayer(p.x,p.z-1,-p.y),at);
 await expect.poll(async()=>(await state(page)).lighting.area,{timeout:120000}).not.toBe(0);
 await expect.poll(async()=>(await state(page)).entryExits.loading,{timeout:60000}).toBe(false);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:30000}).toBe(true);
}
/** Stand CJ on a native point of the interior, on its floor. */
const standAt=(page:Page,x:number,y:number)=>page.evaluate(([x,y])=>{const g=(window as any).__game,p=g.state().player.position;g.placePlayer(x,g.groundAt(x,-y,p.y+1.5)??p.y,-y);},[x,y]);
const tap=async(page:Page,key:string)=>{await page.keyboard.down(key);await page.waitForTimeout(150);await page.keyboard.up(key);};

// ammu.scm (INTMAN starts it in an Ammu-Nation): the clerk behind the counter, the menus at the marker, BUY_ITEM.
test('CJ buys a pistol over the Ammu-Nation counter',async({page})=>{
 test.skip(!interiorsPublished,'Requires gta_int.img published with the world.');test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await inside(page,'AMMUN1');
 await expect.poll(async()=>(await shop(page)).threads,{timeout:30000}).toContain('AMUNAT');
 // The counter's marker: (296.506, -38.168), where the script's LOCATE_STOPPED_CHAR_ON_FOOT_3D waits.
 await standAt(page,296.5,-38.17);
 await expect.poll(async()=>(await shop(page)).menu,{timeout:30000}).toBe(true);
 expect((await shop(page)).miniGame).toBe(true);
 // Sprint is the script's cross button: Pistols, then the 9mm, then buy it.
 for(let presses=0;presses<6&&(await shop(page)).money===5000;presses++){await tap(page,'ShiftLeft');await page.waitForTimeout(1500);}
 const bought=await shop(page);
 expect(bought.money).toBe(4800);expect(bought.weapon).toBe(22);
 await page.screenshot({path:'artifacts/interior-shops-ammu.png'});
 // The enter-car key is its triangle: back out of the menus, and the script hands control back.
 for(let presses=0;presses<4&&(await shop(page)).miniGame;presses++){await tap(page,'KeyF');await page.waitForTimeout(1500);}
 const left=await shop(page);expect(left.miniGame).toBe(false);expect(left.gaveUp).toEqual([]);
 expect(errors).toEqual([]);
});

// junkfud.scm and foodbrains.scm in a Cluckin' Bell: the clerk at his scripted attractor, the meal menu, BUY_ITEM.
test('CJ buys a meal at Cluckin\' Bell',async({page})=>{
 test.skip(!interiorsPublished,'Requires gta_int.img published with the world.');test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await inside(page,'FDCHICK');
 await expect.poll(async()=>(await shop(page)).threads,{timeout:30000}).toContain('JFUD');
 // 2.5 units in front of the clerk the script makes at (368.789, -4.357), heading 180.
 await standAt(page,368.79,-6.86);
 await expect.poll(async()=>(await shop(page)).menu,{timeout:40000}).toBe(true);
 for(let presses=0;presses<4&&(await shop(page)).money===5000;presses++){await tap(page,'ShiftLeft');await page.waitForTimeout(2500);}
 expect((await shop(page)).money).toBeLessThan(5000);
 await page.screenshot({path:'artifacts/interior-shops-food.png'});
 expect((await shop(page)).gaveUp).toEqual([]);
 expect(errors).toEqual([]);
});

// vending_machine.scm, started by the object brain MAIN allocates to CJ_SPRUNK1: a dollar for thirty health.
test('a Sprunk machine sells CJ a drink',async({page})=>{
 test.skip(!interiorsPublished,'Requires gta_int.img published with the world.');test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await inside(page,'X7_11S');
 const machine=await page.evaluate(async()=>{
  const m=(window as any).__game.missionForProfiling();
  for(let i=0;i<60;i++){const found=m.brainObjectsSnapshot().find((b:any)=>b.model==='CJ_SPRUNK1');if(found)return found;await new Promise(r=>setTimeout(r,500));}
  return null;
 });
 expect(machine).not.toBeNull();
 // The script's use point: a unit in front of the machine (GET_OFFSET_FROM_OBJECT_IN_WORLD_COORDS 0 -1 0.5).
 const h=machine.heading*Math.PI/180,x=machine.position.x+Math.sin(h),y=machine.position.y-Math.cos(h);
 await standAt(page,x,y);
 await expect.poll(async()=>(await shop(page)).threads,{timeout:30000}).toContain('VENDING');
 await page.evaluate(()=>{(window as any).__game.sim.player.health=50;});
 await page.waitForTimeout(2500);
 for(let presses=0;presses<5&&(await shop(page)).money===5000;presses++){await tap(page,'KeyF');await page.waitForTimeout(1500);}
 expect((await shop(page)).money).toBe(4999);
 await expect.poll(async()=>(await shop(page)).health,{timeout:30000}).toBeGreaterThanOrEqual(80);
 expect((await shop(page)).gaveUp).toEqual([]);
 expect(errors).toEqual([]);
});

// gymbench.scm, started by the object brain on GYM_BENCH1: the weight menu, then CJ on the bench with the bar.
test('the Ganton gym bench takes CJ for a set',async({page})=>{
 test.skip(!interiorsPublished,'Requires gta_int.img published with the world.');test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await inside(page,'GYM1');
 await expect.poll(async()=>(await shop(page)).threads,{timeout:60000}).toContain('GYMBENC');
 // The script's own use point (its locals 5 to 7), a unit in front of the bench.
 const at=await page.evaluate(()=>{const t=(window as any).__game.missionForProfiling().runtime.active.find((a:any)=>a.thread.name==='GYMBENC').thread;return [t.locals.getFloat32(20,true),t.locals.getFloat32(24,true)];});
 await standAt(page,at[0],at[1]);
 await page.waitForTimeout(2500);
 // GET_CURRENT_DATE lets the first session of the day through: the weights menu comes up with the controls taken.
 for(let presses=0;presses<5&&!(await shop(page)).menu;presses++){await page.keyboard.down('KeyF');await page.waitForTimeout(400);await page.keyboard.up('KeyF');await page.waitForTimeout(2500);}
 expect((await shop(page)).menu).toBe(true);
 await tap(page,'ShiftLeft');
 // The menu goes and the set begins: the rep counter is on the screen.
 await expect.poll(async()=>(await shop(page)).menu,{timeout:20000}).toBe(false);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.onscreenTimer.counters.some((c:any)=>c.enabled)),{timeout:30000}).toBe(true);
 await page.screenshot({path:'artifacts/interior-shops-gym.png'});
 expect((await shop(page)).gaveUp).toEqual([]);
 expect(errors).toEqual([]);
});
