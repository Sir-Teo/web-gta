import {requireAsset} from '../assets/binary';
import type {WindowsCrtRandom} from '../core/WindowsCrtRandom';
import type {PlantPoint} from './nativePlantTriangle';
import type {NativeProcRule} from './nativeProcRules';
import {nativeProcTriangle} from './nativeProcTriangle';
const f=Math.fround;

/** Random-density branch of ProcSurfaceInfo::AddObjects (0x5A3850).
 * Allocation owns its four transform draws: failed allocations consume none.
 * The caller supplies the shared CRT stream; restoring a saved rand OUTPUT
 * deliberately differs from restoring its previous internal state. */
export function distributeNativeProcRandom(
 vertices:readonly [PlantPoint,PlantPoint,PlantPoint],rule:NativeProcRule,modelId:number,camera:PlantPoint,
 random:Pick<WindowsCrtRandom,'next'|'nextUnit'|'reseed'>,
 allocate:(position:PlantPoint,normal:PlantPoint,random:Pick<WindowsCrtRandom,'nextUnit'>)=>boolean,
){
 requireAsset(rule.useGrid===0,'Random procedural distribution cannot process a grid rule.');
 requireAsset(Number.isInteger(modelId)&&modelId>=0&&modelId<=32767,'Invalid procedural model ID.');
 const triangle=nativeProcTriangle(vertices,rule,camera);
 // Reject malicious spacing before touching shared RNG or allocating objects.
 requireAsset(triangle.density<=100000,'Procedural triangle exceeds placement iteration limit.');
 if(!triangle.eligible)return {attempted:0,added:0};
 const sums=[0,1,2].map(i=>f(f(f(vertices[0][i])+f(vertices[1][i]))+f(vertices[2][i])));
 const seed=Math.trunc(f(f(f(sums[0]+sums[1])+sums[2])+modelId))>>>0;
 const previousOutput=random.next();random.reseed(seed);
 let attempted=0,added=0;
 try{
  for(let density=triangle.density;density>0;density=f(density-1)){
   const cutoff=density<1?random.nextUnit():1;
   if(cutoff>=density)continue;
   const u=random.nextUnit(),v=random.nextUnit();attempted++;
   if(allocate(triangle.point(u,v),triangle.normal,random))added++;
  }
 }finally{random.reseed(previousOutput);}
 return {attempted,added};
}
