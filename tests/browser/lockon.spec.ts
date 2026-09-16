import {test,expect} from '@playwright/test';

test('aiming locks the centered target and bends shots onto it',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WeaponSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/weapons/WeaponSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined),weapons=new WeaponSystem(sim,()=>crowd,()=>undefined);
  try{
   for(let i=0;i<300&&!crowd.snapshot().people.length;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const tick=()=>{weapons.tick(1/60);crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();};
   for(let i=0;i<30;i++)tick();
   const target=crowd.targets()[0];if(!target)throw new Error('No civilian');
   const chest={...target.position};
   // Stand south of the mark and aim a metre to its side: free aim would miss.
   sim.player.position={x:chest.x,y:chest.y-1.3,z:chest.z+6};sim.playerBody.setTranslation({...sim.player.position,y:chest.y-.4,z:chest.z+6},true);sim.world.step();
   weapons.inventory.select(22);weapons.aiming=true;
   const off={x:chest.x+1.2,y:chest.y,z:chest.z};
   const aim={origin:{...sim.player.position,y:chest.y},direction:{x:off.x-sim.player.position.x,y:0,z:off.z-sim.player.position.z}};
   const len=Math.hypot(aim.direction.x,aim.direction.z);aim.direction.x/=len;aim.direction.z/=len;
   for(let i=0;i<20;i++){weapons.tick(1/60,aim);crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();}
   const locked=weapons.lock?.handle??null;
   const before=crowd.snapshot().people.find((p:any)=>p.id===0);
   for(let i=0;i<3;i++){weapons.tick(1/60,aim);weapons.fire(aim);crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();}
   const after=crowd.snapshot().people.find((p:any)=>p.id===0);
   return {locked,expected:target.handle,before:before?.health,after:after?.health,aiming:weapons.aiming};
  }finally{weapons.dispose();crowd.dispose();sim.dispose();}
 });
 expect(result.aiming).toBe(true);
 expect(result.locked).toBe(result.expected);
 expect(result.after).toBeLessThan(result.before ?? 100);
});

test('Q/E cycling steps through ranked targets',async({page})=>{
 test.setTimeout(60000);await page.goto('/models.html');const order=await page.evaluate(async()=>{
  const [{WeaponSystem},{Simulation},{RAPIER}]=await Promise.all(['/src/weapons/WeaponSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(0,-1,0));
  sim.respawn={x:0,y:0,z:0};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const near={handle:11,position:{x:0,y:1.3,z:-10}},far={handle:22,position:{x:2,y:1.3,z:-14}};
  const damaged:string[]=[];
  const pedestrians=()=>({damageCollider:(handle:number)=>{damaged.push(`hit:${handle}`);return false;},targets:()=>[near,far],frighten:()=>{}});
  const weapons=new WeaponSystem(sim,pedestrians as any,()=>undefined);
  try{
   weapons.inventory.select(22);weapons.aiming=true;
   const camera={origin:{x:0,y:1.3,z:0},direction:{x:0,y:0,z:-1}};
   for(let i=0;i<20;i++)weapons.tick(1/60,camera);
   const first=weapons.lock?.handle;
   weapons.cycleLock(false);
   const second=weapons.lock?.handle;
   weapons.cycleLock(false);
   const third=weapons.lock?.handle;
   return {first,second,third};
  }finally{weapons.dispose();sim.dispose();}
 });
 // Centered-near first, then the runner-up, then wraps around.
 expect(order).toEqual({first:11,second:22,third:11});
});
