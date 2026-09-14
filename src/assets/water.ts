import {requireAsset} from './binary';
export interface WaterVertex {position:[number,number,number];flow:[number,number];bigWaves:number;smallWaves:number;}
export interface WaterPolygon {vertices:WaterVertex[];flags:number;line:number;}
/** SA text water polygons. Preserve source values before native integer/flow quantization. */
export function readWater(text:string){
  requireAsset(text.length<=4*1024*1024,'Water data exceeds 4 MiB.');
  const polygons:WaterPolygon[]=[];let processed=false;
  for(const [index,raw] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
    const line=raw.split('#')[0].trim();if(!line)continue;
    if(line.toLowerCase()==='processed'){requireAsset(!processed&&!polygons.length,'Unexpected water header.');processed=true;continue;}
    const fields=line.split(/\s+/),values=fields.map(Number);
    requireAsset([21,22,28,29].includes(fields.length)&&values.every(Number.isFinite),`Water line ${index+1}: expected three or four seven-value vertices and an optional flag.`);
    const count=Math.floor(fields.length/7),hasFlag=fields.length%7===1,flags=hasFlag?values.at(-1)!:0;
    requireAsset(Number.isInteger(flags)&&flags>=0&&flags<=0xffffffff,`Water line ${index+1}: invalid flags.`);
    const vertices:WaterVertex[]=[];
    for(let i=0;i<count;i++){
      const v=values.slice(i*7,i*7+7);requireAsset(v.every(n=>Math.abs(n)<=1e7),`Water line ${index+1}: values exceed coordinate limits.`);
      vertices.push({position:[v[0],v[1],v[2]],flow:[v[3],v[4]],bigWaves:v[5],smallWaves:v[6]});
    }
    polygons.push({vertices,flags,line:index+1});requireAsset(polygons.length<=16384,'Water data exceeds 16,384 polygons.');
  }
  requireAsset(polygons.length>0,'Water data contains no polygons.');return {processed,polygons};
}
/** Native quad order follows two rows, not perimeter order. No wave displacement is baked. */
export function waterGeometry(polygons:WaterPolygon[]){
  const positions:number[]=[],indices:number[]=[],flags:number[]=[];
  for(const polygon of polygons){
    const base=positions.length/3;for(const vertex of polygon.vertices){const[x,y,z]=vertex.position;positions.push(x,z,-y);}
    for(const i of polygon.vertices.length===3?[0,1,2]:[0,1,2,2,1,3])indices.push(base+i);
    flags.push(polygon.flags);
  }
  return {positions:new Float32Array(positions),indices:new Uint32Array(indices),flags};
}

/** Match the first stored vertex used by CWaterPolygon::IsInInterior.
 * Native quad insertion sorts by Y then X; triangles put a shared-Y pair first. */
export function waterProperties(polygon:WaterPolygon){
  const vertices=polygon.vertices;
  requireAsset(vertices.length===3||vertices.length===4,'Water polygon needs three or four vertices.');
  const x=(v:WaterVertex)=>Math.trunc(v.position[0]),y=(v:WaterVertex)=>Math.trunc(v.position[1]);
  let first:WaterVertex;
  if(vertices.length===4)first=[...vertices].sort((a,b)=>y(a)-y(b)||x(a)-x(b))[0];
  else{
    const [a,b,c]=vertices,pair=y(a)===y(b)?[a,b]:y(a)===y(c)?[a,c]:[b,c];
    first=x(pair[0])<x(pair[1])?pair[0]:pair[1];
  }
  return {visible:(polygon.flags&1)!==0,limitedDepth:(polygon.flags&2)!==0,interior:Math.fround(first.position[2])>950};
}
export function visibleWaterPolygons(polygons:WaterPolygon[],interior:boolean){
  return polygons.filter(p=>{const properties=waterProperties(p);return properties.visible&&properties.interior===interior;});
}
