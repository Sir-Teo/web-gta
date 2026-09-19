import {test,expect} from '@playwright/test';

// CTaskComplexKillPedOnFootMelee: a ped fighting CJ stops at the water's edge when he swims, faces him and shakes its
// fist (FUCKU), then stands, and goes back to fighting once he is out.
test('a brawler shakes its fist at CJ in the water instead of following him in',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */p)));
  await RAPIER.init();
  const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(150,.5,150).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,new URL('/play/world/',location.href).href,()=>undefined);
  try{
   for(let i=0;i<300&&!crowd.snapshot().people.length;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,25));}
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();crowd.render(1,[.7,.7,.7],0);};
   const p=(crowd as any).people.find((q:any)=>!q.officer&&q.health>0);
   const q=p.actor.player.position;sim.player.position={x:q.x+6,y:q.y,z:q.z};
   p.retaliate=10;p.foe=undefined;p.flee=0;p.loiter=false;sim.player.swimming=true;
   let shook=false;for(let i=0;i<120;i++){tick();if(p.view.reactionName==='fucku')shook=true;}
   const start={...p.actor.player.position};for(let i=0;i<60;i++)tick();
   const still=Math.hypot(p.actor.player.position.x-start.x,p.actor.player.position.z-start.z);
   const facing=Math.abs(Math.atan2(Math.sin(Math.atan2(sim.player.position.x-p.actor.player.position.x,sim.player.position.z-p.actor.player.position.z)-p.actor.player.heading),Math.cos(Math.atan2(sim.player.position.x-p.actor.player.position.x,sim.player.position.z-p.actor.player.position.z)-p.actor.player.heading)));
   sim.player.swimming=false;for(let i=0;i<60;i++)tick();
   return {shook,still,facing,taunt:p.taunt??null,closed:Math.hypot(sim.player.position.x-p.actor.player.position.x,sim.player.position.z-p.actor.player.position.z)};
  }finally{crowd.dispose();}
 });
 expect(result.shook).toBe(true);expect(result.still).toBeLessThan(.2);expect(result.facing).toBeLessThan(.25);
 // Out of the water the fight resumes: the ped closes in.
 expect(result.taunt).toBeNull();expect(result.closed).toBeLessThan(5.5);
 expect(errors).toEqual([]);
});
