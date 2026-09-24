import {test,expect} from '@playwright/test';

test('a bus stop queues peds a unit apart along its queue direction and shuffles them up when the head leaves',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WorldFleet},{WantedSystem},{Simulation},{loadWorldRoadMaterials},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WorldFleet.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base) as any;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  try{
   for(let i=0;i<300&&!fleet.catalog;i++){fleet.update(i*100);await new Promise(r=>setTimeout(r,20));}
   sim.timeMinutes=12*60;
   fleet.currentZone={infoLabel:'GAN1',textLabel:'GANTON',zoneInfoIndex:0,level:1,populationType:7,gangStrength:Array(10).fill(0),dealerStrength:0,noCops:false,races:15};
   crowd.pedZone=()=>fleet.pedZone();crowd.pedTargets=()=>({...fleet.pedTargets(),gangs:0,dealers:0,other:12});
   // One bus stop 20 m north of CJ (off screen: canSpawn is always true here), queue running south (native -y).
   const stop={key:'busstop:0:0',model:'busstop',type:2,scriptName:'none',probability:75,position:[2490,-1660,12.5],queueDir:[0,-1,0],useDir:[1,0,0],forwardDir:[1,0,0]};
   crowd.attractorsNear=()=>[stop];
   // Every passer-by's decision maker answers with the effect (the retail rows let a street ped pass it by half the time).
   {const decide=crowd.decide.bind(crowd);crowd.decide=(p:any,event:number,...rest:any[])=>event===27?233:decide(p,event,...rest);}
   // The spawns wait on model loads, which take longer after a long test run: up to 1200 tries.
   for(let i=0;i<1200&&(crowd.snapshot().queues[0]?.peds.length??0)<3;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const snap=crowd.snapshot();const queue=snap.queues[0];
   const at=(id:number)=>{const p=snap.people.find((p:any)=>p.id===id);return {slot:p.attract?.slot,phase:p.attract?.phase,x:+p.position.x.toFixed(2),z:+p.position.z.toFixed(2),heading:+p.heading.toFixed(2)};};
   const before=queue.peds.map(at);
   // The head leaves: the others walk up a slot, two seconds a slot.
   const head=crowd.people.find((p:any)=>p.id===queue.peds[0]);crowd.leaveAttractor(head);
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();};
   for(let i=0;i<60*12;i++)tick();
   const after=crowd.snapshot();const q2=after.queues[0];
   const moved=q2.peds.map((id:number)=>{const p=after.people.find((p:any)=>p.id===id);return {id,slot:p.attract?.slot,phase:p.attract?.phase,x:+p.position.x.toFixed(2),z:+p.position.z.toFixed(2)};});
   return {before,peds:queue.peds,headLeft:!after.people.find((p:any)=>p.id===queue.peds[0])?.attract,moved,tryOutcome:snap.attractorTry};
  }finally{crowd.dispose();fleet.dispose();sim.dispose();}
 });
 expect(result.peds.length).toBeGreaterThanOrEqual(3);
 // Slots 0, 1, 2 stand on the stop and one and two units back against the queue direction (native -y here, so
 // the line runs north: browser z shrinks), as ComputeAttractPos subtracts spacing × slot × queueDir.
 expect(result.before.slice(0,3).map((b:any)=>b.slot)).toEqual([0,1,2]);
 expect(result.before[0].phase).toBe('stand');expect(result.before[1].phase).toBe('wait');
 expect(Math.abs(result.before[0].z-1660)).toBeLessThan(0.3);
 expect(result.before[0].z-result.before[1].z).toBeGreaterThan(0.7);expect(result.before[1].z-result.before[2].z).toBeGreaterThan(0.7);
 // The head faces the use direction (native +x), the line faces the queue direction (native -y, browser +z, heading 0), toward the head.
 expect(Math.abs(result.before[0].heading-Math.PI/2)).toBeLessThan(0.05);
 expect(Math.abs(result.before[1].heading)).toBeLessThan(0.2);
 expect(result.headLeft).toBe(true);
 // After the shuffle the former second ped stands at the stop using it and the third waits one slot back.
 expect(result.moved[0].slot).toBe(0);expect(result.moved[0].phase).toBe('stand');expect(Math.abs(result.moved[0].z-1660)).toBeLessThan(0.4);
 expect(result.moved[1].slot).toBe(1);expect(['wait','go']).toContain(result.moved[1].phase);
});
