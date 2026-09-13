import {test,expect} from '@playwright/test';
import {openAsBlob} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Matrix4,Vector3} from 'three';
import {readImgEntry,readImgIndex} from '../../src/assets/img';
import {readCol} from '../../src/assets/col';
test('candidate projection carries GPU skinning through native filtering onto terrain without edge stretching',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/tests/fixtures/shadow-projection.html');
 const result=await page.evaluate(()=>(window as any).shadowProjectionProbe());
 await writeFile('/tmp/web-gta-projection-chain-flat.json',JSON.stringify(result,null,2));
 expect(result.initial.pixels).toBeGreaterThan(100);expect(result.initial.mass).toBeGreaterThan(1000);
 // Source .4 bone displacement becomes .9*.4 terrain displacement, at 64px/unit.
 expect(Math.abs(result.moved.x-result.initial.x-23.04)).toBeLessThan(1);
 expect(Math.abs(result.moved.y-result.initial.y)).toBeLessThan(1);
 expect(result.hidden.mass).toBe(0);expect(result.outside).toEqual([255,255,255,255]);expect(errors).toEqual([]);
 await page.locator('canvas').screenshot({path:'artifacts/related-shadow-projection.png'});
});
test('candidate filtered silhouette projects onto actual Grove collision geometry',async({page})=>{
 const directory=process.env.GTA_REFERENCE_DIR;test.skip(!directory,'Set GTA_REFERENCE_DIR for local native terrain.');
 const archive=await openAsBlob(join(directory!,'gta3.img')),index=await readImgIndex(archive),entry=index.find(e=>e.name.toLowerCase()==='lae2_4.col');expect(entry).toBeDefined();
 const source=readCol(await readImgEntry(archive,entry!)).find(m=>m.name.toLowerCase()==='lae2_roads89')!.mesh;
 const transform=new Matrix4().makeRotationX(-Math.PI/2);let area=0,center=new Vector3();
 for(let i=0;i<source.indices.length;i+=3){const [a,b,c]=[0,1,2].map(j=>new Vector3().fromArray(source.positions,source.indices[i+j]*3).applyMatrix4(transform));const normal=b.clone().sub(a).cross(c.clone().sub(a));if(Math.abs(normal.y)>area){area=Math.abs(normal.y);center=a.add(b).add(c).multiplyScalar(1/3);}}
 expect(area).toBeGreaterThan(0);
 const positions:number[]=[];for(let i=0;i<source.positions.length;i+=3)positions.push(...new Vector3().fromArray(source.positions,i).applyMatrix4(transform).sub(center).toArray());
 // Ground the diagnostic at the uppermost actual surface under its feet; the
 // largest triangle alone can sit below other triangles in the same COL model.
 let support=-Infinity;
 for(let i=0;i<source.indices.length;i+=3){
  const [a,b,c]=[0,1,2].map(j=>new Vector3().fromArray(positions,source.indices[i+j]*3));
  const determinant=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(determinant)<1e-10)continue;
  const u=((b.z-c.z)*-c.x+(c.x-b.x)*-c.z)/determinant,v=((c.z-a.z)*-c.x+(a.x-c.x)*-c.z)/determinant,w=1-u-v;
  if(Math.min(u,v,w)>=-1e-8)support=Math.max(support,u*a.y+v*b.y+w*c.y);
 }
 expect(Number.isFinite(support)).toBe(true);for(let i=1;i<positions.length;i+=3)positions[i]-=support;
 await page.goto('/tests/fixtures/shadow-projection.html');
 const result=await page.evaluate(input=>(window as any).shadowProjectionProbe(input),{positions,indices:[...source.indices],lights:[...source.lights]});
 await writeFile('/tmp/web-gta-projection-chain-native.json',JSON.stringify({...result,center:center.toArray(),area,support},null,2));
 expect(result.vertices).toBeGreaterThan(0);expect(result.initial.mass).toBeGreaterThan(1000);
 expect(Math.abs(result.initial.x-127.5)).toBeLessThan(1);expect(result.initial.y).toBeGreaterThan(100);expect(result.initial.y).toBeLessThan(125);
 expect(Math.abs(result.moved.x-result.initial.x-23.04)).toBeLessThan(1);
 expect(result.moved.mass/result.initial.mass).toBeGreaterThan(.95);expect(result.moved.mass/result.initial.mass).toBeLessThan(1.05);
 expect(result.hidden.mass).toBe(0);expect(result.outside).toEqual([255,255,255,255]);
 await page.locator('canvas').screenshot({path:'artifacts/related-shadow-native-terrain.png'});
});
