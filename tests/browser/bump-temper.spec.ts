import {test,expect} from '@playwright/test';

test('a hothead swings back only when CJ annoys him, and a recruit never does',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2470,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const law=new WantedSystem(),crowd=new WorldPedestrians(sim,scene,base,()=>undefined,law) as any;
  crowd.pedTargets=()=>({dealers:0,gangs:0,cops:0,other:1,gangStrengths:Array(10).fill(0)});
  try{
   for(let i=0;i<300&&crowd.snapshot().people.length<1;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const ped=crowd.people[0];if(!ped)throw new Error('no ped');
   const bump=(o:{follow:boolean;pedSpeed:number;playerSpeed:number})=>{
    ped.temper=65;ped.follow=o.follow;ped.retaliate=0;ped.flee=0;ped.bumpCooldown=0;ped.down=0;ped.loiter=o.pedSpeed===0;
    const at={x:2490,y:12.55,z:1680};ped.actor.player.position={...at};ped.actor.player.heading=Math.PI;ped.actor.player.speed=o.pedSpeed;
    ped.body.setTranslation({x:at.x,y:13.45,z:at.z},true);ped.body.setNextKinematicTranslation({x:at.x,y:13.45,z:at.z});ped.collider.setTranslation({x:at.x,y:13.45,z:at.z});
    // CJ just behind the ped (the ped faces -z), heading the same way.
    sim.player.position={x:2490,y:12.55,z:1680.8};sim.player.heading=Math.PI;sim.player.speed=o.playerSpeed;
    crowd.beforeStep(1/60,[]);return ped.retaliate;
   };
   return {
    // A walking CJ into a standing ped: ComputePlayerCollisionWithPedResponse answers nothing.
    standing:bump({follow:false,pedSpeed:0,playerSpeed:2}),
    // Running into a walking ped from behind annoys him.
    annoyed:bump({follow:false,pedSpeed:2,playerSpeed:5}),
    // A recruit in formation only draws the BUMP line.
    recruit:bump({follow:true,pedSpeed:2,playerSpeed:5}),
   };
  }finally{crowd.dispose?.();sim.dispose();}
 });
 expect(result.standing).toBe(0);
 expect(result.annoyed).toBeGreaterThan(0);
 expect(result.recruit).toBe(0);
});
