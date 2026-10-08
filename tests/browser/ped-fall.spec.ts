import {test,expect} from '@playwright/test';

test('a street ped off the ground falls under gravity, glides then falls, and lands or collapses by the drop',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  crowd.pedTargets=()=>({dealers:0,gangs:0,cops:0,other:6,gangStrengths:Array(10).fill(0)});
  try{
   for(let i=0;i<300&&crowd.snapshot().people.length<2;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const [p,q]=crowd.people.filter((p:any)=>!p.officer&&p.health>0);if(!p||!q)throw new Error('no peds');
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();p.view.update(p.actor,1);q.view.update(q.actor,1);};
   for(let i=0;i<10;i++)tick();
   const drop=(height:number,p:any)=>{
    const t=p.body.translation(),at={x:t.x,y:12.55+.9+height,z:t.z};
    p.body.setTranslation(at,true);p.body.setNextKinematicTranslation(at);p.collider.setTranslation(at);p.actor.player.position={x:at.x,y:at.y-.9,z:at.z};
    const clips:string[]=[];let peakFall=0,airSeconds=0,landed=-1,tookOff=false;
    for(let i=0;i<360;i++){
     tick();
     const clip=p.view.reactionName??null;if(clip&&clips[clips.length-1]!==clip)clips.push(clip);
     if(p.air){tookOff=true;peakFall=Math.min(peakFall,p.air.vz);airSeconds=p.air.seconds;}
     else if(tookOff&&landed<0)landed=i;
     if(landed>=0&&i>landed+150)break;
    }
    return {clips,peakFall:+peakFall.toFixed(2),airSeconds:+airSeconds.toFixed(2),landed,health:p.health,down:p.down,y:+p.actor.player.position.y.toFixed(2)};
   };
   const low=drop(.5,p),rest=p.actor.player.position.y;for(let i=0;i<60;i++)tick();
   const mid=drop(2,p);for(let i=0;i<60;i++)tick();
   const high=drop(12,p);
   // A second ped for the five metres, so its injury does not colour the first one's falls.
   const five=drop(5,q);
   return {low,mid,five,high,rest};
  }finally{crowd.dispose();sim.dispose();}
 });
 // Half a metre: a glide under 0.1 units a frame, a soft FALL_land, no damage; the fall's speed is gravity's.
 expect(result.low.clips.slice(0,2)).toEqual(['fall_glide','fall_land']);
 expect(result.low.peakFall).toBeLessThan(-3.5);expect(result.low.peakFall).toBeGreaterThan(-5);
 expect(result.low.health).toBe(100);expect(result.low.down).toBe(0);
 expect(Math.abs(result.low.y-result.rest)).toBeLessThan(0.05);
 // Two metres: past 0.1 units a frame, but CTaskSimpleInAir's vertical line (4 units down) still finds the ground, so
 // the glide never turns into FALL_fall and he lands softly, unhurt.
 expect(result.mid.clips.slice(0,2)).toEqual(['fall_glide','fall_land']);
 expect(result.mid.peakFall).toBeLessThan(-8);expect(result.mid.peakFall).toBeGreaterThan(-10);
 expect(result.mid.health).toBe(100);expect(result.mid.down).toBe(0);
 // Five metres: the line finds nothing once he is past 0.1 units a frame, so the glide turns into FALL_fall; landing
 // past 10 m/s (but under 0.4 units a frame, no knockdown) costs a little health.
 expect(result.five.clips.slice(0,2)).toEqual(['fall_glide','fall_fall']);
 expect(result.five.peakFall).toBeLessThan(-10);expect(result.five.peakFall).toBeGreaterThan(-20);
 expect(result.five.health).toBeLessThan(100);expect(result.five.health).toBeGreaterThan(50);
 // Twelve metres: over 0.4 units a frame the impact knocks him down (KO_skid_back) and costs (speed − 10) × 8 health.
 expect(result.high.clips.slice(0,3)).toEqual(['fall_glide','fall_fall','ko_skid_back']);
 expect(result.high.peakFall).toBeLessThan(-20);
 expect(result.high.airSeconds).toBeGreaterThan(0.9);
 expect(result.high.health).toBeLessThan(30);expect(result.high.health).toBeGreaterThan(0);
});
