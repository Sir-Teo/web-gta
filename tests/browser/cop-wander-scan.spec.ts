import {test,expect} from '@playwright/test';

test('a wandering cop chases a criminal ahead of him, and stolen cop cars and sounding alarms earn a star',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2450,y:12.55,z:1720};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const law=new WantedSystem(),crowd=new WorldPedestrians(sim,scene,base,()=>undefined,law) as any;
  crowd.pedTargets=()=>({dealers:0,gangs:0,cops:0,other:4,gangStrengths:Array(10).fill(0)});
  try{
   for(let i=0;i<300&&crowd.snapshot().people.length<2;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const civilians=crowd.people.filter((p:any)=>!p.officer&&p.health>0);if(civilians.length<2)throw new Error('no peds');
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();};
   const stand=(p:any,x:number,z:number,heading:number)=>{p.actor.player.position={x,y:12.55,z};p.actor.player.heading=heading;p.loiter=true;p.flee=0;p.retaliate=0;p.body.setTranslation({x,y:13.45,z},true);p.body.setNextKinematicTranslation({x,y:13.45,z});p.collider.setTranslation({x,y:13.45,z});};
   // A criminal 6 m in front of the cop (heading π faces −z), an innocent 6 m behind him.
   const criminal=civilians[0],innocent=civilians[1];criminal.pedType='CRIMINAL';innocent.pedType='CIVMALE';
   await crowd.spawnOfficer('lapd1',22,{x:2490,y:12.55,z:1680},Math.PI);
   const cop=crowd.people.find((p:any)=>p.officer);if(!cop)throw new Error('no cop');
   stand(cop,2490,1680,Math.PI);stand(criminal,2490,1674,0);stand(innocent,2490,1686,Math.PI);
   criminal.loiter=false;innocent.loiter=false;cop.loiter=false;
   const before={chase:cop.chase?.id??null,flee:criminal.flee};
   let found=-1;for(let i=0;i<30;i++){tick();if(cop.chase&&found<0)found=i;}
   const chase={target:cop.chase?.target===criminal?'criminal':cop.chase?.target===innocent?'innocent':null,seconds:cop.chase?.seconds,criminalFlee:criminal.flee,fleeFrom:criminal.fleePlayer?.from===cop,safe:criminal.fleePlayer?.safe,innocentFlee:innocent.flee,wait:cop.criminalsAt};
   const copStart={...cop.actor.player.position},crimStart={...criminal.actor.player.position};
   for(let i=0;i<90;i++)tick();
   const moved={cop:cop.actor.player.position.z-copStart.z,criminal:criminal.actor.player.position.z-crimStart.z};
   // Stolen cop car: a clean player in a law enforcer earns a star at the next scan; a sounding alarm 15 m away too,
   // but not 30 m away.
   cop.chase=undefined;law.clear();
   crowd.playerVehicle=()=>({position:{x:2490,y:13,z:1700},alarm:false,law:true,wrecked:false});
   for(let i=0;i<6;i++)tick();const stolen=law.level;const cz=cop.actor.player.position.z;
   law.clear();crowd.playerVehicle=()=>({position:{x:2490,y:13,z:cz+30},alarm:true,law:false,wrecked:false});
   for(let i=0;i<6;i++)tick();const farAlarm=law.level;
   crowd.playerVehicle=()=>({position:{x:2490,y:13,z:cz+15},alarm:true,law:false,wrecked:false});
   for(let i=0;i<6;i++)tick();const nearAlarm=law.level;
   law.clear();crowd.playerVehicle=()=>({position:{x:2490,y:13,z:cz+15},alarm:true,law:false,wrecked:true});
   for(let i=0;i<6;i++)tick();const wreckAlarm=law.level;
   return {before,found,chase,moved,stolen,farAlarm,nearAlarm,wreckAlarm};
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.before.chase).toBeNull();expect(result.before.flee).toBe(0);
 // The first 50 ms scan finds the criminal ahead, not the innocent behind: a 30 s seek, a for-good flee (100 safe).
 expect(result.found).toBeGreaterThanOrEqual(0);expect(result.found).toBeLessThan(6);
 expect(result.chase.target).toBe('criminal');expect(result.chase.seconds).toBeGreaterThan(29);
 expect(result.chase.criminalFlee).toBeGreaterThan(100);expect(result.chase.fleeFrom).toBe(true);expect(result.chase.safe).toBe(100);
 expect(result.chase.innocentFlee).toBe(0);expect(result.chase.wait).toBeGreaterThan(29);
 // The cop runs after him (north, −z) and the criminal runs off the same way.
 expect(result.moved.cop).toBeLessThan(-1);expect(result.moved.criminal).toBeLessThan(-2);
 expect(result.stolen).toBe(1);expect(result.farAlarm).toBe(0);expect(result.nearAlarm).toBe(1);expect(result.wreckAlarm).toBe(0);
});
