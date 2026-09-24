import {test,expect} from '@playwright/test';

test('real pedestrians play the native damage and death reaction for weapon, body part and direction',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();
  const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();
  const crowd=new WorldPedestrians(sim,scene,new URL('/play/world/',location.href).href,()=>undefined);
  try{
   for(let i=0;i<300&&(crowd as any).people.filter((p:any)=>!p.officer).length<3;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const [a,b,c]=(crowd as any).people.filter((p:any)=>!p.officer);
   // Face each ped along +z, standing still, so the shooter's side sets the local direction.
   const place=(p:any,x:number,speed=0)=>{p.actor.player.position={x,y:12.55,z:1680};p.actor.player.heading=0;p.actor.player.speed=speed;p.down=0;};
   place(a,2480);place(b,2485);place(c,2495,6);
   const reaction=(p:any)=>p.view.snapshot().reaction;
   // A pistol round from in front, at chest height on the centre line.
   crowd.damageCollider(a.collider.handle,10,{x:0,z:-1},'bullet',{weapon:22,point:{x:2480,y:13.8,z:1680}});
   // A shotgun from behind kills and throws the victim forward.
   crowd.damageCollider(b.collider.handle,200,{x:0,z:1},'bullet',{weapon:25,point:{x:2485,y:13.8,z:1680}});
   // A running ped hit by a light gun only flinches with the partial shot.
   crowd.damageCollider(c.collider.handle,10,{x:0,z:-1},'bullet',{weapon:22,point:{x:2495,y:13.8,z:1680}});
   return {chest:{reaction:reaction(a),down:a.down,health:a.health},shotgun:{reaction:reaction(b),down:b.down,health:b.health},running:{reaction:reaction(c),down:c.down}};
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.chest).toEqual({reaction:'dam_stomach_frmft',down:0,health:expect.any(Number)});
 expect(result.chest.health).toBeGreaterThan(0);
 expect(result.shotgun).toMatchObject({reaction:'ko_skid_back',down:Infinity,health:0});
 expect(result.running).toMatchObject({reaction:'shot_partial',down:0});
 expect(errors).toEqual([]);
});

test('a spray can hit makes a pedestrian choke (CTaskSimpleChoking, GAS_CWR) instead of flinching',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();
  const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();
  const crowd=new WorldPedestrians(sim,scene,new URL('/play/world/',location.href).href,()=>undefined);
  try{
   for(let i=0;i<300&&(crowd as any).people.filter((p:any)=>!p.officer).length<1;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const [a]=(crowd as any).people.filter((p:any)=>!p.officer);
   a.actor.player.position={x:2480,y:12.55,z:1680};a.actor.player.heading=0;a.actor.player.speed=0;a.down=0;
   crowd.damageCollider(a.collider.handle,1,{x:0,z:-1},'spray',{weapon:41,point:{x:2480,y:14,z:1680}});
   return {reaction:a.view.snapshot().reaction,stagger:a.stagger,health:a.health};
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.reaction).toBe('gas_cwr');expect(result.stagger).toBeGreaterThanOrEqual(1);expect(result.health).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});
