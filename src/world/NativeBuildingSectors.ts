import {requireAsset} from '../assets/binary';
import type {NativePlantEntity} from './NativePlantEntityCache';
import type {PlantPoint} from './nativePlantTriangle';
const f=Math.fround;
const sector=(coordinate:number)=>Math.floor(f(f(f(coordinate)/50)+60));
const key=(x:number,y:number)=>Math.max(0,Math.min(119,y))*120+Math.max(0,Math.min(119,x));

/** CEntity::GetBoundRect uses four corners, pairing each Y with its original Z.
 * It does not project all eight corners of the collision bounding box. */
export function nativeBuildingRectangle(entity:NativePlantEntity){
 const {min,max}=entity.collision.bounds,m=entity.matrix.elements.map(f);
 requireAsset(m.every(Number.isFinite)&&m[3]===0&&m[7]===0&&m[11]===0&&m[15]===1,'Invalid building sector transform.');
 requireAsset([...min,...max].every(Number.isFinite),'Invalid building bounds.');
 const corners=[min,max,[max[0],min[1],min[2]],[min[0],max[1],max[2]]];
 const points=corners.map(point=>[0,1].map(i=>f(f(f(f(m[i]*f(point[0]))+f(m[i+4]*f(point[1])))+f(m[i+8]*f(point[2])))+m[i+12])));
 requireAsset(points.flat().every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7),'Building sector bounds exceed limits.');
 return {left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),bottom:Math.min(...points.map(p=>p[1])),top:Math.max(...points.map(p=>p[1]))};
}

/** Regular building sectors only. Add in actual entity insertion order;
 * big buildings belong to the separate native LOD-sector lists. */
export class NativeBuildingSectors {
 private sectors=new Map<number,NativePlantEntity[]>();
 private memberships=new Map<string,number[]>();
 add(entity:NativePlantEntity,bigBuilding:boolean){
  requireAsset(!!entity.identity&&!this.memberships.has(entity.identity),'Duplicate or missing building identity.');
  if(bigBuilding)return;
  const rect=nativeBuildingRectangle(entity),keys:number[]=[];
  const minX=sector(Math.max(-3000,rect.left)),maxX=sector(rect.right>=3000?2999:rect.right);
  const minY=sector(Math.max(-3000,rect.bottom)),maxY=sector(rect.top>=3000?2999:rect.top);
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
   const id=key(x,y),list=this.sectors.get(id)??[];list.unshift(entity);this.sectors.set(id,list);keys.push(id);
  }
  this.memberships.set(entity.identity,keys);
 }
 remove(identity:string){
  for(const id of this.memberships.get(identity)??[]){
   const list=this.sectors.get(id)!;list.splice(list.findIndex(entity=>entity.identity===identity),1);
   if(!list.length)this.sectors.delete(id);
  }
  this.memberships.delete(identity);
 }
 /** Y-major then X-major, head-first per sector. Native repeated visits are
  * preserved; cache/scan-code rules decide whether an entity is admitted. */
 *scan(camera:PlantPoint){
  requireAsset(camera.length===3&&camera.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7),'Invalid building sector camera.');
  const minX=sector(f(f(camera[0])-340)),maxX=sector(f(f(camera[0])+340));
  const minY=sector(f(f(camera[1])-340)),maxY=sector(f(f(camera[1])+340));
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)yield* this.sectors.get(key(x,y))??[];
 }
 clear(){this.sectors.clear();this.memberships.clear();}
}
