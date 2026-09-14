import {requireAsset} from '../assets/binary';

export type PlantPoint=readonly [number,number,number];
const f=Math.fround;
const point=(p:PlantPoint):PlantPoint=>{
 requireAsset(p.length===3&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7),'Invalid plant triangle coordinate.');
 return [f(p[0]),f(p[1]),f(p[2])];
};
const subtract=(a:PlantPoint,b:PlantPoint):PlantPoint=>[f(a[0]-b[0]),f(a[1]-b[1]),f(a[2]-b[2])];
const squared=(v:PlantPoint)=>f(f(f(v[0]*v[0])+f(v[1]*v[1]))+f(v[2]*v[2]));
const distanceSquared=(a:PlantPoint,b:PlantPoint)=>squared(subtract(a,b));
const midpoint=(a:PlantPoint,b:PlantPoint):PlantPoint=>[f(f(a[0]+b[0])/2),f(f(a[1]+b[1])/2),f(f(a[2]+b[2])/2)];

/** Inputs are already transformed collision vertices, not render-mesh vertices.
 * PlantLocTri stores centroid, area and its unusual first-vertex-based radius.
 * PlantMgr proximity checks exactly seven samples with a strict 100-unit radius. */
export function nativePlantTriangle(a:PlantPoint,b:PlantPoint,c:PlantPoint){
 const vertices=[point(a),point(b),point(c)] as const;
 const [v1,v2,v3]=vertices,u=subtract(v2,v1),v=subtract(v3,v1);
 const cross:PlantPoint=[f(f(u[1]*v[2])-f(u[2]*v[1])),f(f(u[2]*v[0])-f(u[0]*v[2])),f(f(u[0]*v[1])-f(u[1]*v[0]))];
 const center:PlantPoint=[f(f(f(v1[0]+v2[0])+v3[0])/3),f(f(f(v1[1]+v2[1])+v3[1])/3),f(f(f(v1[2]+v2[2])+v3[2])/3)];
 const area=f(f(Math.sqrt(squared(cross)))/2),radius=f(f(Math.sqrt(distanceSquared(center,v1)))*1.75);
 requireAsset(Number.isFinite(area)&&Number.isFinite(radius),'Plant triangle exceeds float32 geometry limits.');
 const samples=[...vertices,center,midpoint(v1,v2),midpoint(v1,v3),midpoint(v2,v3)];
 return {vertices,center,area,radius,
  near(position:PlantPoint){const camera=point(position);return samples.some(sample=>distanceSquared(sample,camera)<10000);},
 };
}
