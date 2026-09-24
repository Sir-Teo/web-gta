import {expect,test} from 'vitest';
import * as THREE from 'three';
import {NativeLightPools} from '../src/render/NativeLightPools';

test('a moving headlight pool keeps one cache entry and re-cuts its polygons as it moves',()=>{
 const pools=new NativeLightPools(new THREE.Scene());let queries=0;
 const receivers=()=>{queries++;return {chunks:[{geometry:{positions:new Float32Array(9),uvs:new Float32Array(6)}}]};};
 const raster=new THREE.Texture();
 for(let i=0;i<500;i++)pools.frame([{id:7,position:[i*.05,0,10],size:4,color:[45,45,45],intensity:128,maxHeight:6,front:[8,0],side:[0,-4]}],[0,0,10],receivers,raster);
 expect(pools.cached).toBe(1);expect(queries).toBe(500);
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
