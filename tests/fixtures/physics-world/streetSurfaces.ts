/** Authored street surfaces shared by rendering and collision. Heights include
 * the intentional layering of asphalt over concrete. */
export const STREET_SURFACES=[
 {id:'street-concrete',material:'concrete',x:0,y:0,z:73,width:21,depth:170},
 {id:'street-asphalt',material:'asphalt',x:0,y:.014,z:82,width:14,depth:164},
 {id:'turning-apron',material:'concrete',x:0,y:.006,z:0,radius:19},
 {id:'turning-asphalt',material:'asphalt',x:0,y:.02,z:0,radius:16.5},
 {id:'cross-concrete',material:'concrete',x:0,y:.008,z:161,width:460,depth:24},
 {id:'cross-asphalt',material:'asphalt',x:0,y:.021,z:161,width:460,depth:18},
 {id:'north-concrete',material:'concrete',x:0,y:.007,z:-82,width:185,depth:18},
 {id:'north-asphalt',material:'asphalt',x:0,y:.015,z:-82,width:185,depth:13},
] as const;
export function streetSurfaceTriangles(surface:typeof STREET_SURFACES[number]){
 if('radius'in surface){
  const vertices=[0,0,0],indices:number[]=[];
  for(let i=0;i<=64;i++){const a=i*Math.PI/32;vertices.push(surface.radius*Math.cos(a),0,-surface.radius*Math.sin(a));if(i<64)indices.push(0,i+1,i+2);}
  return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};
 }
 const x=surface.width/2,z=surface.depth/2;
 return {vertices:new Float32Array([-x,0,z,x,0,z,-x,0,-z,x,0,-z]),indices:new Uint32Array([0,1,2,2,1,3])};
}
