import {test,expect} from '@playwright/test';
test('native police spawn, pursue, respect cover, fire, and accept surrender',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
 const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
 await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),law=new WantedSystem();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();law.setLevel(2);
 const crowd=new WorldPedestrians(sim,scene,new URL('/play/world/',location.href).href,()=>undefined,law);let shots=0;crowd.onShot=()=>shots++;
 try{
 for(let i=0;i<200&&!crowd.snapshot().people.some((p:any)=>p.officer);i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}const initial=crowd.snapshot();
 const tick=()=>{law.tick(1/60);crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();};
 const wall=sim.world.createCollider(RAPIER.ColliderDesc.cuboid(3,4,3).setTranslation(2490,15,1680));sim.world.step();for(let i=0;i<120;i++)tick();const coveredHealth=sim.player.health;sim.world.removeCollider(wall,true);sim.world.step();
 for(let i=0;i<600&&shots===0;i++)tick();const fired=shots,health=sim.player.health;
 law.surrendering=true;for(let i=0;i<1200&&!law.arrestRemaining;i++)tick();
 return {initial,coveredHealth,fired,health,arrested:law.arrestRemaining>0};
 }finally{crowd.dispose();sim.dispose();}
 });expect(result.initial.error).toBeNull();expect(result.initial.people.filter((p:any)=>p.officer)).toHaveLength(3);expect(result.coveredHealth).toBe(100);expect(result.fired).toBeGreaterThan(0);expect(result.health).toBeLessThan(100);expect(result.arrested).toBe(true);
});
test('unwitnessed gunfire adds no CWanted chaos in the playable world, as FIRE_WEAPON only matters when police are near',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});const state=()=>page.evaluate(()=>(window as any).__game.state());await page.keyboard.press('Tab');await page.locator('[data-weapon="22"]').click();await expect.poll(async()=>(await state()).weapons.ready).toBe(true);await expect.poll(async()=>(await state()).pedestrians.ready,{timeout:15000}).toBe(true);expect((await state()).pedestrians.people.filter((p:any)=>p.officer).length).toBe(0);await page.keyboard.press('ControlLeft');await expect.poll(async()=>(await state()).weapons.shots).toBeGreaterThan(0);await page.waitForTimeout(1500);expect((await state()).wanted.level).toBe(0);expect((await state()).wanted.chaos).toBe(0);await expect(page.locator('.wanted-status')).toBeHidden();await page.keyboard.press('Escape');const wanted=(await state()).wanted;await page.waitForTimeout(250);expect((await state()).wanted).toEqual(wanted);expect(errors).toEqual([]);
});
