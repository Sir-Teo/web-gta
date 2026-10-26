import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test.afterEach(async({page})=>{if(!page.isClosed())writeFileSync('artifacts/player-melee-combo-trace.json',JSON.stringify(await page.evaluate(()=>(window as any).__game?.__playerComboTrace??[]),null,2));});

test('left clicks punch through the native combo and kick a downed pedestrian',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 // INTRO takes CJ into the police car a few seconds in and holds his controls; this plays on in free roam.
 await endStoryMission(page);
 await expect.poll(async()=>(await state()).pedestrians?.people?.filter((p:any)=>!p.officer&&p.health>0).length??0,{timeout:30000}).toBeGreaterThan(0);
 await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 // Stand a civilian 1.1 m in front of CJ, facing him.
 const s0=await state(),h=s0.player.heading,at={x:s0.player.position.x+Math.sin(h)*1.1,y:s0.player.position.y,z:s0.player.position.z+Math.cos(h)*1.1};
 // Street civilians arrive once the popcycle targets and the zone roster exist; the debug ped is one of them.
 await expect.poll(async()=>(await state()).pedestrians.people.some((p:any)=>!p.officer&&p.health>0),{timeout:60000}).toBe(true);
 const id=await page.evaluate(([x,y,z])=>(window as any).__game.placePed(x,y,z),[at.x,at.y,at.z]);
 expect(id).not.toBeNull();
 // The empty decision maker (m_empty.ped) answers damage with nothing: the retail files would let an ordinary ped hit
 // back or run, which breaks the combo this spec measures.
 await page.evaluate(id=>{const g=(window as any).__game,crowd=g.pedestrians(),p=crowd.people.find((p:any)=>p.id===id),w=g.weapons(),oldSwing=w.onMeleeSwing,oldDamage=crowd.damageCollider,trace:any[]=[];p.decisionMaker=6;p.health=100;p.armour=0;g.__playerComboTrace=trace;
  const sample=()=>({game:w.nowMs,wall:performance.now(),cooldown:w.inventory.cooldown,stage:w.meleeStage,health:p.health,distance:Math.hypot(p.actor.player.position.x-g.sim.player.position.x,p.actor.player.position.z-g.sim.player.position.z),down:p.down,flee:p.flee,knockdown:g.sim.knockdown});
  document.addEventListener('mousedown',e=>trace.push({kind:'press',...sample(),target:(e.target as HTMLElement).tagName}),true);
  document.addEventListener('mouseup',e=>trace.push({kind:'release',...sample(),target:(e.target as HTMLElement).tagName}),true);
  w.onMeleeSwing=(...args:any[])=>{trace.push({kind:'swing',...sample(),move:args[1]});oldSwing?.(...args);};
  const oldFire=w.fire;w.fire=function(...args:any[]){const before=sample(),result=oldFire.apply(this,args);trace.push({kind:'fire',before,after:sample(),result,queued:w.meleeQueued});return result;};
  crowd.damageCollider=function(...args:any[]){const before=p.health,result=oldDamage.apply(this,args);if(args[0]===p.collider.handle)trace.push({kind:'hit',...sample(),before,raw:args[1],fight:args[4]?.fight&&{move:args[4].fight.move,group:args[4].fight.group}});return result;};
 },id);
 await page.waitForTimeout(300);
 const ped=async()=>page.evaluate(id=>{const p=(window as any).__game.pedestrians().people.find((p:any)=>p.id===id);return {health:p.health,down:p.down};},id);
 await page.mouse.move(700,450);
 const click=async()=>{await page.mouse.click(700,450);};
 // A short, still left click attacks without aiming, as SA's left button does.
 const health:number[]=[],down:number[]=[];
 // Each blow lands on its melee.dat hit frame (5, 8 and 10 of 30 fps) after its move starts; a press during a move
 // starts the next one at the chain frame.
 // Presses follow each blow as a player mashing would: a punched ped turns to flee once its hit clip ends.
 let last=100;
 for(let i=0;i<3;i++){let p={health:last,down:0};await click();await expect.poll(async()=>{p=await ped();return p.health;},{intervals:[30]}).toBeLessThan(last);last=p.health;health.push(p.health);down.push(p.down);}
 // UNARMED_1 damage 6, 9 and 15 (scaled for the player), chained inside each chain frame.
 expect(100-health[0]).toBeGreaterThan(0);
 expect(health[0]-health[1]).toBeCloseTo((100-health[0])*9/6,0);
 // The jab and cross only stagger; the third blow floors the victim.
 expect(down[0]).toBe(0);expect(down[1]).toBe(0);expect(down[2]).toBeGreaterThan(0);
 // A downed victim in reach takes the AGROUND kick.
 await page.waitForTimeout(600);
 // The kick lands on AGROUND's hit frame, 10.5 frames of game time on, which a slow renderer takes longer to reach. A
 // press that chained a fourth blow can have finished the victim; it is given its health back while it lies there.
 await page.evaluate(id=>{const p=(window as any).__game.pedestrians().people.find((p:any)=>p.id===id);if(p.health>0)p.health=100;},id);
 const before=(await ped()).health;expect(before).toBeGreaterThan(0);await click();
 await expect.poll(async()=>(await ped()).health,{timeout:10000}).toBeLessThan(before);
 expect(errors).toEqual([]);
});
