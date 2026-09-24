import type {WaterPolygon} from '../assets/water';
import {calculateWavesOnlyForCoordinate} from './waterWaves';
const CELL=250;
/** Native-coordinate water heights from WATER.DAT. CWaterLevel::GetWaterLevelNoWaves is not reversed;
 * quads interpolate their four corners bilinearly and triangles use their plane.
 *
 * CWaterLevel::GetWaterLevel (0x6EB690) then calls AddWaveToResult (0x6E81E0), which is not reversed either. The
 * stand-in adds the swell the water is drawn with (src/world/waterWaves.ts): CalculateWavesOnlyForCoordinate at the
 * corners of the 2-unit grid cell, spread over the same two triangles the detailed patch draws, so what floats and
 * swims rides the surface on screen. The vertex amplitudes are the polygon's at the point. */
export class WaterLevelIndex {
 /** CTimer::GetTimeInMS, CWaterLevel::m_nWaterTimeOffset and CWeather::Wavyness, as the renderer last had them. */
 readonly waves={timeMs:0,waterTimeOffset:0,wavyness:0};
 private cells=new Map<string,number[]>();
 private shapes:{minX:number;minY:number;maxX:number;maxY:number;level:(x:number,y:number)=>number|undefined;amplitudes:(x:number,y:number)=>[number,number]}[]=[];
 constructor(polygons:readonly WaterPolygon[]){
  for(const polygon of polygons){
   const v=polygon.vertices.map(p=>p.position),xs=v.map(p=>p[0]),ys=v.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
   if(!(maxX>minX&&maxY>minY))continue;
   const big=polygon.vertices.map(p=>p.bigWaves),small=polygon.vertices.map(p=>p.smallWaves);
   let level:(x:number,y:number)=>number|undefined,amplitudes:(x:number,y:number)=>[number,number];
   if(v.length===4){
    const corner=(cx:number,cy:number)=>v.reduce((best,p,i)=>Math.hypot(v[i][0]-cx,v[i][1]-cy)<Math.hypot(v[best][0]-cx,v[best][1]-cy)?i:best,0);
    const i00=corner(minX,minY),i10=corner(maxX,minY),i01=corner(minX,maxY),i11=corner(maxX,maxY);
    const lerp=(f:readonly number[],x:number,y:number)=>{const u=(x-minX)/(maxX-minX),t=(y-minY)/(maxY-minY);return (f[i00]*(1-u)+f[i10]*u)*(1-t)+(f[i01]*(1-u)+f[i11]*u)*t;};
    const z=v.map(p=>p[2]);level=(x,y)=>lerp(z,x,y);amplitudes=(x,y)=>[lerp(big,x,y),lerp(small,x,y)];
   }else{
    const [a,b,c]=v,det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(det)<1e-9)continue;
    const weights=(x:number,y:number)=>{const l1=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/det,l2=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/det;return [l1,l2,1-l1-l2];};
    level=(x,y)=>{const [l1,l2,l3]=weights(x,y);return l1<-1e-6||l2<-1e-6||l3<-1e-6?undefined:l1*a[2]+l2*b[2]+l3*c[2];};
    amplitudes=(x,y)=>{const w=weights(x,y);return [w[0]*big[0]+w[1]*big[1]+w[2]*big[2],w[0]*small[0]+w[1]*small[1]+w[2]*small[2]];};
   }
   const index=this.shapes.push({minX,minY,maxX,maxY,level,amplitudes})-1;
   for(let cx=Math.floor(minX/CELL);cx<=Math.floor(maxX/CELL);cx++)for(let cy=Math.floor(minY/CELL);cy<=Math.floor(maxY/CELL);cy++){const key=`${cx},${cy}`;let list=this.cells.get(key);if(!list)this.cells.set(key,list=[]);list.push(index);}
  }
 }
 /** GetWaterLevelNoWaves: the highest water surface containing the native point, if any. */
 levelNoWaves(x:number,y:number){return this.find(x,y)?.z;}
 /** GetWaterLevel: the surface with the swell added. */
 level(x:number,y:number){
  const found=this.find(x,y);if(!found)return;
  const {timeMs,waterTimeOffset,wavyness}=this.waves;if(!wavyness)return found.z;
  const [big,small]=found.shape.amplitudes(x,y);if(!big&&!small)return found.z;
  const wave=(wx:number,wy:number)=>calculateWavesOnlyForCoordinate(wx,wy,big,small,timeMs,waterTimeOffset,wavyness);
  // The detailed patch's cell: (x0,y0),(x1,y0),(x0,y1) and (x0,y1),(x1,y0),(x1,y1).
  const x0=2*Math.floor(x/2),y0=2*Math.floor(y/2),u=(x-x0)/2,t=(y-y0)/2,w10=wave(x0+2,y0),w01=wave(x0,y0+2);
  return found.z+(u+t<=1?wave(x0,y0)*(1-u-t)+w10*u+w01*t:wave(x0+2,y0+2)*(u+t-1)+w10*(1-t)+w01*(1-u));
 }
 private find(x:number,y:number){
  let z:number|undefined,shape:WaterLevelIndex['shapes'][number]|undefined;
  for(const index of this.cells.get(`${Math.floor(x/CELL)},${Math.floor(y/CELL)}`)??[]){const s=this.shapes[index];if(x<s.minX||x>s.maxX||y<s.minY||y>s.maxY)continue;const h=s.level(x,y);if(h!==undefined&&(z===undefined||h>z)){z=h;shape=s;}}
  return z===undefined?undefined:{z,shape:shape!};
 }
}
