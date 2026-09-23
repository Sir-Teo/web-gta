import {test,expect} from '@playwright/test';

test('a street ped turns his head toward CJ through the look-at chain and blends back',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{startLookAt},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/src/simulation/nativeIkLookAt.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  // Plain civilians; spawns need the off-screen guard, so the crowd is on screen only once someone exists.
  crowd.pedTargets=()=>({dealers:0,gangs:0,cops:0,other:6,gangStrengths:Array(10).fill(0)});
  try{
   for(let i=0;i<300&&!crowd.snapshot().people.length;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const p=crowd.people.find((p:any)=>!p.officer&&p.health>0);if(!p)throw new Error('no ped');
   crowd.canSpawn=()=>false;
   // Stand the ped 4 units to the side of CJ with a fixed heading (the body must not turn), and give him a look task.
   const at={x:sim.player.position.x-4,y:sim.player.position.y,z:sim.player.position.z};
   p.actor.player.position={...at};p.body.setTranslation({x:at.x,y:at.y+.9,z:at.z},true);p.loiter=true;
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();p.actor.player.heading=0;p.view.update(p.actor,1);};
   for(let i=0;i<10;i++)tick();
   // Bones draw from their matrix (matrixAutoUpdate is off), so the turn is measured there.
   const head=p.view.bone(5),rot=()=>new THREE.Quaternion().setFromRotationMatrix(head.matrix),rest=rot();
   const toPlayer=()=>{const h=head.getWorldPosition(new THREE.Vector3());return new THREE.Vector3(sim.player.position.x-h.x,sim.player.position.y+.9-h.y,sim.player.position.z-h.z).normalize();};
   const before={dot:p.view.headForward().dot(toPlayer()),angle:0};
   p.look=startLookAt(crowd.clock*1000,4000);
   const trace:number[]=[];
   for(let i=0;i<90;i++){tick();if(i%15===14)trace.push(+(rot().angleTo(rest)*180/Math.PI).toFixed(1));}
   const during={dot:p.view.headForward().dot(toPlayer()),angle:rot().angleTo(rest)*180/Math.PI,blend:p.view.headLookBlend,snapshot:crowd.snapshot().people.find((q:any)=>q.id===p.id).look};
   // Off screen again so no fresh glance starts while this one blends out (the roll needs an on-screen ped).
   crowd.canSpawn=()=>true;
   for(let i=0;i<300;i++)tick();
   const after={dot:p.view.headForward().dot(toPlayer()),angle:rot().angleTo(rest)*180/Math.PI,blend:p.view.headLookBlend,look:p.look??null,written:!!p.view.headWritten};
   return {before,trace,during,after};
  }finally{crowd.dispose();sim.dispose();}
 });
 // The head turns toward CJ at the side while the task blends in (tens of degrees off its animated pose), then
 // releases to the animated pose when the task ends: the idle clip moves the head too, so the release is checked
 // as the chain writing nothing and the head no longer facing CJ.
 expect(result.during.dot).toBeGreaterThan(result.before.dot+0.2);
 expect(result.during.angle).toBeGreaterThan(20);
 expect(result.during.blend).toBeGreaterThan(0.9);
 expect(result.during.snapshot).toBeGreaterThan(0.9);
 expect(result.after.look).toBeNull();
 expect(result.after.blend).toBe(0);
 expect(result.after.written).toBe(false);
 expect(result.after.dot).toBeLessThan(result.during.dot-0.5);
});
