import {test,expect} from '@playwright/test';
test('native police spawn, pursue, respect cover, fire, and bust a suspect who falls beside them',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
 const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
 await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),law=new WantedSystem();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();law.setLevel(2);
 const crowd=new WorldPedestrians(sim,scene,new URL('/play/world/',location.href).href,()=>undefined,law);let shots=0;crowd.onShot=()=>shots++;
 try{
 for(let i=0;i<200&&!crowd.snapshot().people.some((p:any)=>p.officer);i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}const initial=crowd.snapshot();
 const tick=()=>{law.tick(1/60);crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();};
 const wall=sim.world.createCollider(RAPIER.ColliderDesc.cuboid(3,4,3).setTranslation(2490,15,1680));sim.world.step();for(let i=0;i<120;i++)tick();const coveredHealth=sim.player.health;sim.world.removeCollider(wall,true);sim.world.step();
 // Bystanders do not block a cop's line of sight (LineOfSightClearForAttack), so a round can meet another cop first.
 // CTaskSimpleGunControl's bursts come every DEFAULT_GUN_ATTACK_PERIOD (2000 ms) × 0.75 to 1.25 / (rate × 0.04).
 for(let i=0;i<2400&&sim.player.health>=100;i++)tick();const fired=shots,health=sim.player.health;
 // Standing still is not an arrest: only a suspect in a fall within 3 units of a cop.
 for(let i=0;i<120;i++)tick();const stillArrested=law.arrested;
 const cop=crowd.snapshot().people.find((p:any)=>p.officer&&p.health>0);const at={x:cop.position.x+1.5,y:cop.position.y,z:cop.position.z};
 // The cops' fire may have killed the suspect by now; a living one is needed for the bust.
 sim.player.health=100;sim.deathRemaining=0;sim.playerBody.setTranslation({x:at.x,y:at.y+.9,z:at.z},true);sim.player.position={...at};sim.knockdown=3;sim.knockdownGetUp=1;
 // The level may have eased while the cops took their time to land a round.
 const levelBefore=law.level;
 for(let i=0;i<30&&!law.arrested;i++)tick();
 return {initial,coveredHealth,fired,health,stillArrested,arrested:law.arrested,level:law.level,levelBefore,knockdown:sim.knockdown};
 }finally{crowd.dispose();sim.dispose();}
 });expect(result.initial.error).toBeNull();expect(result.initial.people.filter((p:any)=>p.officer)).toHaveLength(3);expect(result.coveredHealth).toBe(100);expect(result.fired).toBeGreaterThan(0);expect(result.health).toBeLessThan(100);expect(result.stillArrested).toBe(false);expect(result.arrested).toBe(true);
 // ArrestPlayer keeps the wanted level for the fee, and the suspect is held down.
 expect(result.levelBefore).toBeGreaterThan(0);expect(result.level).toBe(result.levelBefore);expect(result.knockdown).toBeGreaterThan(90);
});
test('at one star a cop beats an unarmed suspect with the nightstick combo, and the third swing knocks him down',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
 const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
 await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),law=new WantedSystem();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();law.setLevel(1);
 const crowd=new WorldPedestrians(sim,scene,new URL('/play/world/',location.href).href,()=>undefined,law);
 try{
 for(let i=0;i<200&&!crowd.snapshot().people.some((p:any)=>p.officer);i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
 const tick=()=>{law.tick(1/60);crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();};
 const hits:{weapon:number;fall?:boolean}[]=[];
 for(let i=0;i<3600&&!hits.some(h=>h.fall);i++){tick();hits.push(...sim.damageEvents.splice(0));}
 const weapons=crowd.snapshot().people.filter((p:any)=>p.officer).map((p:any)=>p.copWeapon);
 return {hits,weapons,health:sim.player.health,arrested:law.arrested};
 }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.weapons).toContain('nightstick');
 // BBALLBAT: two swings that only hurt, then FALL_3 on the third.
 const fall=result.hits.findIndex(h=>h.fall);
 expect(fall).toBeGreaterThanOrEqual(2);expect(result.hits.every(h=>h.weapon===3)).toBe(true);
 expect(result.health).toBeLessThan(100);
 // Nothing set the knockdown here, so there is no arrest yet.
 expect(result.arrested).toBe(false);
});
test('unwitnessed gunfire adds no CWanted chaos in the playable world, as FIRE_WEAPON only matters when police are near',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});const state=()=>page.evaluate(()=>(window as any).__game.state());await page.keyboard.press('Backquote');await page.locator('[data-weapon="22"]').click();await expect.poll(async()=>(await state()).weapons.ready).toBe(true);await expect.poll(async()=>(await state()).pedestrians.ready,{timeout:15000}).toBe(true);expect((await state()).pedestrians.people.filter((p:any)=>p.officer).length).toBe(0);await page.keyboard.press('ControlLeft');await expect.poll(async()=>(await state()).weapons.shots).toBeGreaterThan(0);await page.waitForTimeout(1500);expect((await state()).wanted.level).toBe(0);expect((await state()).wanted.chaos).toBe(0);await expect(page.locator('.wanted-status')).toBeHidden();await page.keyboard.press('Escape');const wanted=(await state()).wanted;await page.waitForTimeout(250);expect((await state()).wanted).toEqual(wanted);expect(errors).toEqual([]);
});
