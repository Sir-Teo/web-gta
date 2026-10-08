import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** The basic interactions a session leans on: pedestrians keep walking while the player drives, a pistol aimed
 * on foot walks on the GunMove clips and keeps firing, aim transitions do not stall the run, and a car is entered,
 * driven, left at speed and walked away from. Reproduced the September 19 reports (world and pedestrians frozen
 * by a traffic use-after-free trap; streaming stopped by a rejected window) before the fixes. */
test('pedestrians, pistol aim-walking and car entry and exit keep working',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 const canvas=page.locator('canvas.world');await canvas.click({position:{x:400,y:300}});
 await page.waitForTimeout(1500);
 const snap=(s:any)=>({phase:s.carEntry.phase,occupied:s.nativeCar?.occupied??null,grounded:s.player.grounded,x:s.player.position.x,z:s.player.position.z,speed:s.player.speed,carSpeed:s.nativeCar?Math.hypot(s.nativeCar.velocity.x,s.nativeCar.velocity.z):null,paused:s.paused});
 // 1. Enter the starter car from 6 m south of it, drive off, and leave it at speed: CTaskComplexLeaveCar waits for
 //    the car to slow, then the get-out clip plays and CJ is on foot beside it.
 const car=(await state()).fleet.cars.find((c:any)=>c.id==='starter');
 await page.evaluate(({x,z})=>{const g=(window as any).__game;g.placePlayer(x,g.groundAt(x,z,300)+.05,z);g.turnPlayer(0);},{x:car.position.x,z:car.position.z+6});
 await page.waitForTimeout(800);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).carEntry.phase,{timeout:10000}).toBe('seated');
 await page.keyboard.down('KeyW');await page.waitForTimeout(2500);
 const driving=snap(await state());expect(driving.carSpeed).toBeGreaterThan(5);
 await page.keyboard.press('KeyF');
 const phases=new Set<string>();
 await expect.poll(async()=>{const s=await state();if(s.carEntry.phase)phases.add(s.carEntry.phase);return s.carEntry.phase;},{timeout:8000}).toBeNull();
 await page.keyboard.up('KeyW');
 expect([...phases]).toContain('getOut');
 const out=snap(await state());expect(out.occupied).toBe(false);expect(out.grounded).toBe(true);
 // Face back up the cul-de-sac (the car stopped 2 m short of its fence) and walk off.
 await page.evaluate(()=>(window as any).__game.turnPlayer(0));
 await page.keyboard.down('KeyW');await page.waitForTimeout(900);const walking=snap(await state());await page.keyboard.up('KeyW');
 expect(walking.speed).toBeGreaterThan(1.5);
 expect(Math.hypot(walking.x-out.x,walking.z-out.z)).toBeGreaterThan(1);
 // 2. Pedestrians during a slow drive west along the channel: nobody in the plain walk state stands still for 5 s.
 await page.evaluate(()=>{const g=(window as any).__game;let x=2600;const z=1550;(window as any).__driveTimer=setInterval(()=>{const s=g.state();if(s.paused||s.terrainHold)return;x-=8*.2;const h=g.groundAt(x,z,300);if(h!==null)g.placePlayer(x,h+.05,z);},200);});
 // A ped waiting at a red pedestrian light stands 3 to 5 s at a time (CTaskComplexObserveTrafficLights), a brawler,
 // a staggered or head-scratching ped and one reacting to a gun or a car stand still on purpose: those are excluded.
 const rows:Record<number,{x:number;z:number;state:string;loiter:boolean;down:number;crossing:string|null;busy:boolean;detail:string}[]>={};
 for(let i=0;i<25;i++){const s=await state();for(const p of s.pedestrians?.people??[])(rows[p.id]??=[]).push({x:p.position.x,z:p.position.z,state:p.state,loiter:p.loiter,down:p.down,crossing:p.crossing,busy:p.retaliate>0||p.stagger>0||p.scratch>0||!!p.fight||!!p.gunReact||!!p.evade||!!p.carReact||!!p.reaction,detail:JSON.stringify({y:+p.position.y.toFixed(2),h:+p.heading.toFixed(2),rx:p.reaction,blocked:p.blocked,stuck:p.stuck,gait:p.gait,scratch:p.scratch,stagger:p.stagger,ret:p.retaliate,flee:p.flee,target:p.target,visible:p.visible,gang:p.gang,officer:p.officer})});await page.waitForTimeout(1000);}
 await page.evaluate(()=>clearInterval((window as any).__driveTimer));
 const stalled=Object.entries(rows).filter(([,r])=>{let run=0;for(let i=1;i<r.length;i++){const still=Math.hypot(r[i].x-r[i-1].x,r[i].z-r[i-1].z)<.2&&r[i].state==='walk'&&!r[i].loiter&&r[i].down===0&&!r[i].crossing&&!r[i].busy;run=still?run+1:0;if(run>=5)return true;}return false;}).map(([id])=>Number(id));
 expect(Object.keys(rows).length).toBeGreaterThan(5);
 for(const id of stalled)console.log('STALLED '+id+' '+JSON.stringify(rows[id].map(r=>[+r.x.toFixed(2),+r.z.toFixed(2),r.state,r.crossing,r.detail])));
 expect(stalled).toEqual([]);
 // 3. The pistol aimed on foot: GunMove clips carry CJ at weapon.dat's move speed, shots keep coming while he walks,
 //    pressing aim mid-run slews into the gun walk, and releasing it resumes the run.
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2600,g.groundAt(2600,1550,300)+.05,1550);g.turnPlayer(Math.PI/2);});
 await expect.poll(async()=>{const s=await state();return !s.paused&&!s.terrainHold&&s.following.pending===null&&s.player.grounded;},{timeout:30000}).toBe(true);
 await page.waitForTimeout(500);
 for(const letter of 'LXGIWYL')await page.keyboard.press(`Key${letter}`);
 await page.waitForTimeout(300);
 for(let i=0;i<60;i++){const w=(await state()).weapons;if(w.id===22)break;await page.mouse.wheel(0,120);await page.waitForTimeout(120);}
 expect((await state()).weapons.id).toBe(22);
 // The held model loads asynchronously after the wheel settles; CWeapon::Fire needs it in hand.
 await expect.poll(async()=>(await state()).weapons.ready,{timeout:15000}).toBe(true);
 // A ped within reach makes CWeapon::Fire pistol-whip instead of shooting: stand where nobody is close.
 for(const x of [2600,2560,2520,2640]){
  await page.evaluate(({x})=>{const g=(window as any).__game;g.placePlayer(x,g.groundAt(x,1550,300)+.05,1550);g.turnPlayer(Math.PI/2);},{x});
  await page.waitForTimeout(400);
  const s=await state();if(!(s.pedestrians?.people??[]).some((p:any)=>Math.hypot(p.position.x-s.player.position.x,p.position.z-s.player.position.z)<8))break;
 }
 await page.mouse.move(400,300);await page.mouse.down({button:'right'});await page.keyboard.down('KeyW');await page.waitForTimeout(600);
 const before=await state();await page.mouse.down({button:'left'});await page.waitForTimeout(1500);const during=await state();await page.mouse.up({button:'left'});
 const diag=(s:any)=>({shots:s.weapons.shots,clip:s.weapons.clip,ready:s.weapons.ready,cooldown:s.weapons.cooldown,reloading:s.weapons.reloading,id:s.weapons.id,stealth:s.weapons.stealth??null,action:s.nativeCharacter?.action,reaction:s.nativeCharacter?.reaction,health:s.player.health,knockdown:s.knockdown,wanted:s.wanted?.level,arrested:s.wanted?.arrested,paused:s.paused,death:s.deathRemaining,gun:s.nativeCharacter?.gun});
 console.log('AIMFIRE '+JSON.stringify({before:diag(before),during:diag(during),pointerLock:await page.evaluate(()=>document.pointerLockElement?.tagName??null),target:await page.evaluate(()=>document.elementFromPoint(400,300)?.className??null)}));
 expect(during.nativeCharacter.action).toBe('gunMove');
 expect(during.weapons.shots-before.weapons.shots).toBeGreaterThanOrEqual(3);
 const walked=Math.hypot(during.player.position.x-before.player.position.x,during.player.position.z-before.player.position.z);
 expect(walked).toBeGreaterThan(1.8);expect(walked).toBeLessThan(4);
 await page.mouse.up({button:'right'});await page.waitForTimeout(500);
 const running=await state();expect(running.nativeCharacter.action).toBe('run');expect(running.player.speed).toBeGreaterThan(4);
 await page.keyboard.up('KeyW');
 const s=await state();
 expect(s.subsystemFaults).toEqual([]);
 expect(errors).toEqual([]);
});
