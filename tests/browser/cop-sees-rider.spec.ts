import {test,expect} from '@playwright/test';

test('a foot cop sees and shoots CJ on the bike he rides, and a wall still hides him',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1670};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const law=new WantedSystem(),crowd=new WorldPedestrians(sim,scene,base,()=>undefined,law) as any;
  crowd.pedTargets=()=>({dealers:0,gangs:0,cops:0,other:1,gangStrengths:Array(10).fill(0)});
  try{
   for(let i=0;i<300&&crowd.snapshot().people.length<1;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   await crowd.spawnOfficer('lapd1',22,{x:2490,y:12.55,z:1680},Math.PI);
   const cop=crowd.people.find((p:any)=>p.officer);if(!cop)throw new Error('no cop');
   // CJ on a bike: his collider is off and he sits on the bike's body.
   const bike=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(2490,12.95,1670));sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.3,.4,1),bike);
   sim.playerCollider.setEnabled(false);sim.world.step();
   const target=sim.player.position,see=()=>crowd.spotTarget(cop,target,[]).visible;
   const unhooked=see();crowd.playerRide=()=>({body:bike,bike:true});const riding=see();
   const wall=sim.world.createCollider(RAPIER.ColliderDesc.cuboid(3,3,.2).setTranslation(2490,14,1675));sim.world.step();
   const walled=see();sim.world.removeCollider(wall,false);sim.world.step();
   // CWorld::bIncludeBikers: the cop's rounds strike CJ on the bike though his collider is off.
   cop.gunAccuracy=100;const before=sim.player.health,spot=crowd.spotTarget(cop,target,[]);
   for(let i=0;i<120&&sim.player.health===before;i++)crowd.stepPedGun(cop,cop.weapon,spot.eye,spot.aim,spot.offset,[],1/30,true);
   const shot=before-sim.player.health;crowd.playerRide=()=>({body:bike,bike:true,canBeShot:false});const protectedHealth=sim.player.health;
   for(let i=0;i<120;i++)crowd.stepPedGun(cop,cop.weapon,spot.eye,spot.aim,spot.offset,[],1/30,true);
   return {unhooked,riding,walled,shot,protected:sim.player.health===protectedHealth};
  }finally{crowd.dispose?.();sim.dispose();}
 });
 expect(result.unhooked).toBe(false);
 expect(result.riding).toBe(true);
 expect(result.walled).toBe(false);
expect(result.shot).toBeGreaterThan(0);
expect(result.protected).toBe(true);
});
