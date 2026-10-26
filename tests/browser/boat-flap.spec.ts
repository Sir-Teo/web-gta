import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
const reference=JSON.parse(readFileSync(new URL('../fixtures/boat-flap-reference.json',import.meta.url),'utf8')) as typeof import('../fixtures/boat-flap-reference.json');

test('the actual Marquis boom follows its native Z hinge and boat-specific limit rebounds',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{WorldBoat},{Simulation},{THREE,RAPIER},{resolveCarColors}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/simulation/WorldBoat.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts','/src/assets/carColors.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const catalog=await openStaticWorldVehicles(await openStaticWorld(new URL('/play/world/',location.href).href)),assets=await catalog.load(484),sim=new Simulation(),scene=new THREE.Scene(),renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(900,650);renderer.setClearColor(0x25303b);const camera=new THREE.PerspectiveCamera(42,900/650,.05,100),rows:any[]=[],images:Record<string,string>={};
  try{
   for(const [speed,heading] of [[.5,0],[50,0],[-50,0],[50,Math.PI/2],[50,-Math.PI/2]]){
    const boat=new WorldBoat(sim,scene,assets,{x:0,y:2,z:0},heading,resolveCarColors(catalog.colors,assets.vehicle.model,0).colors);boat.setLighting([1,1,1],1,0);
    try{
     const frame=boat.root.getObjectByName('boat_flap_left');if(!frame)throw new Error('Marquis flap frame missing');
     const original=[...frame.matrix.elements],bounds=new THREE.Box3().setFromObject(boat.root),center=bounds.getCenter(new THREE.Vector3());const radius=bounds.getBoundingSphere(new THREE.Sphere()).radius;camera.position.copy(center).add(new THREE.Vector3(1,.4,1.5).normalize().multiplyScalar(radius/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))*1.1));camera.lookAt(center);renderer.render(scene,camera);images.idle=renderer.domElement.toDataURL();
     const velocity=new THREE.Vector3(speed,0,0).applyQuaternion(boat.root.quaternion);boat.body.setLinvel(velocity,true);boat.body.setAngvel({x:0,y:0,z:0},true);boat.update(1);
     const first={...boat.components.snapshot().flap},matrix=[...frame.matrix.elements];renderer.render(scene,camera);images[`${speed}${heading?`-heading-${heading}`:''}`]=renderer.domElement.toDataURL();
     boat.update(1);const second={...boat.components.snapshot().flap};boat.root.visible=false;boat.body.setLinvel({x:-speed,y:0,z:0},true);boat.update(1);const hidden={...boat.components.snapshot().flap};
     rows.push({speed,heading,original,matrix,first,second,hidden});
    }finally{boat.dispose();}
   }
  }finally{sim.dispose();}
  renderer.render(scene,camera);const geometries=renderer.info.memory.geometries;renderer.dispose();return {rows,images,children:scene.children.length,geometries};
 });
 for(const [name,data] of Object.entries(result.images))writeFileSync(`artifacts/boat-flap-${name}.png`,Buffer.from(data.split(',')[1],'base64'));
 writeFileSync('artifacts/boat-flap.json',JSON.stringify({rows:result.rows,children:result.children,geometries:result.geometries,errors},null,2));
 for(const row of result.rows){
  const native=reference.cases.find(r=>r.torque===Math.fround(-row.speed/50)&&r.angle===0&&r.angVel===0)!;expect(native).toBeTruthy();
  expect(row.first).toEqual({angle:native.nextAngle,angVel:native.nextAngVel,state:native.state});expect(row.matrix.slice(12,15)).toEqual(row.original.slice(12,15));expect(row.matrix[1]).toBe(Math.fround(Math.sin(native.nextAngle)));expect(row.matrix[10]).toBe(1);
  expect(row.second.angVel).toBe(Math.fround(row.first.angVel*Math.fround(.98)));expect(row.hidden).toEqual(row.second);
 }
 expect(result.images['50']).not.toBe(result.images['-50']);expect(result.children).toBe(0);expect(result.geometries).toBe(0);expect(errors).toEqual([]);
});
