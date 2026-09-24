/* The visual waves of the water surface, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166 (WaterLevel.cpp).
 *
 * - CWaterLevel::CalculateWavesOnlyForCoordinate (0x6E6EF0): three sines over the integer |x|,|y| of a vertex, scaled
 *   by faWaveMultipliersX[(|x|/2)%8] * faWaveMultipliersY[(|y|/2)%8] * CWeather::Wavyness and the vertex's WATER.DAT
 *   big/small wave amplitudes; each phase is ((GetTimeInMS() - m_nWaterTimeOffset) % period) * 2π/period + 2π(kx·x+ky·y).
 *   GetSinFast's lookup table is replaced by Math.sin. Only the height is ported; the normal/colorMult/glare outputs
 *   feed the unreversed high-detail renderer (0x6EB810, 0x6EDDC0), whose use of them is unknown.
 * - faWaveMultipliersX/Y (0x8D38C8, 0x8D38E8) are exe data the source does not carry: AUTHORED here as all 1.0,
 *   so the swell is uniform and only CWeather::Wavyness and the per-vertex amplitudes scale it.
 * - CWaterLevel::SyncWater (SYNC_WATER; no address in the source) sets m_nWaterTimeOffset to GetTimeInMS().
 * - CWaterLevel::SetCameraRange (0x6E9C80): the detailed patch spans the camera ±DETAILEDWATERDIST (48) rounded out
 *   to even units. RenderWaterRectangle (0x6EC5D0) / RenderWaterTriangle (0x6EE240) split polygons at that range,
 *   lerping CRenPar {z, bigWaves, smallWaves} (0x6E5280); the parts outside render flat and the parts inside go to
 *   RenderHighDetailWater* (unreversed). The port subdivides the inside parts on the 2-unit grid the even range implies.
 *   WATER.DAT positions are truncated to int32 as LoadDataFile's VertexUnpack does. */
import type {WaterPolygon} from '../assets/water';
/** AUTHORED: faWaveMultipliersX/Y are not in the reversed source; all 1.0 leaves the swell uniform. */
export const WAVE_MULTIPLIERS_X:readonly number[]=[1,1,1,1,1,1,1,1];
export const WAVE_MULTIPLIERS_Y:readonly number[]=[1,1,1,1,1,1,1,1];
export const DETAILED_WATER_DIST=48;
/** CalculateWave(period ms, kx, ky, amplitude = big·a + small·b). */
export const WATER_WAVES:readonly (readonly [period:number,kx:number,ky:number,big:number,small:number])[]=[[5000,1/64,1/64,2,0],[3500,1/26,1/52,0,1],[3000,0,1/20,0,.5]];
/** The time part of each wave's phase: uint32 (GetTimeInMS() - m_nWaterTimeOffset) % period * 2π/period. */
export function waterWavePhases(timeMs:number,waterTimeOffset:number,out:number[]=[0,0,0]){
 const elapsed=((Math.floor(timeMs)>>>0)-(Math.floor(waterTimeOffset)>>>0))>>>0;
 for(let i=0;i<3;i++){const period=WATER_WAVES[i][0];out[i]=elapsed%period*(2*Math.PI/period);}return out;
}
/** CalculateWavesOnlyForCoordinate's outWave for native (x,y) (truncated to int32 like its arguments). */
export function calculateWavesOnlyForCoordinate(x:number,y:number,bigWaves:number,smallWaves:number,timeMs:number,waterTimeOffset=0,wavyness=1){
 const ax=Math.abs(Math.trunc(x)),ay=Math.abs(Math.trunc(y)),mult=WAVE_MULTIPLIERS_X[Math.floor(ax/2)%8]*WAVE_MULTIPLIERS_Y[Math.floor(ay/2)%8]*wavyness,phases=waterWavePhases(timeMs,waterTimeOffset);
 let wave=0;for(let i=0;i<3;i++){const [,kx,ky,big,small]=WATER_WAVES[i];wave+=Math.sin(phases[i]+2*Math.PI*(kx*ax+ky*ay))*mult*(big*bigWaves+small*smallWaves);}
 return wave;
}
export interface WaterCameraRange {minX:number;maxX:number;minY:number;maxY:number;}
/** SetCameraRange: 2*floor((p-48)/2) .. 2*ceil((p+48)/2) in native x and y. */
export function waterCameraRange(x:number,y:number,dist=DETAILED_WATER_DIST,out:WaterCameraRange={minX:0,maxX:0,minY:0,maxY:0}){
 out.minX=2*Math.floor((x-dist)/2);out.maxX=2*Math.ceil((x+dist)/2);out.minY=2*Math.floor((y-dist)/2);out.maxY=2*Math.ceil((y+dist)/2);return out;
}
/** A polygon's CRenPar field over native (x,y): quads interpolate their corners bilinearly (the X/Y splits lerp
 * row pairs), triangles their plane. `sample` writes [z, bigWaves, smallWaves]. */
export interface WaterSurface {minX:number;minY:number;maxX:number;maxY:number;triangle?:readonly [number,number][];sample(x:number,y:number,out:number[]):void;}
export function waterSurface(polygon:WaterPolygon):WaterSurface|undefined{
 const v=polygon.vertices.map(p=>({x:Math.trunc(p.position[0]),y:Math.trunc(p.position[1]),r:[p.position[2],p.bigWaves,p.smallWaves]}));
 const xs=v.map(p=>p.x),ys=v.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 if(!(maxX>minX&&maxY>minY))return;
 if(v.length===4){
  const corner=(cx:number,cy:number)=>v.reduce((best,p)=>Math.hypot(p.x-cx,p.y-cy)<Math.hypot(best.x-cx,best.y-cy)?p:best).r;
  const c00=corner(minX,minY),c10=corner(maxX,minY),c01=corner(minX,maxY),c11=corner(maxX,maxY);
  return {minX,minY,maxX,maxY,sample(x,y,out){const u=(x-minX)/(maxX-minX),t=(y-minY)/(maxY-minY);for(let i=0;i<3;i++)out[i]=(c00[i]*(1-u)+c10[i]*u)*(1-t)+(c01[i]*(1-u)+c11[i]*u)*t;}};
 }
 const [a,b,c]=v,det=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(det===0)return;
 return {minX,minY,maxX,maxY,triangle:[[a.x,a.y],[b.x,b.y],[c.x,c.y]],sample(x,y,out){
  const l1=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/det,l2=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/det,l3=1-l1-l2;
  for(let i=0;i<3;i++)out[i]=l1*a.r[i]+l2*b.r[i]+l3*c.r[i];
 }};
}
/** Grid lines from lo to hi through every even unit between them. */
function gridLines(lo:number,hi:number,out:number[]){out.length=0;out.push(lo);for(let v=2*Math.floor(lo/2)+2;v<hi;v+=2)out.push(v);out.push(hi);return out;}
/** Sutherland–Hodgman: the part of a convex polygon on the inner side of each triangle edge. */
function clipToTriangle(points:[number,number][],tri:readonly [number,number][]){
 const [a,b,c]=tri,sign=Math.sign((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));let poly=points;
 for(let e=0;e<3&&poly.length;e++){
  const p=tri[e],q=tri[(e+1)%3],side=(s:[number,number])=>sign*((q[0]-p[0])*(s[1]-p[1])-(q[1]-p[1])*(s[0]-p[0])),next:[number,number][]=[];
  for(let i=0;i<poly.length;i++){
   const s=poly[i],t=poly[(i+1)%poly.length],ds=side(s),dt=side(t);
   if(ds>=0)next.push(s);if(ds>0&&dt<0||ds<0&&dt>0){const k=ds/(ds-dt);next.push([s[0]+(t[0]-s[0])*k,s[1]+(t[1]-s[1])*k]);}
  }
  poly=next;
 }
 return poly;
}
/** The detailed water inside the camera range: each polygon's overlap subdivided on the 2-unit grid with
 * per-vertex [bigWaves, smallWaves]. Buffers are reused between builds; `grown` says they were reallocated. */
export class DetailedWaterBuilder {
 positions=new Float32Array(3*1024);waves=new Float32Array(2*1024);uvs=new Float32Array(2*1024);indices=new Uint32Array(6*1024);
 vertexCount=0;indexCount=0;grown=false;
 private r=[0,0,0];private xs:number[]=[];private ys:number[]=[];
 build(surfaces:readonly WaterSurface[],range:WaterCameraRange){
  this.vertexCount=this.indexCount=0;this.grown=false;
  for(const s of surfaces){
   // RenderWaterRectangle/Triangle's "lies outside (of camera) fully" test.
   if(s.minX>=range.maxX||s.maxX<=range.minX||s.minY>=range.maxY||s.maxY<=range.minY)continue;
   const xs=gridLines(Math.max(s.minX,range.minX),Math.min(s.maxX,range.maxX),this.xs),ys=gridLines(Math.max(s.minY,range.minY),Math.min(s.maxY,range.maxY),this.ys),nx=xs.length,ny=ys.length;
   if(!s.triangle){
    this.reserve(nx*ny,(nx-1)*(ny-1)*6);const base=this.vertexCount;
    for(const y of ys)for(const x of xs)this.vertex(s,x,y);
    for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){const a=base+j*nx+i,c=a+nx;this.tri(a,a+1,c);this.tri(c,a+1,c+1);}
    continue;
   }
   for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){
    const poly=clipToTriangle([[xs[i],ys[j]],[xs[i+1],ys[j]],[xs[i+1],ys[j+1]],[xs[i],ys[j+1]]],s.triangle);if(poly.length<3)continue;
    this.reserve(poly.length,(poly.length-2)*3);const base=this.vertexCount;
    for(const [x,y]of poly)this.vertex(s,x,y);
    for(let k=1;k<poly.length-1;k++)this.tri(base,base+k,base+k+1);
   }
  }
  return this;
 }
 private vertex(s:WaterSurface,x:number,y:number){
  const r=this.r,v=this.vertexCount++;s.sample(x,y,r);
  this.positions[v*3]=x;this.positions[v*3+1]=r[0];this.positions[v*3+2]=-y;this.waves[v*2]=r[1];this.waves[v*2+1]=r[2];this.uvs[v*2]=x/25;this.uvs[v*2+1]=y/25;
 }
 private tri(a:number,b:number,c:number){const i=this.indices,n=this.indexCount;i[n]=a;i[n+1]=b;i[n+2]=c;this.indexCount=n+3;}
 private reserve(vertices:number,indices:number){
  const grow=<T extends Float32Array|Uint32Array>(array:T,need:number,make:(n:number)=>T)=>{if(need<=array.length)return array;this.grown=true;const next=make(Math.max(need,array.length*2));next.set(array);return next;};
  const v=this.vertexCount+vertices,i=this.indexCount+indices;
  this.positions=grow(this.positions,v*3,n=>new Float32Array(n));this.waves=grow(this.waves,v*2,n=>new Float32Array(n));this.uvs=grow(this.uvs,v*2,n=>new Float32Array(n));this.indices=grow(this.indices,i,n=>new Uint32Array(n));
 }
}
