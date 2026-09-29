import {test,expect} from '@playwright/test';

test('CJ boards a boat only standing on it or touching its hull, not from a dock beside it',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{WorldBoat},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/simulation/WorldBoat.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href,catalog=await openStaticWorldVehicles(await openStaticWorld(base));
  const sim=new Simulation(),scene=new THREE.Scene(),boat=new WorldBoat(sim,scene,await catalog.load(473),{x:0,y:0,z:0});
  try{
   boat.body.setEnabled(true);sim.world.step();
   const put=(x:number,y:number,z:number)=>{sim.player.position={x,y,z};sim.playerBody.setTranslation({x,y:y+.9,z},true);sim.playerCollider.setTranslation({x,y:y+.9,z});sim.world.step();};
   // A dock 3.5 units off the hull's side, CJ on it.
   const b=boat.assets.collision.bounds,side=b.max[0]+3.5;
   sim.world.createCollider(RAPIER.ColliderDesc.cuboid(1.5,.25,6).setTranslation(side,-.25,0));
   put(side,0,0);const dock=boat.enterCheck();
   // On the deck: the ray under his feet meets the boat.
   const c=boat.body.translation(),hit=sim.world.castRay(new RAPIER.Ray({x:c.x,y:c.y+10,z:c.z},{x:0,y:-1,z:0}),20,true,undefined,undefined,sim.playerCollider,sim.playerBody);
   if(!hit||hit.collider.parent()?.handle!==boat.body.handle)throw new Error('no deck');
   put(c.x,c.y+10-hit.timeOfImpact+.02,c.z);const deck=boat.enterCheck();
   return {dock,deck};
  }finally{boat.dispose?.();sim.dispose();}
 });
 expect(result.dock).toMatch(/Get onto/);
 expect(result.deck).toBe('');
});
