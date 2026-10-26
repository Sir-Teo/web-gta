import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
const reference=JSON.parse(readFileSync(new URL('../fixtures/boat-components-reference.json',import.meta.url),'utf8')) as typeof import('../fixtures/boat-components-reference.json');

test('all native boat models bind and animate their rudders, propellers and scan nodes with vehicle fading',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const rows=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{WorldBoat,PLAYABLE_BOATS},{Simulation},{THREE,RAPIER},{BOAT_COMPONENT_NAMES},{resolveCarColors}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/simulation/WorldBoat.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts','/src/render/nativeBoatComponents.ts','/src/assets/carColors.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const catalog=await openStaticWorldVehicles(await openStaticWorld(new URL('/play/world/',location.href).href)),sim=new Simulation(),scene=new THREE.Scene(),rows:any[]=[],images:Record<string,string>={};const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(900,600);renderer.setClearColor(0x25303b);const camera=new THREE.PerspectiveCamera(45,1.5,.05,100);sim.player.position={x:0,y:2,z:0};
  const parts=(boat:any)=>Object.fromEntries(Object.entries(BOAT_COMPONENT_NAMES).map(([role,name])=>{const node=boat.root.getObjectByName(name),mesh=node?.children.filter((o:any)=>o.isMesh&&o.userData.nativeAtomic!==undefined).at(-1),materials=mesh?(Array.isArray(mesh.material)?mesh.material:[mesh.material]):[];return [role,node?{matrix:[...node.matrix.elements],opacity:materials.map((m:any)=>m.opacity)}:null];}));
  try{
   for(const model of Object.keys(PLAYABLE_BOATS).map(Number)){
    const assets=await catalog.load(model),colors=resolveCarColors(catalog.colors,assets.vehicle.model,0).colors,boat=new WorldBoat(sim,scene,assets,{x:0,y:2,z:0},0,colors);
    try{
     boat.setLighting([1,1,1],1,0);
     if(model===430){scene.updateMatrixWorld(true);const center=boat.root.getObjectByName('static_prop')?.getWorldPosition(new THREE.Vector3())??new THREE.Vector3(0,2,0);camera.position.copy(center).add(new THREE.Vector3(2,-.5,3));camera.lookAt(center);renderer.render(scene,camera);images.idle=renderer.domElement.toDataURL();}
     boat.frozen=true;boat.engineSpeed=.1;boat.steerAngle=.3;boat.beforeStep(.02);boat.update(1);
     const running={state:boat.components.snapshot(),parts:parts(boat)};if(model===430){renderer.render(scene,camera);images.running=renderer.domElement.toDataURL();}
     boat.setClumpAlpha(128);boat.update(1);const faded={state:boat.components.snapshot(),parts:parts(boat)};if(model===430){renderer.render(scene,camera);images.faded=renderer.domElement.toDataURL();}
     boat.setClumpAlpha(255);boat.engineSpeed=0;boat.steerAngle=0;boat.update(1);const idle={state:boat.components.snapshot(),parts:parts(boat)};
     rows.push({model,running,faded,idle});
    }finally{boat.dispose();}
   }
  }finally{sim.dispose();}
  const geometries=renderer.info.memory.geometries;renderer.dispose();return {rows,children:scene.children.length,images,geometries};
 });
 for(const [name,data] of Object.entries(rows.images))writeFileSync(`artifacts/boat-components-${name}.png`,Buffer.from(data.split(',')[1],'base64'));
 expect(rows.images.idle).not.toBe(rows.images.running);expect(rows.images.faded).not.toBe(rows.images.running);expect(rows.geometries).toBe(0);
 writeFileSync('artifacts/boat-components.json',JSON.stringify({rows:rows.rows,children:rows.children,errors},null,2));
 const sample=reference.cases.find(r=>Math.abs(r.engineSpeed-.1)<1e-8&&r.angle===0&&r.timeStep===1)!;
 let rudders=0,props=0,radars=0;
 for(const row of rows.rows){expect(row.running.state.angle).toBe(sample.nextAngle);expect(row.faded.state.angle).toBe(sample.nextAngle);expect(row.idle.state.angle).toBe(sample.nextAngle);
  for(const role of ['rudder','rearLeft','rearRight']){const p=row.running.parts[role];if(!p)continue;rudders++;expect(p.matrix[1]).toBeCloseTo(Math.sin(Math.fround(-.3)),6);expect(p.matrix[10]).toBe(1);expect(row.idle.parts[role].matrix[0]).toBe(1);}
  for(const role of ['staticProp','movingProp','staticProp2','movingProp2']){const p=row.running.parts[role];if(!p)continue;props++;const alpha=role.startsWith('static')?sample.staticAlpha:sample.movingAlpha;for(const opacity of p.opacity)expect(opacity).toBe(alpha/255);for(const opacity of row.faded.parts[role].opacity)expect(opacity).toBe((alpha/255)*(128/255));for(const opacity of row.idle.parts[role].opacity)expect(opacity).toBe(role.startsWith('static')?1:0);}
  if([430,453,454].includes(row.model)&&row.running.parts.moving){radars++;expect(row.running.state.scan).toBe(Math.fround(.02));expect(row.faded.parts.moving.matrix[1]).toBeCloseTo(Math.sin(Math.fround(.02)),6);}
 }
 expect(rows.rows).toHaveLength(10);expect(rudders).toBeGreaterThan(0);expect(props).toBeGreaterThan(0);expect(radars).toBe(1);expect(rows.children).toBe(0);expect(errors).toEqual([]);
});
