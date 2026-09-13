import {expect,test} from 'vitest';
import {Matrix4} from 'three';
import {projectShadowReceiver,type ShadowFootprint} from '../src/render/projectShadowReceiver';
import type {ColMesh} from '../src/assets/col';
const footprint:ShadowFootprint={center:{x:0,y:2,z:0},side:{x:1,z:0},front:{x:0,z:1},depth:4};
const mesh=(positions:number[],indices=[0,2,1],lights=[0x35]):ColMesh=>({positions:new Float32Array(positions),indices:new Uint32Array(indices),lights:new Uint8Array(lights),materials:new Uint8Array(lights.length)});
const area=(positions:Float32Array)=>{
 let area=0;for(let i=0;i<positions.length;i+=9)area+=Math.abs((positions[i+3]-positions[i])*(positions[i+8]-positions[i+2])-(positions[i+6]-positions[i])*(positions[i+5]-positions[i+2]))/2;return area;
};
test('clips an oversized receiver to the complete footprint without stretching UVs',()=>{
 const result=projectShadowReceiver(mesh([-10,0,-10,10,0,-10,0,0,20]),new Matrix4(),footprint);
 expect(area(result.positions)).toBeCloseTo(4,6);
 for(let i=0;i<result.positions.length/3;i++){
  expect(result.uvs[i*2]).toBeCloseTo((result.positions[i*3]+1)/2,6);
  expect(result.uvs[i*2+1]).toBeCloseTo((result.positions[i*3+2]+1)/2,6);
  expect(result.lights[i]).toBe(0x35);expect(result.faces[i]).toBe(0);
 }
});
test('clips slope intersections at both vertical depth bounds and preserves the surface plane',()=>{
 const result=projectShadowReceiver(mesh([-10,-10,-10,10,10,-10,0,0,20]),new Matrix4(),{...footprint,center:{x:0,y:.5,z:0},depth:1});
 expect(area(result.positions)).toBeCloseTo(2,6);
 for(let i=0;i<result.positions.length;i+=3){expect(result.positions[i+1]).toBeCloseTo(result.positions[i],6);expect(result.positions[i+1]).toBeGreaterThanOrEqual(-.5);expect(result.positions[i+1]).toBeLessThanOrEqual(.5);}
});
test('transforms native Z-up receiver geometry and retains per-face lighting across shared edges',()=>{
 const source=mesh([-1,-1,0,1,-1,0,1,1,0,-1,1,0],[0,1,2,0,2,3],[0x0f,0xf0]);
 const transform=new Matrix4().makeRotationX(-Math.PI/2);transform.setPosition(2495,12,1687);
 const result=projectShadowReceiver(source,transform,{...footprint,center:{x:2495,y:13,z:1687},side:{x:0,z:1},front:{x:-1,z:0}});
 expect(area(result.positions)).toBeCloseTo(4,6);expect([...new Set(result.lights)]).toEqual([0x0f,0xf0]);
 for(let i=0;i<result.faces.length;i++){expect(result.lights[i]).toBe(result.faces[i]===0?0x0f:0xf0);expect(result.positions[i*3+1]).toBe(12);}
});
test('rejects overhangs, deep receivers, walls and empty boundary contacts',()=>{
 for(const source of [mesh([-1,3,-1,1,3,-1,0,3,1]),mesh([-1,-3,-1,1,-3,-1,0,-3,1]),mesh([0,0,-1,0,2,-1,0,0,1]),mesh([1,0,-1,3,0,-1,1,0,1])])expect(projectShadowReceiver(source,new Matrix4(),footprint).positions).toHaveLength(0);
});
test('downward COL winding remains a receiver and is reoriented for upward rasterization',()=>{
 const result=projectShadowReceiver(mesh([-1,0,-1,1,0,-1,0,0,1],[0,1,2]),new Matrix4(),footprint);
 expect(area(result.positions)).toBe(2);
 const p=result.positions;expect((p[5]-p[2])*(p[6]-p[0])-(p[3]-p[0])*(p[8]-p[2])).toBeGreaterThan(0);
 for(let i=0;i<p.length/3;i++){expect(result.uvs[i*2]).toBe((p[i*3]+1)/2);expect(result.lights[i]).toBe(0x35);}
});
test('rejects malformed geometry and fails atomically at its output budget',()=>{
 const source=mesh([-10,0,-10,10,0,-10,0,0,20]);
 expect(()=>projectShadowReceiver(source,new Matrix4(),footprint,3)).toThrow('budget');
 expect(()=>projectShadowReceiver(source,new Matrix4(),{...footprint,front:footprint.side})).toThrow('projection');
 source.indices[0]=99;expect(()=>projectShadowReceiver(source,new Matrix4(),footprint)).toThrow('index');
});
test('affine UV projection preserves slope height and unclamped coordinates after clipping',()=>{
 const projection=new Matrix4().set(2,0,0,.5,0,.5,.25,.5,0,0,1,0,0,0,0,1);
 const result=projectShadowReceiver(mesh([-10,-10,-10,10,10,-10,0,0,20]),new Matrix4(),footprint,65535,projection);
 for(let i=0;i<result.faces.length;i++){
  const [x,y,z]=result.positions.slice(i*3,i*3+3);
  expect(result.uvs[i*2]).toBeCloseTo(2*x+.5,6);
  expect(result.uvs[i*2+1]).toBeCloseTo(.5*y+.25*z+.5,6);
  expect(result.lights[i]).toBe(0x35);
 }
 expect(Math.min(...result.uvs)).toBeLessThan(0);expect(Math.max(...result.uvs)).toBeGreaterThan(1);
 projection.elements[3]=.1;
 expect(()=>projectShadowReceiver(mesh([-1,0,-1,1,0,-1,0,0,1]),new Matrix4(),footprint,65535,projection)).toThrow('affine');
});
test('candidate projection rejects wholly behind triangles but retains the zero plane and crossings',()=>{
 const projection=new Matrix4().set(.25,0,0,.5,0,0,.25,.5,0,1,0,0,0,0,0,1);
 const plane=(height:number)=>mesh([-1,height,-1,1,height,-1,0,height,1]);
 expect(projectShadowReceiver(plane(-.1),new Matrix4(),footprint,0,projection).positions).toHaveLength(0);
 for(const height of [0,.1,1.5])expect(area(projectShadowReceiver(plane(height),new Matrix4(),footprint,65535,projection).positions)).toBeCloseTo(2);
 const crossing=projectShadowReceiver(mesh([-1,-1,-1,1,-1,-1,0,1,1]),new Matrix4(),footprint,65535,projection);
 expect(area(crossing.positions)).toBeCloseTo(2);expect([...crossing.positions].filter((_,i)=>i%3===1)).toContain(-1);
});
test('candidate projection rejects triangles outside a shared UV boundary before output budgeting',()=>{
 const source=mesh([-1,0,-1,1,0,-1,0,0,1]);
 for(const [u,v] of [[-2,0],[2,0],[0,-2],[0,2]]){
  const projection=new Matrix4().set(.25,0,0,.5+u,0,0,.25,.5+v,0,0,0,1,0,0,0,1);
  expect(projectShadowReceiver(source,new Matrix4(),footprint,0,projection).positions).toHaveLength(0);
 }
});
test('affine projection clips vertical walls in three dimensions and preserves height UVs',()=>{
 const source=mesh([-10,-10,0,10,-10,0,0,20,0]),projection=new Matrix4().set(.25,0,0,.5,0,.25,0,.5,0,0,0,1,0,0,0,1);
 expect(projectShadowReceiver(source,new Matrix4(),footprint).positions).toHaveLength(0);
 for(const rotation of [0,Math.PI/2]){
  const transform=new Matrix4().makeRotationY(rotation),mapping=projection.clone().multiply(transform.clone().invert());
  const result=projectShadowReceiver(source,transform,footprint,65535,mapping);let measured=0;
  for(let i=0;i<result.positions.length;i+=9){
   const a=[...result.positions.slice(i,i+3)],b=[...result.positions.slice(i+3,i+6)],c=[...result.positions.slice(i+6,i+9)];
   measured+=Math.hypot((b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;
  }
  expect(measured).toBeCloseTo(8,6);
  for(let i=0;i<result.faces.length;i++){expect(result.uvs[i*2+1]).toBeCloseTo(.25*result.positions[i*3+1]+.5,6);expect(result.lights[i]).toBe(0x35);expect(result.faces[i]).toBe(0);}
 }
 const degenerate=mesh([-1,-1,0,0,0,0,1,1,0]);expect(projectShadowReceiver(degenerate,new Matrix4(),footprint,65535,projection).positions).toHaveLength(0);
});
test('native COL facing uses reverse winding and world-space projection direction',()=>{
 const projection=new Matrix4().set(.25,0,0,.5,0,0,.25,.5,0,-1,0,1,0,0,0,1);
 const downward=mesh([-1,0,-1,1,0,-1,0,0,1],[0,1,2]),upward=mesh([-1,0,-1,1,0,-1,0,0,1],[0,2,1]);
 expect(projectShadowReceiver(downward,new Matrix4(),footprint,65535,projection,'native-col').positions).toHaveLength(9);
 expect(projectShadowReceiver(upward,new Matrix4(),footprint,65535,projection,'native-col').positions).toHaveLength(0);
 // Rotate the same source floor into a wall together with its light frame.
 const rotation=new Matrix4().makeRotationX(Math.PI/2),rotatedProjection=projection.clone().multiply(rotation.clone().invert());
 expect(projectShadowReceiver(downward,rotation,footprint,65535,rotatedProjection,'native-col').positions).toHaveLength(9);
 expect(projectShadowReceiver(upward,rotation,footprint,65535,rotatedProjection,'native-col').positions).toHaveLength(0);
 expect(()=>projectShadowReceiver(downward,new Matrix4(),footprint,65535,undefined,'native-col')).toThrow('projection frame');
});
