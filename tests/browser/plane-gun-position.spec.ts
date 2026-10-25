import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

test('original armed aircraft use their gun dummy or captured hard point with frame velocity lead',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const results=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{WorldPlane},{Simulation},{WeaponSystem},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/simulation/WorldPlane.ts','/src/simulation/Simulation.ts','/src/weapons/WeaponSystem.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const catalog=await openStaticWorldVehicles(await openStaticWorld(new URL('/play/world/',location.href).href)),capture=await(await fetch('/docs/research/plane-gun-positions-capture.json')).json(),out:any[]=[],sim=new Simulation(),scene=new THREE.Scene();
  try{
   for(const model of [425,447,464,476,520]){
    const assets=await catalog.load(model),position={x:20,y:50,z:70},plane=new WorldPlane(sim,scene,assets,position,.6),weapons=new WeaponSystem(sim,()=>undefined,()=>({cars:[],planes:[plane]}) as any);plane.occupied=true;
    const calls:any[]=[];weapons.fx={ready:true,gunshot:(...args:any[])=>calls.push(args),bulletHit(){},areaEffect(){},explosion(){}} as any;
    try{
     // Evaluate the source dummy independently through the original model hierarchy with Three's transform routine.
     let expectedDummy:any;const index=assets.model.frames.findIndex((f:any)=>f.name.toLowerCase()==='miscpos_a');
     if(index>=0){const frame=assets.model.frames[index],p=new THREE.Vector3(frame.matrix[12],frame.matrix[13],frame.matrix[14]);let at=frame.parent;while(at>=0&&assets.model.frames[at].parent>=0){p.applyMatrix4(new THREE.Matrix4().fromArray(assets.model.frames[at].matrix));at=assets.model.frames[at].parent;}expectedDummy=[p.x,p.y,p.z];}
     const expectedLocal=expectedDummy?.some((v:number)=>v!==0)?expectedDummy:capture.records.find((r:any)=>r.model===model).offset,velocity={x:6,y:3,z:-9};weapons.tick(1);plane.body.setLinvel(velocity,true);weapons.tick(.02);
     const fired=weapons.fireAircraft(plane),from=calls[0]?.[0],rotation=plane.body.rotation(),expected=new THREE.Vector3(expectedLocal[0],expectedLocal[2],-expectedLocal[1]).applyQuaternion(new THREE.Quaternion(rotation.x,rotation.y,rotation.z,rotation.w)).add(new THREE.Vector3(position.x,position.y,position.z)).addScaledVector(new THREE.Vector3(velocity.x,velocity.y,velocity.z),.02);
     out.push({model,fired,from,expected,local:plane.gunPosition(model===476?1:0),expectedLocal,dummy:plane.gunDummy??null,expectedDummy:expectedDummy??null});
    }finally{weapons.dispose();plane.dispose();}
   }
  }finally{sim.dispose();}
  return out;
 });
 writeFileSync('artifacts/plane-gun-position.json',JSON.stringify({results,errors},null,2));
 expect(results).toHaveLength(5);for(const r of results){expect(r.fired).toBe(true);for(const axis of ['x','y','z'])expect(r.from[axis]).toBeCloseTo(r.expected[axis],4);for(let i=0;i<3;i++){expect(r.local[i]).toBeCloseTo(r.expectedLocal[i],5);if(r.expectedDummy)expect(r.dummy[i]).toBeCloseTo(r.expectedDummy[i],5);}}
 expect(errors).toEqual([]);
});
