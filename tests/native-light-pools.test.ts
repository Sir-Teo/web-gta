import {expect,test} from 'vitest';
import * as THREE from 'three';
import {NativeLightPools} from '../src/render/NativeLightPools';

test('a moving headlight pool keeps one cache entry, reusing its margin cut until it leaves it',()=>{
 const pools=new NativeLightPools(new THREE.Scene());let queries=0;
 const receivers=()=>{queries++;return {chunks:[{geometry:{positions:new Float32Array(9),uvs:new Float32Array(6)}}]};};
 const raster=new THREE.Texture();
 for(let i=0;i<500;i++)pools.frame([{id:7,position:[i*.05,0,10],size:4,color:[45,45,45],intensity:128,maxHeight:6,front:[8,0],side:[0,-4]}],[0,0,10],receivers,raster);
 // 25 units of travel in 0.05 steps; the cut has a quarter of a half-size (4 of 16 along front) to spare each way.
 expect(pools.cached).toBe(1);expect(queries).toBeGreaterThan(5);expect(queries).toBeLessThan(40);
 // A light standing still is cut once; turning it (the same position, a new front) cuts it again.
 queries=0;
 for(let i=0;i<5;i++)pools.frame([{id:7,position:[1,0,10],size:4,color:[45,45,45],intensity:128,maxHeight:6,front:[8,0],side:[0,-4]}],[0,0,10],receivers,raster);
 pools.frame([{id:7,position:[1,0,10],size:4,color:[45,45,45],intensity:128,maxHeight:6,front:[0,8],side:[4,0]}],[0,0,10],receivers,raster);
 expect(queries).toBe(2);
 // Lights no longer drawn give their polygons back.
 for(let i=0;i<800;i++)pools.frame([],[0,0,10],receivers,raster);
 expect(pools.cached).toBe(0);
 pools.dispose();
});

test('pools draw with UVs from the exact pose, and colour-only additive pools (fire glow) are not skipped',()=>{
 const pools=new NativeLightPools(new THREE.Scene());
 const receivers=()=>({chunks:[{geometry:{positions:new Float32Array([0,9,0, 1,9,0, 0,9,-1]),uvs:new Float32Array(6)}}]});
 const pool=(x:number)=>({id:1,position:[x,0,10] as [number,number,number],size:4,color:[40,32,20] as [number,number,number],intensity:0,maxHeight:6,front:[0,4] as [number,number],side:[4,0] as [number,number]});
 pools.frame([pool(0)],[0,0,10],receivers,new THREE.Texture());
 expect(pools.drawn).toBe(1);
 const uv=()=>[...((pools as any).mesh.geometry.getAttribute('uv').array as Float32Array).slice(0,2)];
 expect(uv()).toEqual([.5,.5]);
 // Moved half a unit east: the same cut, the first vertex now 0.5 west of the centre.
 pools.frame([pool(.5)],[0,0,10],receivers,new THREE.Texture());
 expect(uv()[0]).toBeCloseTo(.5-.5/8,6);
 pools.dispose();
});
