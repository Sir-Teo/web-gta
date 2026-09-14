import {readFileSync,openAsBlob} from 'node:fs';
import {createHash} from 'node:crypto';
import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {readCol} from '../src/assets/col';
import {readImgIndex,readImgEntry} from '../src/assets/img';
import {readIpl} from '../src/assets/ipl';
import {installNativeCollision} from '../src/simulation/nativeCollision';
import {nativeCollisionSurface} from '../src/simulation/nativeWheelSurface';
import {nativeContactBrightness} from '../src/simulation/nativeContactLighting';
const root=process.env.GTA_CONTENT_DIR;
beforeAll(async()=>{if(root)await RAPIER.init();});
test.skipIf(!root)('recovered gym boxes hit their native positions and use the third surface byte for lighting',async()=>{
 const file=await openAsBlob(root+'/gta3.img');
 const entry=(await readImgIndex(file)).find(e=>e.name==='law_stream4.ipl')!;
 const instances=readIpl(await readImgEntry(file,entry)).instances;
 const lock=JSON.parse(readFileSync('scripts/content/santa-maria-sources.json','utf8'));
 const expected=[
  {id:2629,name:'gym_bench1',index:8,position:[653.9296875,-1864.0859375,4.4453125],boxes:2},
  {id:2630,name:'gym_bike',index:11,position:[659.2734375,-1864.203125,4.4453125],boxes:1},
  {id:2631,name:'gym_mat1',index:7,position:[654.3515625,-1869.5703125,4.5],boxes:1},
  {id:2632,name:'gym_mat02',index:13,position:[659.9921875,-1869.6328125,4.5],boxes:1},
 ];
 for(const item of expected){
  const bytes=readFileSync(`${root}/supplemental/${item.id}.col`);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(lock.items.find((f:{name:string})=>f.name===`${item.id}.col`).sha256);
  const [model]=readCol(bytes),placement=instances[item.index];
  expect(model.name).toBe(item.name);expect(model.boxes).toHaveLength(item.boxes);
  expect(model.spheres).toHaveLength(0);expect(model.mesh.indices).toHaveLength(0);
  expect(placement.modelId).toBe(item.id);expect(placement.position).toEqual(item.position);
  const world=new RAPIER.World({x:0,y:0,z:0});
  try{
   const installed=installNativeCollision(world,model,placement);world.step();
   for(const [index,box] of model.boxes.entries()){
    expect(box.surface).toEqual({material:0,flags:0,brightness:0xBB,light:0});
    // These source quaternions are identity within 2e-7. Independently map
    // native Z-up coordinates to browser Y-up, allowing float32 physics error.
    const x=item.position[0]+(box.min[0]+box.max[0])/2;
    const z=-item.position[1]-(box.min[1]+box.max[1])/2;
    const top=item.position[2]+box.max[2];
    const hit=world.castRayAndGetNormal(new RAPIER.Ray({x,y:top+.2,z},{x:0,y:-1,z:0}),1,true)!;
    expect(hit).not.toBeNull();expect(hit.timeOfImpact).toBeCloseTo(.2,4);expect(hit.normal.y).toBeCloseTo(1,4);
    const source=installed.sources.get(hit.collider.handle)!;
    expect(source).toMatchObject({kind:'box',index});
    const contact=nativeCollisionSurface(source,hit)!;
    expect(contact).toEqual({material:0,light:0xBB});
    expect(nativeContactBrightness(contact.light,0)).toBeCloseTo(11/30,7);
    expect(nativeContactBrightness(contact.light,1)).toBeCloseTo(11/30,7);
   }
   installed.dispose();expect(world.colliders.len()).toBe(0);expect(world.bodies.len()).toBe(0);
  }finally{world.free();}
 }
});
