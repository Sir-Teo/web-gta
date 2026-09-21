import {test,expect} from '@playwright/test';

// CGroupEventHandler::ComputeStareResponse with CTaskComplexStareAtPed: walk up to a gang party and every member
// turns on you, standing still and facing you until the timeout runs out.
test('a gang party stares at the player who walks up to its leader',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(2490,12,1680));
  sim.respawn={x:2450,y:12.55,z:1720};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  const strengths=Array(10).fill(0);strengths[1]=255;
  crowd.canSpawn=()=>true;crowd.gangTurf=()=>({gang:1,strength:255});crowd.gangsNeeded=()=>2;crowd.pedTargets=()=>({dealers:0,gangs:6,cops:0,other:0,gangStrengths:strengths});
  crowd.gangWeaponRandom=()=>.9;
  let ambient=.9;crowd.hangoutRandom=()=>ambient;
  const threats:number[]=[];crowd.onThreat=(ped:any)=>threats.push(ped.id);
  try{
   for(let i=0;i<400&&!crowd.people.some((p:any)=>p.hangout);i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const leader=crowd.people.find((p:any)=>p.hangout);if(!leader)throw new Error('no party');
   const members=leader.party.members as any[];
   // A party under three members starts by walking off; the stare belongs to a standing one.
   leader.hangout={phase:'stand',time:1e6};
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();for(const p of members)p.view.update(p.actor,1);};
   for(let i=0;i<5;i++)tick();
   // Far from the leader nobody stares.
   const lead=leader.actor.player.position;
   const place=(x:number,z:number)=>{sim.player.position={x,y:lead.y,z};sim.playerBody.setTranslation({x,y:lead.y+.9,z},true);sim.playerBody.setNextKinematicTranslation({x,y:lead.y+.9,z});sim.playerCollider.setTranslation({x,y:lead.y+.9,z});};
   place(lead.x+40,lead.z);for(let i=0;i<10;i++)tick();
   const far=members.filter((m:any)=>m.stare).length;
   // Six units away: every member takes the task.
   place(lead.x+6,lead.z);for(let i=0;i<10;i++)tick();
   const near=members.filter((m:any)=>m.stare).length;
   const phases=new Set(members.map((m:any)=>m.stare?.phase).filter(Boolean));
   // They turn to face the player and stand still doing it.
   const before=members.map((m:any)=>({...m.actor.player.position}));
   let facing=0;for(let i=0;i<240;i++){tick();
    facing=members.filter((m:any)=>{const d=Math.atan2(sim.player.position.x-m.actor.player.position.x,sim.player.position.z-m.actor.player.position.z)-m.actor.player.heading;return Math.abs(Math.atan2(Math.sin(d),Math.cos(d)))<.25;}).length;
    if(facing===members.length)break;}
   const drift=Math.max(...members.map((m:any,i:number)=>Math.hypot(m.actor.player.position.x-before[i].x,m.actor.player.position.z-before[i].z)));
   const looks=members.filter((m:any)=>!!m.look).length;
   // A low draw in the stare plays a gang talk clip.
   ambient=.001;tick();tick();ambient=.9;
   const talk=members.filter((m:any)=>/^prtial_gngtlk/.test(m.view.reactionName??'')).length;
   // The timeout ends it, and walking away keeps it off.
   for(let i=0;i<60*8;i++)tick();
   const afterTimeout=members.filter((m:any)=>m.stare).length;
   place(lead.x+40,lead.z);for(let i=0;i<10;i++)tick();
   const away=members.filter((m:any)=>m.stare).length;
   return {size:members.length,far,near,phases:[...phases],facing,drift,looks,talk,afterTimeout,away,threats:threats.length};
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.size).toBeGreaterThan(1);
 expect(result.far,JSON.stringify(result)).toBe(0);
 expect(result.near,JSON.stringify(result)).toBe(result.size);
 // Every member turns to face the player without leaving its spot.
 expect(result.facing,JSON.stringify(result)).toBe(result.size);
 expect(result.drift).toBeLessThan(.6);
 expect(result.looks).toBe(result.size);
 expect(result.talk,JSON.stringify(result)).toBeGreaterThan(0);
 // The gang's abuse line goes out once per member as the stare starts.
 expect(result.threats).toBe(result.size);
 expect(result.afterTimeout).toBe(0);expect(result.away).toBe(0);
});
