import {test,expect} from '@playwright/test';

/** CTaskSimpleFall::MakeAbortable(URGENT) refuses damage that leaves the ped alive: a ped still falling or lying down
 * takes the hit without starting a new fall, and gets up on his first timer. Only CTaskSimpleGetUp gives way, so a
 * blow while he is getting up floors him again. */
test('a ped lying down takes a blow without a new fall; one getting up is floored again',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  crowd.pedTargets=()=>({dealers:0,gangs:0,cops:0,other:3,gangStrengths:Array(10).fill(0)});
  try{
   for(let i=0;i<300&&!crowd.snapshot().people.length;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const p=crowd.people.find((p:any)=>!p.officer&&p.health>0);if(!p)throw new Error('no ped');
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();p.view.update(p.actor,1/60);};
   for(let i=0;i<10;i++)tick();
   crowd.hit(p,0,1,0,'ko_skid_front');const floored=p.down;
   for(let i=0;i<30;i++)tick();
   const beforeBlow=p.down;
   crowd.damageCollider(p.collider.handle,1,{x:0,z:1},'melee',{weapon:0,byPlayer:true});
   const afterBlow=p.down,lyingClip=p.view.reactionName,health=p.health;
   const getUp=p.view.reactionDuration('getup_front')??p.view.reactionDuration('getup')??1.37;
   while(p.down>getUp*.5)tick();
   const gettingUp=p.down;
   crowd.damageCollider(p.collider.handle,1,{x:0,z:1},'melee',{weapon:0,byPlayer:true});
   return {floored,beforeBlow,afterBlow,lyingClip,health,gettingUp,refloored:p.down};
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.health).toBeGreaterThan(0);
 // Lying down: the time down runs on; no new fall.
 expect(result.afterBlow).toBeCloseTo(result.beforeBlow,5);
 expect(result.afterBlow).toBeLessThan(result.floored);
 // Getting up: a fresh fall.
 expect(result.refloored).toBeGreaterThan(result.gettingUp+.5);
});
