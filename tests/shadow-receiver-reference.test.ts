import {openAsBlob} from 'node:fs';
import {join} from 'node:path';
import {expect,test} from 'vitest';
import {Matrix4,Vector3} from 'three';
import {readImgEntry,readImgIndex} from '../src/assets/img';
import {readCol} from '../src/assets/col';
import {projectShadowReceiver} from '../src/render/projectShadowReceiver';

test.skipIf(!process.env.GTA_REFERENCE_DIR)('projects a bounded receiver onto actual Grove Street collision triangles',async()=>{
 const archive=await openAsBlob(join(process.env.GTA_REFERENCE_DIR!,'gta3.img'));
 const index=await readImgIndex(archive),entry=index.find(e=>e.name.toLowerCase()==='lae2_4.col');expect(entry).toBeDefined();
 const source=readCol(await readImgEntry(archive,entry!)).find(m=>m.name.toLowerCase()==='lae2_landhub04');expect(source).toBeDefined();
 const mesh=source!.mesh,transform=new Matrix4().makeRotationX(-Math.PI/2);
 // Choose the largest upward-facing source triangle, keeping this check independent of IPL layout.
 let area=0,center=new Vector3();
 for(let i=0;i<mesh.indices.length;i+=3){
  const [a,b,c]=[0,1,2].map(j=>new Vector3().fromArray(mesh.positions,mesh.indices[i+j]*3).applyMatrix4(transform));
  const normal=b.clone().sub(a).cross(c.clone().sub(a));
  if(normal.y>area){area=normal.y;center=a.add(b).add(c).multiplyScalar(1/3);}
 }
 expect(area).toBeGreaterThan(0);center.y+=.1;
 const result=projectShadowReceiver(mesh,transform,{center,side:{x:.5,z:0},front:{x:0,z:.5},depth:1});
 expect(result.positions.length).toBeGreaterThan(0);
 for(let i=0;i<result.faces.length;i++){
  expect(result.lights[i]).toBe(mesh.lights[result.faces[i]]);
  expect(Math.abs(result.positions[i*3]-center.x)).toBeLessThanOrEqual(.5001);
  expect(Math.abs(result.positions[i*3+2]-center.z)).toBeLessThanOrEqual(.5001);
  expect(result.positions[i*3+1]).toBeLessThanOrEqual(center.y+.0001);
  expect(result.positions[i*3+1]).toBeGreaterThanOrEqual(center.y-1.0001);
 }
});
