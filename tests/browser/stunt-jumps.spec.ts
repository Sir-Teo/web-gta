import {test,expect} from '@playwright/test';
test('a native unique stunt jump starts in the air over its ramp and pays out on the landing box',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const paths=['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldCar.ts','/src/assets/worldRoadMaterials.ts','/src/simulation/WorldCar.ts','/src/simulation/Simulation.ts','/src/simulation/nativeScene.ts','/src/simulation/StuntJumps.ts','/src/assets/scmStuntJumps.ts','/tests/fixtures/native-render-dependencies.ts'];
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldCar},{loadWorldRoadMaterials},{WorldCar},{Simulation},{installNativeScene},{StuntJumps},{readInitialStuntJumps},{THREE,RAPIER}]=await Promise.all(paths.map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href,source=await openStaticWorld(base);
  const jumps=readInitialStuntJumps(new Uint8Array(await (await fetch(`${base}files/scripts/main.scm`)).arrayBuffer()));
  const catalog=await openStaticWorldVehicles(source),road=await loadWorldRoadMaterials(base);
  const worker=new Worker('/src/assets/staticWorld.worker.ts',{type:'module'});
  const receive=()=>new Promise<any>((resolve,reject)=>{worker.onmessage=({data})=>data.type==='error'?reject(new Error(data.message)):resolve(data);});
  let pending=receive();worker.postMessage({action:'initialize',base});await pending;
  const jump=jumps[1],centre=[0,1,2].map(i=>(jump.start.min[i]+jump.start.max[i])/2),landing=[0,1,2].map(i=>(jump.end.min[i]+jump.end.max[i])/2);
  const dir=[landing[0]-centre[0],landing[1]-centre[1]],span=Math.hypot(dir[0],dir[1]);dir[0]/=span;dir[1]/=span;
  const sim=new Simulation(),scene=new THREE.Scene();
  pending=receive();worker.postMessage({action:'region',id:31,region:{x:(centre[0]+landing[0])/2,y:(centre[1]+landing[1])/2,radius:200,includeCollisionBounds:true}});const data=await pending;
  const terrain=installNativeScene(sim.world,scene,data.parts,{datasetIdentity:data.datasetIdentity});sim.world.step();
  const car=new WorldCar(sim,scene,await loadFixedWorldCar(catalog,{modelId:541,primaryColor:-1,secondaryColor:-1}),{x:centre[0],y:centre[2]+1,z:-centre[1]},road,Math.atan2(-dir[0],dir[1]));
  sim.player.position={x:centre[0]+2,y:centre[2]+1,z:-centre[1]};car.interact();
  try{
   const paid:{reward:number;all:boolean}[]=[],camera:number[][]=[];let restored=0;
   const manager=new StuntJumps(jumps,{onStart:(j:typeof jump)=>camera.push(j.camera),onEnd:()=>restored++,onReward:(_j:typeof jump,reward:number,all:boolean)=>paid.push({reward,all})});
   // The ramp's arc: 40 m/s toward the landing box, launched from the start box.
   const flight=span/40;
   car.car.body.setLinvel({x:dir[0]*40,y:(landing[2]-centre[2]-1+.5*9.81*flight*flight)/flight,z:-dir[1]*40},true);
   const scales=new Set<number>(),states:string[]=[];
   for(let i=0;i<60*12;i++){
    car.beforeStep(1/60,{x:0,y:0},false,terrain.sources);sim.world.step();car.afterStep(1/60);
    const p=car.car.body.translation(),v=car.car.body.linvel();
    manager.update(1000/60,{driving:true,position:{x:p.x,y:-p.z,z:p.y},moveSpeed:{x:v.x/50,y:-v.z/50,z:v.y/50},collided:car.entitiesCollided,lost:car.wrecked});
    scales.add(manager.timeScale);if(states.at(-1)!==manager.state)states.push(manager.state);
    if(paid.length)break;
   }
   return {jumps:jumps.length,found:[...manager.found],done:[...manager.done],paid,camera,restored,states,scales:[...scales].sort()};
  }finally{car.dispose();terrain.dispose();sim.dispose();worker.terminate();}
 });
 console.log(JSON.stringify(result));
 expect(result.jumps).toBe(70);
 expect(result.found).toEqual(result.done);expect(result.done).toHaveLength(1);
 // 500 for one jump, the fixed camera taken and restored once, and time at 0.3 for the whole flight.
 expect(result.paid).toEqual([{reward:500,all:false}]);expect(result.camera).toHaveLength(1);expect(result.restored).toBe(1);
 // The car is already inside the start box on the first frame, so the jump begins at once.
 expect(result.states).toEqual(['flight','landed','waiting']);expect(result.scales).toEqual([.3,1]);
 expect(errors).toEqual([]);
});
