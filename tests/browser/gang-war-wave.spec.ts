import {test,expect} from '@playwright/test';

test('a gang war attack wave stands round a path node, armed and hostile, counts as overcome when down, and is released',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1720};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  crowd.pedTargets=()=>({dealers:0,gangs:0,cops:0,other:0,gangStrengths:Array(10).fill(0)});
  try{
   for(let i=0;i<300&&!crowd.snapshot().ready;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   for(let i=0;i<5;i++){crowd.update(performance.now());await new Promise(r=>setTimeout(r,60));}
   const before=crowd.people.length;
   const spawned=await crowd.spawnAttackWave(0,6,{x:2490,y:12.55,z:1680},60);
   const wave=crowd.people.filter((p:any)=>p.attackWave);
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();};
   for(let i=0;i<10;i++)tick();
   const first={spawned,before,count:wave.length,gangs:[...new Set(wave.map((p:any)=>p.gang))],armed:wave.filter((p:any)=>p.weapon).length,accuracy:[...new Set(wave.map((p:any)=>p.gunAccuracy))],
    hostile:wave.filter((p:any)=>p.retaliate>0).length,spread:Math.max(...wave.map((p:any)=>Math.hypot(p.actor.player.position.x-2490,p.actor.player.position.z-1680))),overcome:crowd.attackWaveOvercome()};
   // Kill all but one and step him 50 units off: the wave counts as overcome.
   for(const p of wave.slice(1))crowd.damageCollider(p.collider.handle,1000,{x:0,z:1});
   for(let i=0;i<5;i++)tick();
   const last=wave[0];const far={x:2490,y:13.45,z:1780};last.actor.player.position={x:far.x,y:12.55,z:far.z};last.body.setTranslation(far,true);last.body.setNextKinematicTranslation(far);last.collider.setTranslation(far);
   const midway={living:wave.filter((p:any)=>p.health>0).length,overcome:crowd.attackWaveOvercome(),flags:wave.filter((p:any)=>p.attackWave).length};
   const released=crowd.releaseAttackWave(true);
   return {first,midway,released,after:{flags:crowd.people.filter((p:any)=>p.attackWave).length,retaliate:last.retaliate}};
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.first.spawned).toBe(6);expect(result.first.count).toBe(6);expect(result.first.gangs).toEqual([0]);
 expect(result.first.armed).toBe(6);expect(result.first.accuracy).toEqual([60]);expect(result.first.hostile).toBe(6);
 expect(result.first.spread).toBeLessThan(12);expect(result.first.overcome).toBe(false);
 expect(result.midway.living).toBe(1);expect(result.midway.overcome).toBe(true);expect(result.midway.flags).toBe(1);
 expect(result.released).toBe(1);expect(result.after.flags).toBe(0);expect(result.after.retaliate).toBe(0);
});
