import {test,expect} from '@playwright/test';

// CTaskComplexWander::ControlSubTask: a walker pressed against a wall for about a second scratches its head
// (XPRESSscratch), then turns its wander an eighth and heads for another node.
test('a wandering ped stuck against a wall scratches its head and re-paths',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */p)));
  await RAPIER.init();
  const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(150,.5,150).setTranslation(2490,12,1680));
  sim.respawn={x:2600,y:12.55,z:1600};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,new URL('/play/world/',location.href).href,()=>undefined);
  try{
   // Hidden spots take peds 15-25 units out and spots in view 42.5-50.5 (CPopulation::Update): near counts as
   // hidden and far as in view so both bands fill, then everything is hidden again.
   {const c=sim.player.position;(crowd as any).canSpawn=(pt:any)=>Math.hypot(pt.x-c.x,pt.z-c.z)<30;}
   for(let i=0;i<300&&!crowd.snapshot().people.length;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,25));}
   (crowd as any).canSpawn=()=>true;
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();crowd.render(1,[.7,.7,.7],0);};
   for(let i=0;i<30;i++)tick();
   const internal=crowd as any,p=internal.people.find((q:any)=>!q.officer&&q.health>0&&!q.loiter);
   const q=p.actor.player.position,to=internal.wanderPoint(p),dx=to.x-q.x,dz=to.z-q.z,d=Math.hypot(dx,dz)||1;
   // A wall one unit ahead, across the way to the next node.
   const wall=sim.world.createCollider(RAPIER.ColliderDesc.cuboid(12,2,.2).setTranslation(q.x+dx/d*.9,q.y+1,q.z+dz/d*.9).setRotation({x:0,y:Math.sin(Math.atan2(dx,dz)/2),z:0,w:Math.cos(Math.atan2(dx,dz)/2)}));
   const target=p.target;let scratched=-1;
   for(let i=0;i<240;i++){tick();if(p.view.reactionName==='xpressscratch'&&scratched<0)scratched=i;}
   sim.world.removeCollider(wall,true);
   return {scratched,retargeted:p.target!==target};
  }finally{crowd.dispose();}
 });
 expect(result.scratched).toBeGreaterThan(30);expect(result.scratched).toBeLessThan(200);
 expect(result.retargeted).toBe(true);
 expect(errors).toEqual([]);
});
