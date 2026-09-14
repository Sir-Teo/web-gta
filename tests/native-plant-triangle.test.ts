import {expect,test} from 'vitest';
import {nativePlantTriangle} from '../src/world/nativePlantTriangle';
import {nativePlantCounts,initializeNativePlants} from '../src/world/nativeVegetation';
import {readPlants} from '../src/assets/vegetation';

test('grass density uses full sloped collision-triangle area, with immutable float32 vertices',()=>{
 const a:[number,number,number]=[0,0,0],tri=nativePlantTriangle(a,[3,0,0],[0,4,3]);
 expect(tri.area).toBe(7.5);expect(tri.center).toEqual([1,Math.fround(4/3),1]);a[0]=100;
 expect(tri.vertices[0]).toEqual([0,0,0]);
 const surface=initializeNativePlants(readPlants('GRASS_SHORT_LUSH 0 0 0 1 220 210 165 160 22 40 .5 .51 1.5 .65 5 1 2')).values().next().value!;
 expect(nativePlantCounts(tri.area,surface)).toEqual({maximum:[15,0,0],draw:[16,0,0]});
});
test('native proximity includes edge midpoints and centroid, and uses a strict three-dimensional boundary',()=>{
 const tri=nativePlantTriangle([-200,0,0],[200,0,0],[0,400,0]);
 expect(tri.near([0,0,0])).toBe(true); // Edge midpoint; all vertices are far away.
 expect(tri.near(tri.center)).toBe(true);
 const point=nativePlantTriangle([0,0,0],[0,0,0],[0,0,0]);
 expect(point.area).toBe(0);expect(point.near([0,0,100])).toBe(false);expect(point.near([0,0,99.99])).toBe(true);
 expect(point.near([100-1e-7,0,0])).toBe(false); // Rounds to the native float boundary.
});
test('native seven-point test and first-vertex radius retain source behavior on large asymmetric triangles',()=>{
 const large=nativePlantTriangle([-1000,0,0],[1000,0,0],[0,1000,0]);
 expect(large.near([250,100,0])).toBe(false); // Point is inside; no sampled point is within 100.
 const skew=nativePlantTriangle([0,0,0],[100,0,0],[-99,1,0]);
 expect(skew.radius).toBeLessThan(1); // Not a minimum enclosing sphere.
 expect(()=>nativePlantTriangle([NaN,0,0],[0,0,0],[0,0,0])).toThrow('coordinate');
});
