import type {Matrix4} from 'three';
import type {ColModel} from '../assets/col';
import type {SurfaceInfoRecord} from '../assets/surfaceInfo';
import {requireAsset} from '../assets/binary';
import {nativePlantTriangle,type PlantPoint} from './nativePlantTriangle';
import {nativePlantCounts,nativeVegetationEligibility,type NativePlantSurface} from './nativeVegetation';

export type NativePlantCandidate=ReturnType<typeof nativePlantCollisionCandidates> extends Generator<infer T,unknown,unknown>?T:never;

/** One eligible entity's COL candidates, in native triangle order and GTA Z-up.
 * The caller owns entity selection, the 256-slot pool, seeds and phase scheduling.
 * Lazy iteration lets it stop when its pool is full without truncating metadata. */
export function* nativePlantCollisionCandidates(col:ColModel,matrix:Matrix4,camera:PlantPoint,info:ReadonlyMap<number,SurfaceInfoRecord>,plants:ReadonlyMap<number,NativePlantSurface>,phase?:number){
 requireAsset(phase===undefined||Number.isInteger(phase)&&phase>=0&&phase<8,'Invalid plant triangle phase.');
 requireAsset(camera.length===3&&camera.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7),'Invalid plant camera position.');
 const m=matrix.elements.map(Math.fround),f=Math.fround;
 requireAsset(m.every(Number.isFinite)&&m[3]===0&&m[7]===0&&m[11]===0&&m[15]===1,'Plant transform must be finite and affine.');
 const transform=(p:PlantPoint):PlantPoint=>[0,1,2].map(i=>f(f(f(f(m[i]*p[0])+f(m[i+4]*p[1]))+f(m[i+8]*p[2]))+m[i+12])) as unknown as PlantPoint;
 const groups=col.faceGroups.filter(group=>{
  // Native code transforms just the two stored corners and then recalculates
  // min/max. Preserve this rather than substituting an eight-corner AABB.
  const a=transform(group.min),b=transform(group.max);
  for(let axis=0;axis<3;axis++){
   const min=Math.min(a[axis],b[axis]),max=Math.max(a[axis],b[axis]);
   // CCollision::TestSphereBox is an axis-overlap test, not a closest-point
   // sphere/AABB distance test. Corner false positives are filtered later.
   if(f(f(camera[axis])+100)<min||f(f(camera[axis])-100)>max)return false;
  }
  return true;
 });
 const ranges=col.flags&8?groups.map(group=>[group.start,group.end]):[[0,col.mesh.materials.length-1]];
 for(const [start,end] of ranges)for(let index=start;index<=end;index++){
  if(phase!==undefined&&index%8!==phase)continue;
  const surface=col.mesh.materials[index],flags=nativeVegetationEligibility(surface,info);
  if(!flags.plants&&!flags.objects)continue;
  const vertex=(corner:number):PlantPoint=>{
   const offset=col.mesh.indices[index*3+corner]*3;
   return transform([col.mesh.positions[offset],col.mesh.positions[offset+1],col.mesh.positions[offset+2]]);
  };
  const triangle=nativePlantTriangle(vertex(0),vertex(1),vertex(2));if(!triangle.near(camera))continue;
  const properties=plants.get(surface);
  requireAsset(!flags.plants||!!properties,`Missing grass properties for surface ${surface}.`);
  const counts=flags.plants?nativePlantCounts(triangle.area,properties!):undefined;
  const createsPlants=!!counts?.maximum.some(count=>count>0);
  if(!createsPlants&&!flags.objects)continue;
  yield {index,surface,lighting:col.mesh.lights[index],triangle,counts,createsPlants,createsObjects:flags.objects,slot:createsPlants?properties!.slot:3};
 }
}
