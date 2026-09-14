import {Matrix3,Matrix4,Vector3} from 'three';
import {nativeColNormal} from '../assets/nativeColNormal';
import type {ColMesh} from '../assets/col';
import type {Vec3} from '../core/math';

export interface ShadowFootprint {
 center:Vec3;
 /** Horizontal half-axes: side maps to U, front maps to V. */
 side:{x:number;z:number};front:{x:number;z:number};
 depth:number;
}
type Vertex={x:number;y:number;z:number;u:number;v:number};
const surfaceAreaSquared=(a:Vertex,b:Vertex,c:Vertex)=>{
 const x=(b.y-a.y)*(c.z-a.z)-(b.z-a.z)*(c.y-a.y),y=(b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z),z=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 return x*x+y*y+z*z;
};
export function shadowFootprintBounds({center,side,front,depth}:ShadowFootprint){
 const halfExtents={x:Math.abs(side.x)+Math.abs(front.x),y:depth/2,z:Math.abs(side.z)+Math.abs(front.z)};
 const queryCenter={x:center.x,y:center.y-depth/2,z:center.z};
 const determinant=side.x*front.z-front.x*side.z;
 if(![center.x,center.y,center.z,side.x,side.z,front.x,front.z,depth,determinant,...Object.values(halfExtents),...Object.values(queryCenter)].every(Number.isFinite)||depth<=0||Math.abs(determinant)<1e-10)throw new Error('Invalid shadow receiver projection.');
 return {center:queryCenter,halfExtents};
}
/** Browser receiver geometry for a downward or affine projected texture. Clips actual
 * triangles, preserving surface shape and lighting metadata. This is a geometric
 * implementation, not a reversal of the original CastShadowEntityXY trampoline. */
export function projectShadowReceiver(mesh:ColMesh,transform:Matrix4,footprint:ShadowFootprint,maxVertices=65535,uvProjection?:Matrix4,facing:'double-sided'|'native-col'='double-sided',surfaceOffset=0){
 const {center,side,front,depth}=footprint;
 const determinant=side.x*front.z-front.x*side.z;
 shadowFootprintBounds(footprint);
 if(!transform.elements.every(Number.isFinite)||!Number.isInteger(maxVertices)||maxVertices<0||maxVertices>1000000)throw new Error('Invalid shadow receiver projection.');
 // Only affine projections interpolate correctly without a homogeneous varying.
 if(uvProjection&&(!uvProjection.elements.every(Number.isFinite)||[3,7,11].some(i=>uvProjection.elements[i]!==0)||uvProjection.elements[15]!==1))throw new Error('Shadow UV projection must be finite and affine.');
 if(facing==='native-col'&&!uvProjection)throw new Error('Native shadow facing requires a projection frame.');
 if(mesh.positions.length%3||mesh.indices.length%3||mesh.indices.length>3000000||mesh.lights.length!==mesh.indices.length/3)throw new Error('Invalid shadow receiver mesh.');
 if(!Number.isFinite(surfaceOffset)||surfaceOffset<0||surfaceOffset>1||surfaceOffset!==0&&facing!=='native-col')throw new Error('Invalid shadow receiver surface offset.');
 const offsetMatrix=new Matrix3().setFromMatrix4(transform),offset=new Vector3();
 const positions:number[]=[],uvs:number[]=[],lights:number[]=[],faces:number[]=[];
 const p=new Vector3();
 const projected=uvProjection?[new Vector3(),new Vector3(),new Vector3()]:undefined;
 const sourcePoints=facing==='native-col'?[new Vector3(),new Vector3(),new Vector3()]:undefined;
 const normalMatrix=facing==='native-col'?new Matrix3().getNormalMatrix(transform):undefined;
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
  if(facing==='native-col'){
   // Quantize in native source space, then compare in world coordinates with
   // the affine depth gradient. Rotating before quantization changes the result.
   sourcePoints!.forEach((point,i)=>point.fromArray(mesh.positions,mesh.indices[face*3+i]*3));
   nativeColNormal(sourcePoints![0],sourcePoints![1],sourcePoints![2],p);
   offset.copy(p).multiplyScalar(surfaceOffset).applyMatrix3(offsetMatrix);
   p.applyMatrix3(normalMatrix!);
   const m=uvProjection!.elements;if(p.x*m[2]+p.y*m[6]+p.z*m[10]>0)continue;
   for(const v of polygon){v.x+=offset.x;v.y+=offset.y;v.z+=offset.z;const x=v.x-center.x,z=v.z-center.z;v.u=(x*front.z-front.x*z)/determinant;v.v=(side.x*z-x*side.z)/determinant;}
  }
  if(uvProjection){
   // Related reVC callback rejection, evaluated on the original world triangle
   // before browser footprint clipping. A crossing triangle is retained whole;
   // there is no per-fragment depth cutoff or far-depth limit in this rule.
   polygon.forEach((v,i)=>projected![i].set(v.x,v.y,v.z).applyMatrix4(uvProjection));
   if(projected!.every(v=>v.z<0)||projected!.every(v=>v.x<0)||projected!.every(v=>v.x>1)||projected!.every(v=>v.y<0)||projected!.every(v=>v.y>1))continue;
  }
  const [a,b,c]=polygon;

  // Native COL support can be hit from either side (Grove roads include downward
  // winding). Keep both orientations, emitting upward receiver triangles.
  const normalY=(b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z);
  if(uvProjection?surfaceAreaSquared(a,b,c)<=1e-20:Math.abs(normalY)<=1e-10)continue;
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
   if(uvProjection?surfaceAreaSquared(a,b,c)<=1e-20:Math.abs((b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z))<=1e-10)continue;
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
