import {requireAsset} from '../assets/binary';
import {nativePlantTriangle,type PlantPoint} from './nativePlantTriangle';
import type {NativeProcRule} from './nativeProcRules';
const f=Math.fround;
const subtract=(a:PlantPoint,b:PlantPoint)=>a.map((v,i)=>f(v-b[i])) as [number,number,number];
const squared=(v:PlantPoint)=>f(f(f(v[0]*v[0])+f(v[1]*v[1]))+f(v[2]*v[2]));

/** ProcSurfaceInfo geometry with explicit point samples. No RNG, allocations or
 * grid traversal: callers retain control of those source-sensitive lifetimes. */
export function nativeProcTriangle(vertices:readonly [PlantPoint,PlantPoint,PlantPoint],rule:Pick<NativeProcRule,'inverseSpacingSquared'|'minimumDistanceSquared'>,camera:PlantPoint){
 requireAsset(camera.length===3&&camera.every(v=>Number.isFinite(v)&&Math.abs(v)<=1e7),'Invalid procedural camera.');
 requireAsset(Number.isFinite(rule.inverseSpacingSquared)&&rule.inverseSpacingSquared>0&&Number.isFinite(rule.minimumDistanceSquared)&&rule.minimumDistanceSquared>=0,'Invalid procedural geometry rule.');
 const triangle=nativePlantTriangle(...vertices),[a,b,c]=triangle.vertices;
 const first=subtract(b,a),second=subtract(c,b),third=subtract(c,a);
 // ProcSurfaceInfo uses (V3-V1) cross (V2-V1), the reverse of the
 // conventional triangle normal. Do not force its Z component upward.
 const cross:PlantPoint=[f(f(third[1]*first[2])-f(third[2]*first[1])),f(f(third[2]*first[0])-f(third[0]*first[2])),f(f(third[0]*first[1])-f(third[1]*first[0]))];
 const lengthSquared=squared(cross),reciprocal=lengthSquared>0?f(1/f(Math.sqrt(lengthSquared))):0;
 const normal:PlantPoint=lengthSquared>0?cross.map(v=>f(v*reciprocal)) as [number,number,number]:[1,0,0];
 const density=f(triangle.area*f(rule.inverseSpacingSquared));
 requireAsset(Number.isFinite(density)&&normal.every(Number.isFinite),'Procedural triangle exceeds float32 limits.');
 const distanceSquared=squared(subtract(triangle.center,camera.map(f) as [number,number,number]));
 return {center:triangle.center,normal,density,eligible:distanceSquared>=f(rule.minimumDistanceSquared),
  point(u:number,v:number):PlantPoint{
   requireAsset(Number.isFinite(u)&&u>=0&&u<=1&&Number.isFinite(v)&&v>=0&&v<=1,'Procedural placement requires two samples in [0,1].');
   const offset=f(u),along=f(offset*f(v));
   return a.map((value,i)=>f(f(value+f(first[i]*offset))+f(second[i]*along))) as [number,number,number];
  },
 };
}
