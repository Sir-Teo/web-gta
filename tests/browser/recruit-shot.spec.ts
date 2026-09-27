import {test,expect} from '@playwright/test';

test('a recruit CJ shoots leaves his group instead of wandering off inside it',async({page})=>{
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
   ped.follow=true;ped.health=100;
   crowd.damageCollider(ped.collider.handle,10,{x:0,z:1},'bullet',{weapon:22});
   const shot={follow:ped.follow,alive:ped.health>0};
   return {shot};
  }finally{crowd.dispose?.();sim.dispose();}
 });
 expect(result.shot).toEqual({follow:false,alive:true});
});
