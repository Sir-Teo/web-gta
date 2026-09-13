import {Matrix4,Vector3} from 'three';
import type {ColMesh} from '../assets/col';
import type {Vec3} from '../core/math';

export interface ShadowFootprint {
 center:Vec3;
 /** Horizontal half-axes: side maps to U, front maps to V. */
 side:{x:number;z:number};front:{x:number;z:number};
 depth:number;
}
type Vertex={x:number;y:number;z:number;u:number;v:number};
export function shadowFootprintBounds({center,side,front,depth}:ShadowFootprint){
 const halfExtents={x:Math.abs(side.x)+Math.abs(front.x),y:depth/2,z:Math.abs(side.z)+Math.abs(front.z)};
 const queryCenter={x:center.x,y:center.y-depth/2,z:center.z};
 const determinant=side.x*front.z-front.x*side.z;
 if(![center.x,center.y,center.z,side.x,side.z,front.x,front.z,depth,determinant,...Object.values(halfExtents),...Object.values(queryCenter)].every(Number.isFinite)||depth<=0||Math.abs(determinant)<1e-10)throw new Error('Invalid shadow receiver projection.');
 return {center:queryCenter,halfExtents};
}
/** Browser receiver geometry for a downward projected texture. Clips actual source
 * triangles, preserving slopes and their lighting metadata. This is a geometric
 * implementation, not a reversal of the original CastShadowEntityXY trampoline. */
export function projectShadowReceiver(mesh:ColMesh,transform:Matrix4,footprint:ShadowFootprint,maxVertices=65535,uvProjection?:Matrix4){
 const {center,side,front,depth}=footprint;
 const determinant=side.x*front.z-front.x*side.z;
 shadowFootprintBounds(footprint);
 if(!transform.elements.every(Number.isFinite)||!Number.isInteger(maxVertices)||maxVertices<0||maxVertices>1000000)throw new Error('Invalid shadow receiver projection.');
 // Only affine projections interpolate correctly without a homogeneous varying.
 if(uvProjection&&(!uvProjection.elements.every(Number.isFinite)||[3,7,11].some(i=>uvProjection.elements[i]!==0)||uvProjection.elements[15]!==1))throw new Error('Shadow UV projection must be finite and affine.');
 if(mesh.positions.length%3||mesh.indices.length%3||mesh.indices.length>3000000||mesh.lights.length!==mesh.indices.length/3)throw new Error('Invalid shadow receiver mesh.');
 const positions:number[]=[],uvs:number[]=[],lights:number[]=[],faces:number[]=[];
 const p=new Vector3();
 const vertex=(index:number):Vertex=>{
  if(index*3+2>=mesh.positions.length)throw new Error('Shadow receiver index is outside its mesh.');
  p.fromArray(mesh.positions,index*3).applyMatrix4(transform);
  if(![p.x,p.y,p.z].every(Number.isFinite))throw new Error('Invalid shadow receiver position.');
  const x=p.x-center.x,z=p.z-center.z;
  return {x:p.x,y:p.y,z:p.z,u:(x*front.z-front.x*z)/determinant,v:(side.x*z-x*side.z)/determinant};
 };
 const planes=[(p:Vertex)=>p.u+1,(p:Vertex)=>1-p.u,(p:Vertex)=>p.v+1,(p:Vertex)=>1-p.v,(p:Vertex)=>center.y-p.y,(p:Vertex)=>p.y-(center.y-depth)];
 for(let face=0;face<mesh.indices.length/3;face++){
  let polygon=[0,1,2].map(i=>vertex(mesh.indices[face*3+i]));
  const [a,b,c]=polygon;
  // Native COL support can be hit from either side (Grove roads include downward
  // winding). Keep both orientations, emitting upward receiver triangles.
  const normalY=(b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z);
  if(Math.abs(normalY)<=1e-10)continue;
  if(normalY<0)polygon.reverse();
  for(const plane of planes){
   const next:Vertex[]=[];
   for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length],da=plane(a),db=plane(b);
    if(da>=0)next.push(a);
    if((da<0)!==(db<0)){
     const t=da/(da-db);
     next.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t});
    }
   }
   polygon=next;if(polygon.length<3)break;
  }
  for(let i=1;i+1<polygon.length;i++){
   const tri=[polygon[0],polygon[i],polygon[i+1]], [a,b,c]=tri;
   if(Math.abs((b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z))<=1e-10)continue;
   if(positions.length/3+3>maxVertices)throw new Error('Shadow receiver vertex budget exceeded.');
   for(const v of tri){
    positions.push(v.x,v.y,v.z);
    // Evaluate after clipping, using height as well as horizontal position.
    // Preserve out-of-range UVs: clamping vertices would stretch edge texels.
    if(uvProjection){p.set(v.x,v.y,v.z).applyMatrix4(uvProjection);uvs.push(p.x,p.y);}
    else uvs.push(Math.max(0,Math.min(1,(v.u+1)/2)),Math.max(0,Math.min(1,(v.v+1)/2)));
    lights.push(mesh.lights[face]);faces.push(face);
   }
  }
 }
 return {positions:new Float32Array(positions),uvs:new Float32Array(uvs),lights:new Uint8Array(lights),faces:new Uint32Array(faces)};
}
