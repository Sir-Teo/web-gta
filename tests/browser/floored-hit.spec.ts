import {test,expect} from '@playwright/test';
// CEventDamage::ComputeDamageAnim on a floored ped gives KO_SKID (m_ucDirection + ANIM_ID_KO_SKID_FRONT) and the event
// handler hands it a new CTaskComplexFallAndGetUp: a second shot while he lies there starts his time down again.
test('a shot at a floored ped knocks him again and restarts his time down',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(150,.5,150).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,new URL('/play/world/',location.href).href,()=>undefined) as any;
  try{
   for(let i=0;i<300&&!crowd.people.length;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,25));}
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();};
   for(let i=0;i<30;i++)tick();
   const p=crowd.people[0];if(!p)throw new Error('no ped');
   p.health=100;
   // A blast floors him.
   const at=p.actor.player.position,from={x:at.x,z:at.z-3};
   crowd.damageCollider(p.collider.handle,10,{x:0,z:1},'explosion',{weapon:51,push:{x:0,z:2}});
   const firstDown=p.down;
   for(let i=0;i<60;i++)tick();
   const before=p.down;
   crowd.damageCollider(p.collider.handle,1,{x:0,z:1},'bullet',{weapon:22,point:{x:at.x,y:at.y+.3,z:at.z}});
   return {firstDown,before,after:p.down,health:p.health,clip:p.fallClip,from};
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.firstDown).toBeGreaterThan(0);
 expect(result.health).toBeGreaterThan(0);
 expect(result.after).toBeGreaterThan(result.before+.5);
 expect(result.clip).toMatch(/^ko_skid|^ko_spin/);
});
