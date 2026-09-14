import {expect,test} from 'vitest';
import {nativeProcTriangle} from '../src/world/nativeProcTriangle';
const vertices=[[0,0,0],[0,4,0],[4,0,0]] as const;
const rule={inverseSpacingSquared:1/16,minimumDistanceSquared:6400};
test('procedural geometry preserves native winding, area density and all sample endpoints',()=>{
 const triangle=nativeProcTriangle(vertices,rule,[100,100,0]);
 expect(triangle.normal).toEqual([0,0,1]);expect(triangle.density).toBe(.5);expect(triangle.eligible).toBe(true);
 expect(triangle.point(0,0)).toEqual(vertices[0]);expect(triangle.point(1,0)).toEqual(vertices[1]);expect(triangle.point(1,1)).toEqual(vertices[2]);
 expect(triangle.point(.5,.5)).toEqual([1,1,0]);
 expect(nativeProcTriangle([vertices[0],vertices[2],vertices[1]],rule,[100,100,0]).normal[2]).toBe(-1);
 for(const u of [0,.25,.5,.75,1])for(const v of [0,.25,.5,.75,1]){
  const [x,y,z]=triangle.point(u,v);expect(x).toBeGreaterThanOrEqual(0);expect(y).toBeGreaterThanOrEqual(0);expect(x+y).toBeLessThanOrEqual(4);expect(z).toBe(0);
 }
});
test('camera gate excludes the near region and admits the exact native minimum distance',()=>{
 const centered=[[-2,-2,0],[0,4,0],[2,-2,0]] as const;
 expect(nativeProcTriangle(centered,rule,[0,0,79.99999]).eligible).toBe(false);
 expect(nativeProcTriangle(centered,rule,[0,0,80]).eligible).toBe(true);
 expect(nativeProcTriangle(centered,rule,[0,0,81]).eligible).toBe(true);
});
test('sloped placements retain plane height and degenerate triangles retain zero density',()=>{
 const triangle=nativeProcTriangle([[0,0,0],[0,4,4],[4,0,0]],rule,[100,100,0]);
 const p=triangle.point(.5,.5);expect(p).toEqual([1,1,1]);expect(triangle.normal[1]).toBeLessThan(0);expect(triangle.normal[2]).toBeGreaterThan(0);
 const degenerate=nativeProcTriangle([[0,0,0],[0,0,0],[0,0,0]],rule,[0,0,100]);expect(degenerate.density).toBe(0);expect(degenerate.normal).toEqual([1,0,0]);
 expect(()=>triangle.point(-.1,0)).toThrow('samples');expect(()=>triangle.point(0,NaN)).toThrow('samples');
 expect(()=>nativeProcTriangle(vertices,rule,[0,Infinity,0])).toThrow('camera');
 expect(()=>nativeProcTriangle(vertices,{...rule,inverseSpacingSquared:Infinity},[0,0,100])).toThrow('rule');
});
