import type {WaterPolygon} from '../assets/water';
import {WAVE_MULTIPLIERS_X,WAVE_MULTIPLIERS_Y} from './waterWaves';
/* CWaterLevel's gameplay heights as the iOS executable computes them (GetWaterLevel 0x1004897f4, GetWaterLevelNoWaves
 * 0x100489894, TestQuadToGetWaterLevel 0x100489a94, TestTriangleToGetWaterLevel 0x100489d20, AddWaveToResult
 * 0x10048934c, CalculateWavesOnlyForCoordinate2 0x100489610). gta-reversed has none of them reversed. Native coordinates
 * (x east, y north, z up). */
const f=Math.fround;
/** The map's 12 × 12 grid of 500-unit blocks, from -3000. */
const BLOCK=500,BLOCKS=12,MAP_EDGE=3000;
/** WATER.DAT flag 2: bLimitedDepth, water that is not there more than 6 units under its surface. */
const WATER_LIMITED_DEPTH=2;
/** CMaths' sin table (0x100820768): sinf(i × 2π/256), 256 entries, which the gameplay waves index. */
const SIN_LUT=Float32Array.from({length:256},(_,i)=>f(Math.sin(f(i*f(2*Math.PI/256)))));
const TWO_PI=f(2*Math.PI),K1T=f(2*Math.PI/5000),K1X=f(2*Math.PI/64),K2T=f(2*Math.PI/3500),K2X=f(2*Math.PI/26),K2Y=f(2*Math.PI/52),K3T=f(2*Math.PI/3000),K3Y=f(2*Math.PI/20);
const sinLut=(phase:number)=>SIN_LUT[(Math.trunc(f(f(phase*256)/TWO_PI))>>>0)&255];
/** CalculateWavesOnlyForCoordinate2: the three swells at an integer grid point, through the sin table. */
export function gameplayWaveAt(x:number,y:number,big:number,small:number,timeMs:number,waterTimeOffset:number,wavyness:number){
 const ax=Math.abs(x|0),ay=Math.abs(y|0),mult=f(f(WAVE_MULTIPLIERS_X[(ax>>1)&7]*WAVE_MULTIPLIERS_Y[(ay>>1)&7])*wavyness);
 const dt=((timeMs>>>0)-(waterTimeOffset>>>0))>>>0;
 const p1=f(f(f(ax*K1X)+f((dt%5000)*K1T))+f(ay*K1X)),p2=f(f(f(ax*K2X)+f((dt%3500)*K2T))+f(ay*K2Y)),p3=f(f(ay*K3Y)+f((dt%3000)*K3T));
 return f(f(f(f(2*mult)*big)*sinLut(p1))+f(f(mult*small)*sinLut(p2)))+f(f(f(.5*mult)*small)*sinLut(p3));
}
interface Vertex {x:number;y:number;z:number;big:number;small:number}
interface Polygon {kind:'quad'|'triangle';v:Vertex[];limitedDepth:boolean}
/** What GetWaterLevelNoWaves found: the surface and the polygon's wave amplitudes there. */
interface Found {z:number;big:number;small:number}
export class WaterLevelIndex {
 /** CTimer::GetTimeInMS, CWaterLevel::m_nWaterTimeOffset and CWeather::Wavyness, as the renderer last had them. */
 readonly waves={timeMs:0,waterTimeOffset:0,wavyness:0};
 /** m_QuadsAndTrianglesInEachBlock: each block's polygons, quads in file order then triangles. */
 private readonly blocks:Polygon[][]=Array.from({length:BLOCKS*BLOCKS},()=>[]);
 constructor(polygons:readonly WaterPolygon[]){
  // AddWaterLevelVertex: integer x and y, clamped to ±3000 with {z 0, big 1, small 0} outside.
  const vertex=(p:WaterPolygon['vertices'][number]):Vertex=>{
   const x=Math.trunc(p.position[0]),y=Math.trunc(p.position[1]);
   if(x<=-MAP_EDGE||x>=MAP_EDGE||y<=-MAP_EDGE||y>=MAP_EDGE)return {x:Math.max(-MAP_EDGE,Math.min(MAP_EDGE,x)),y:Math.max(-MAP_EDGE,Math.min(MAP_EDGE,y)),z:0,big:1,small:0};
   return {x,y,z:f(p.position[2]),big:f(p.bigWaves),small:f(p.smallWaves)};
  };
  const quads:Polygon[]=[],triangles:Polygon[]=[];
  for(const polygon of polygons){
   const v=polygon.vertices.map(vertex),limitedDepth=(polygon.flags&WATER_LIMITED_DEPTH)!==0;
   if(v.length===4){
    // AddWaterLevelQuad: not when all x or all y are equal; the two lowest y first, each pair by ascending x.
    if(v.every(p=>p.x===v[0].x)||v.every(p=>p.y===v[0].y))continue;
    const byY=[...v].sort((a,b)=>a.y-b.y),low=byY.slice(0,2).sort((a,b)=>a.x-b.x),high=byY.slice(2).sort((a,b)=>a.x-b.x);
    quads.push({kind:'quad',v:[low[0],low[1],high[0],high[1]],limitedDepth});
   }else if(v.length===3){
    // AddWaterLevelTriangle: the two sharing a y are v0 and v1 by ascending x; the third is v2.
    const pair=[[0,1,2],[0,2,1],[1,2,0]].find(([a,b])=>v[a].y===v[b].y);if(!pair)continue;
    const [a,b]=[v[pair[0]],v[pair[1]]].sort((p,q)=>p.x-q.x);
    triangles.push({kind:'triangle',v:[a,b,v[pair[2]]],limitedDepth});
   }
  }
  // FillQuadsAndTrianglesList: strict overlap with each block, quads first.
  for(let bx=0;bx<BLOCKS;bx++)for(let by=0;by<BLOCKS;by++){
   const minX=bx*BLOCK-MAP_EDGE,maxX=minX+BLOCK,minY=by*BLOCK-MAP_EDGE,maxY=minY+BLOCK,list=this.blocks[bx*BLOCKS+by];
   for(const q of quads){const [v0,v1,v2]=q.v;if(v1.x>minX&&v0.x<maxX&&v2.y>minY&&v0.y<maxY)list.push(q);}
   for(const t of triangles){const [v0,v1,v2]=t.v;if(Math.min(v0.y,v2.y)<maxY&&v0.x<maxX&&v1.x>minX&&Math.max(v0.y,v2.y)>minY)list.push(t);}
  }
 }
 /** GetWaterLevelNoWaves: the first polygon of the point's block that holds it, and (with a z) passes the z window.
  * Beyond the map's ±3000 it is open sea at 0. `waves` is whether the amplitudes are asked for, which alone turns the
  * window on for a quad (the executable's quirk: only GetWaterLevel asks). */
 private noWaves(x:number,y:number,z:number|undefined,waves:boolean):Found|undefined{
  const bx=Math.floor(f(x/BLOCK)+6),by=Math.floor(f(y/BLOCK)+6);
  if(bx<0||bx>=BLOCKS||by<0||by>=BLOCKS)return {z:0,big:1,small:0};
  for(const p of this.blocks[bx*BLOCKS+by]){const found=p.kind==='quad'?testQuad(p,x,y,z,waves):testTriangle(p,x,y,z);if(found)return found;}
  return undefined;
 }
 /** GetWaterLevelNoWaves for an outside caller (no amplitudes asked): the surface under the native point, if any. */
 levelNoWaves(x:number,y:number,z?:number){return this.noWaves(x,y,z,false)?.z;}
 /** GetWaterLevel: the surface with AddWaveToResult's swell, if there is water. With a z, water more than 20 under it,
  * or limited-depth water more than 6 over it, does not count, and unless the caller is touching the water (most are)
  * a surface more than 3 over it is none either. */
 level(x:number,y:number,z?:number,touchingWater=true){
  const found=this.noWaves(x,y,z,true);if(!found)return undefined;
  if(z!==undefined&&!touchingWater&&found.z-z>3)return undefined;
  const {timeMs,waterTimeOffset,wavyness}=this.waves;if(!wavyness||!found.big&&!found.small)return found.z;
  // AddWaveToResult: the 2-unit cell's triangle the point is in, its three corners' swell planar-interpolated.
  const hx=f(x*.5),fx=Math.floor(hx),u=f(hx-fx),hy=f(y*.5),fy=Math.floor(hy),t=f(hy-fy),X=fx*2,Y=fy*2;
  const wave=(wx:number,wy:number)=>gameplayWaveAt(wx,wy,found.big,found.small,timeMs,waterTimeOffset,wavyness);
  if(u+t<1){const w0=wave(X,Y),w1=wave(X+2,Y),w2=wave(X,Y+2);return found.z+w0+u*(w1-w0)+t*(w2-w0);}
  const w0=wave(X+2,Y+2),w1=wave(X,Y+2),w2=wave(X+2,Y);return found.z+w0+(1-u)*(w1-w0)+(1-t)*(w2-w0);
 }
}
/** TestQuadToGetWaterLevel: an inclusive box, then two planes split along v1–v2. */
function testQuad(p:Polygon,x:number,y:number,z:number|undefined,waves:boolean):Found|undefined{
 const [v0,v1,v2,v3]=p.v;
 if(v0.x>x||v1.x<x||v0.y>y||v2.y<y)return undefined;
 const u=f((x-v0.x)/(v1.x-v0.x)),t=f((y-v0.y)/(v2.y-v0.y));
 const field=(k:'z'|'big'|'small')=>u+t>1?v3[k]+(1-u)*(v2[k]-v3[k])+(1-t)*(v1[k]-v3[k]):v0[k]+u*(v1[k]-v0[k])+t*(v2[k]-v0[k]);
 const found={z:field('z'),big:waves?field('big'):0,small:waves?field('small'):0};
 if(waves&&z!==undefined){
  if(found.z-6>z){if(p.limitedDepth)return undefined;}
  else if(found.z+20<z)return undefined;
 }
 return found;
}
/** TestTriangleToGetWaterLevel: right triangles, with the right angle at v0 (v2 above or below it) or at v1; the z
 * window always applies. */
function testTriangle(p:Polygon,x:number,y:number,z:number|undefined):Found|undefined{
 const [v0,v1,v2]=p.v;
 if(v0.x>x||v1.x<x||Math.min(v0.y,v2.y)>y||Math.max(v0.y,v2.y)<y)return undefined;
 const u=f((x-v0.x)/(v1.x-v0.x)),t=f((y-v0.y)/(v2.y-v0.y));
 let field:(k:'z'|'big'|'small')=>number;
 if(v0.x===v2.x){if(u+t>1)return undefined;field=k=>v0[k]+u*(v1[k]-v0[k])+t*(v2[k]-v0[k]);}
 else{if(u<t)return undefined;field=k=>v1[k]+(1-u)*(v0[k]-v1[k])+t*(v2[k]-v1[k]);}
 const found={z:field('z'),big:field('big'),small:field('small')};
 if(z!==undefined){if(found.z-6>z&&p.limitedDepth)return undefined;if(found.z+20<z)return undefined;}
 return found;
}
