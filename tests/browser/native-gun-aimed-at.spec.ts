import {test,expect} from '@playwright/test';

test('a civilian with a gun aimed at it turns, raises its hands, then walks away',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),law=new WantedSystem();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();
  const crowd=new WorldPedestrians(sim,scene,new URL('/play/world/',location.href).href,()=>undefined,law);
  try{
   for(let i=0;i<200&&!crowd.snapshot().people.some((p:any)=>!p.officer&&p.decisionMaker!==3&&!p.gang);i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const tick=()=>{crowd.beforeStep(1/50,[]);sim.world.step();crowd.afterStep();};
   const ped=crowd.snapshot().people.find((p:any)=>!p.officer&&p.decisionMaker!==3&&!p.gang);
   const handle=ped.handle;
   // Six units in front of the ped, as CPedIntelligence::IsInSeeingRange needs.
   const aimer={x:ped.position.x+Math.sin(ped.heading)*6,y:ped.position.y,z:ped.position.z+Math.cos(ped.heading)*6};
   const behind={x:ped.position.x-Math.sin(ped.heading)*6,y:ped.position.y,z:ped.position.z-Math.cos(ped.heading)*6};
   const unseen=crowd.gunAimedAt(handle,behind);
   const affected=crowd.gunAimedAt(handle,aimer);
   const phases:string[]=[];let handsUp:number|null=null,walkedTo:any=null;
   for(let i=0;i<50*18;i++){
    tick();crowd.gunAimedAt(handle,aimer);
    const s=crowd.snapshot().people.find((p:any)=>p.id===ped.id);const phase=s?.gunReact??'none';
    if(phases.at(-1)==='wander'&&phase!=='wander')walkedTo={...s.position};
    if(phases.at(-1)!==phase)phases.push(phase);
    if(phase==='handsUp'&&handsUp===null)handsUp=i;
   }
   return {unseen,affected,phases,start:ped.position,end:walkedTo,aimer};
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.unseen).toBe(false);expect(result.affected).toBe(true);
 // CTaskComplexReactToGunAimedAt: face the aimer (instant when already facing it), hands up, walk off for 10 s.
 // A ped that wanders back into view of the still-aiming player reacts again, as the event is raised every frame.
 expect(result.phases.filter((p:string)=>p!=='heading').slice(0,3)).toEqual(['handsUp','wander','none']);
 const away=Math.hypot(result.end.x-result.aimer.x,result.end.z-result.aimer.z)-Math.hypot(result.start.x-result.aimer.x,result.start.z-result.aimer.z);
 expect(away).toBeGreaterThan(3);
});
