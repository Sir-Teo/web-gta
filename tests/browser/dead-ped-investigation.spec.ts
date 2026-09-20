import {test,expect} from '@playwright/test';

test('a stealth kill sends a ped who saw it to investigate the body: stand, run to 2 m, face, look, gesture, walk back; a weak one flees',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2450,y:12.55,z:1720};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  crowd.pedTargets=()=>({dealers:0,gangs:0,cops:0,other:6,gangStrengths:Array(10).fill(0)});
  try{
   for(let i=0;i<400&&crowd.snapshot().people.length<5;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const peds=crowd.people.filter((p:any)=>!p.officer&&p.health>0);if(peds.length<5)throw new Error('need 5 peds, got '+peds.length);
   const [victim,watcher,behind,far,weak]=peds;
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();for(const p of peds)p.view.update(p.actor,1);};
   const stand=(p:any,x:number,z:number,heading:number)=>{p.actor.player.position={x,y:12.55,z};p.actor.player.heading=heading;p.loiter=true;p.flee=0;p.fleePlayer=undefined;p.decisionMaker=2;p.body.setTranslation({x,y:13.45,z},true);p.body.setNextKinematicTranslation({x,y:13.45,z});p.collider.setTranslation({x,y:13.45,z});};
   // The victim at the origin; the watcher 5 m south facing north (−z, heading π), one 5 m north facing away
   // (north too), one 12 m south facing him, and a weak ped 6 m east facing west (heading −π/2 faces −x).
   const o={x:2490,z:1680};
   stand(victim,o.x,o.z,0);stand(watcher,o.x,o.z+5,Math.PI);stand(behind,o.x,o.z-5,Math.PI);stand(far,o.x,o.z+12,Math.PI);stand(weak,o.x+6,o.z,-Math.PI/2);
   const seq=[.5,.3,.95];let k=0;crowd.deadPedRandom=()=>seq[k++]??.5;
   for(let i=0;i<5;i++)tick();
   victim.stealth=0;
   let died=-1;for(let i=0;i<300;i++){tick();if(victim.health<=0){died=i;break;}}
   const atDeath={died,draws:k,watcher:watcher.investigate?.phase??null,behind:behind.investigate?.phase??null,far:far.investigate?.phase??null,weakFlee:weak.flee,weakSafe:weak.fleePlayer?.safe??null,weakInvestigate:weak.investigate?.phase??null};
   const phases:string[]=[];let lookDist=Infinity,looked=false,gesture=false,lookAtBody=false,minDist=Infinity,goStart=-1,goEnd=-1,lookFrames=0,endAt=-1;
   const dist=()=>Math.hypot(watcher.actor.player.position.x-o.x,watcher.actor.player.position.z-o.z);
   for(let i=0;i<1400;i++){tick();const ph=watcher.investigate?.phase??'done';if(phases[phases.length-1]!==ph)phases.push(ph);
    if(ph==='go'){if(goStart<0)goStart=i;goEnd=i;}
    if(ph==='look'){lookFrames++;lookDist=Math.min(lookDist,dist());if(watcher.look)looked=true;if(watcher.lookAt&&Math.abs(watcher.lookAt.x-o.x)<.5)lookAtBody=true;}
    if(ph==='shocked'&&watcher.view.reactionName==='roadcross')gesture=true;
    minDist=Math.min(minDist,dist());if(ph==='done'){endAt=i;break;}}
   const back=Math.hypot(watcher.actor.player.position.x-o.x,watcher.actor.player.position.z-(o.z+5));
   return {atDeath,phases,goFrames:goEnd-goStart,lookDist,lookFrames,looked,lookAtBody,gesture,minDist,endAt,back,behind:behind.investigate?.phase??null,farFlee:far.flee};
  }finally{crowd.dispose();sim.dispose();}
 });
 // The knife kill ends in death; the watcher ahead of the body and the weak ped draw (investigate, flee); the ped
 // facing away and the one 12 m off hear nothing.
 expect(result.atDeath.died).toBeGreaterThan(60);expect(result.atDeath.draws).toBe(3);
 expect(result.atDeath.watcher).toBe('stand');expect(result.atDeath.behind).toBeNull();expect(result.atDeath.far).toBeNull();
 expect(result.atDeath.weakFlee).toBeGreaterThan(100);expect(result.atDeath.weakSafe).toBe(100000);expect(result.atDeath.weakInvestigate).toBeNull();
 // Stand a second, run to two units, face, look 5 to 7 s at the body, the ROADCROSS gesture, walk back.
 expect(result.phases).toEqual(['stand','go','face','look','shocked','back','done']);
 expect(result.goFrames).toBeLessThan(90);
 expect(result.lookDist).toBeGreaterThan(1.4);expect(result.lookDist).toBeLessThan(2.7);
 expect(result.lookFrames).toBeGreaterThan(290);expect(result.lookFrames).toBeLessThan(430);
 expect(result.looked).toBe(true);expect(result.lookAtBody).toBe(true);expect(result.gesture).toBe(true);
 expect(result.back).toBeLessThan(1);expect(result.behind).toBeNull();expect(result.farFlee).toBe(0);
});
