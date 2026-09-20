import {test,expect} from '@playwright/test';

test('off-screen peds past 25 units go four seconds after they were last needed, gang members 30 units later, and none past 54.5',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  // Everything counts as off screen; Families turf so a gang party exists too.
  const strengths=Array(10).fill(0);strengths[1]=255;
  crowd.canSpawn=()=>true;crowd.gangTurf=()=>({gang:1,strength:255});crowd.gangsNeeded=()=>2;crowd.pedTargets=()=>({dealers:0,gangs:3,cops:0,other:8,gangStrengths:strengths});
  try{
   let now=0;
   for(let i=0;i<300&&!(crowd.snapshot().people.some((p:any)=>p.gang===1)&&crowd.snapshot().people.some((p:any)=>p.gang===undefined));i++){now=i*1600;crowd.update(now);await new Promise(r=>setTimeout(r,20));}
   const civ=crowd.people.filter((p:any)=>p.gang===undefined&&!p.officer),gang=crowd.people.filter((p:any)=>p.gang===1);
   if(civ.length<3||!gang.length)throw new Error(JSON.stringify(crowd.snapshot().people.map((p:any)=>p.gang)));
   const place=(p:any,dz:number)=>{p.actor.player.position={x:2490,y:12.55,z:1680+dz};p.body.setTranslation({x:2490,y:13.45,z:1680+dz},true);};
   // A frame while everyone stands within 25 units refreshes their needed-until clocks, as ManagePed does each frame.
   for(const p of [...civ,...gang])place(p,20);
   crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();
   // A civilian at 20 (needed), one at 40 (needed no more after 4 s), one at 60 (past 54.5 at once); gang members
   // count 30 units nearer: one at 50 stays needed, one at 90 is past 54.5.
   place(civ[0],20);place(civ[1],40);place(civ[2],60);place(gang[0],50);if(gang[1])place(gang[1],90);
   const ids={near:civ[0].id,mid:civ[1].id,far:civ[2].id,gang:gang[0].id,gangFar:gang[1]?.id??-1};
   const alive=()=>{const s=new Set(crowd.people.map((p:any)=>p.id));return {near:s.has(ids.near),mid:s.has(ids.mid),far:s.has(ids.far),gang:s.has(ids.gang),gangFar:ids.gangFar<0?false:s.has(ids.gangFar)};};
   const t0=now+100;crowd.busy=false;crowd.update(t0);const first=alive();
   crowd.busy=false;crowd.update(t0+2000);const two=alive();
   crowd.busy=false;crowd.update(t0+5000);const five=alive();
   // A far ped in view fades instead: 8 alpha a frame from 255, gone once it reaches 0.
   const seen=crowd.people.find((p:any)=>p.id===ids.near);
   for(let i=0;i<20;i++){crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();}
   place(seen,60);crowd.canSpawn=()=>false;
   crowd.busy=false;crowd.update(t0+7000);const fading={present:!!crowd.people.find((p:any)=>p.id===ids.near),fadeOut:seen.fadeOut,alpha:seen.alpha};
   for(let i=0;i<20;i++){crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();}
   const midFade={alpha:seen.alpha,viewAlpha:seen.view.alpha};
   for(let i=0;i<20;i++){crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();}
   crowd.busy=false;crowd.update(t0+9000);const faded={present:!!crowd.people.find((p:any)=>p.id===ids.near),alpha:seen.alpha};
   return {first,two,five,fading,midFade,faded};
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.first).toEqual({near:true,mid:true,far:false,gang:true,gangFar:false});
 expect(result.two).toEqual({near:true,mid:true,far:false,gang:true,gangFar:false});
 expect(result.five).toEqual({near:true,mid:false,far:false,gang:true,gangFar:false});
 expect(result.fading).toEqual({present:true,fadeOut:true,alpha:255});
 expect(result.midFade.alpha).toBeCloseTo(255-8*20,0);expect(result.midFade.viewAlpha).toBeCloseTo((255-8*20)/255,2);
 expect(result.faded).toEqual({present:false,alpha:0});
});
