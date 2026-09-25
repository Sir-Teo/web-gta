import {test,expect} from '@playwright/test';

test('a moored runabout boards, drives and leaves in the shallows',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldFleet},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldFleet.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  const fleet=new WorldFleet(sim,scene,{records:new Map(),rows:[],audio:{byId:new Map(),warnings:[]}} as never,undefined,base);
  fleet.waterLevel=()=>0;
  try{
   let boat:[...typeof fleet.boats][number]|undefined;
   // A Predator's generator 30 units north on the water: CCarGenerator::DoInternalProcessing moors it at the record's height.
   fleet.setGenerators([{id:'test:boat',source:'test.ipl',sourceIndex:0,position:[0,30,0],angle:0,modelId:430,primaryColor:-1,secondaryColor:-1,flags:0,alarmChance:0,doorLockChance:0,minDelay:0,maxDelay:0}]);
   fleet.generateEvenIfClose();
   for(let i=0;i<300&&!boat;i++){fleet.update(i*2100);await new Promise(r=>setTimeout(r,20));boat=[...fleet.boats][0];}
   if(!boat)throw new Error(JSON.stringify(fleet.snapshot().failures));
   for(let i=0;i<120;i++){boat.beforeStep(1/60);sim.world.step();boat.afterStep();}
   if(!boat.snapshot().inWater)throw new Error(JSON.stringify(boat.snapshot()));
   sim.player.position={...boat.body.translation(),x:boat.body.translation().x+2};
   const boarded=boat.interact();
   const start={...boat.body.translation()};
   for(let i=0;i<240;i++){boat.beforeStep(1/60,{throttle:1,steer:0,brake:false});sim.world.step();boat.afterStep();}
   const run={...boat.body.translation()},travelled=Math.hypot(run.x-start.x,run.z-start.z);
   // D turns right. The hull's forward is (0,0,-1) turned by its rotation; its right is (1,0,0) turned. Turning right swings
   // the forward toward the old right.
   const axes=()=>{const q=boat.body.rotation(),x=q.x,y=q.y,z=q.z,w=q.w;return {fwd:{x:-(2*(x*z+w*y)),z:-(1-2*(x*x+y*y))},right:{x:1-2*(y*y+z*z),z:2*(x*z-w*y)}};};
   const before=axes();
   for(let i=0;i<90;i++){boat.beforeStep(1/60,{throttle:1,steer:1,brake:false});sim.world.step();boat.afterStep();}
   const after=axes(),turnedRight=after.fwd.x*before.right.x+after.fwd.z*before.right.z;
   // S reverses at 0.3 of the pedal, eased in, so a second of it only slows the boat.
   const pedalsAfterSecond=(()=>{for(let i=0;i<60;i++){boat.beforeStep(1/60,{throttle:-1,steer:0,brake:false});sim.world.step();boat.afterStep();}return {gas:boat.gasPedal,brake:boat.brakePedal};})();
   // Moor beside a small exit platform on the hull's +x side and step ashore.
   boat.body.setLinvel({x:0,y:0,z:0},true);boat.body.setAngvel({x:0,y:0,z:0},true);
   {
    const b=boat as unknown as {assets:{collision:{bounds:{max:number[]}}}};
    const p=boat.body.translation(),q=boat.body.rotation();
    const qx=q.x,qy=q.y,qz=q.z,qw=q.w;
    const rx=1-2*(qy*qy+qz*qz),rz=2*(qx*qz-qw*qy);
    const out={x:p.x+rx*(b.assets.collision.bounds.max[0]+1.5),z:p.z+rz*(b.assets.collision.bounds.max[0]+1.5)};
    sim.world.createCollider(RAPIER.ColliderDesc.cuboid(1,.5,1).setTranslation(out.x,-.2,out.z));
   }
   for(let i=0;i<60;i++){boat.beforeStep(1/60);sim.world.step();boat.afterStep();}
   const left=boat.interact();
   return {boarded,travelled,turnedRight,pedalsAfterSecond,wake:boat.snapshot().wake,left,occupied:boat.occupied,collider:sim.playerCollider.isEnabled(),fleet:fleet.snapshot().boats.length};
  }finally{fleet.dispose();if(scene.children.length)throw new Error('Boat views leaked');sim.dispose();}
 });
 expect(result.boarded).toMatch(/W\/S throttle/);
 expect(result.travelled).toBeGreaterThan(2);
 expect(result.turnedRight).toBeGreaterThan(.05);
 expect(result.pedalsAfterSecond.gas).toBeCloseTo(-.3*result.pedalsAfterSecond.brake,5);expect(result.pedalsAfterSecond.gas).toBeGreaterThanOrEqual(-.3);
 expect(result.wake).toBeGreaterThan(0);
 expect(result.left).toBe('On foot');
 expect(result.occupied).toBe(false);expect(result.collider).toBe(true);expect(result.fleet).toBe(1);
 expect(errors).toEqual([]);
});
