/** Points where sea-level land would show the reflection: within 250 units it is gone, fading in over the next 100. */
const SHORES=[[611,875],[-929,2364],[-1034,2640],[2372,-1854],[-1633,106]] as const;
/** REFLECTION_SIZE and REFLECTION_PERIOD. */
const SIZE=60,PERIOD=2048;
export interface SunReflectionInput {
 /** CTimeCycle::m_VectorToSun, native. */
 toSun:readonly [number,number,number];
 camera:readonly [number,number,number];
 /** CWeather::CloudCoverage, Foggyness and Wind. */
 cloudCoverage:number;foggyness:number;wind:number;
 /** m_nSunCore and m_nSunCorona (timecyc bytes). */
 sunCore:readonly [number,number,number];sunCorona:readonly [number,number,number];
 /** CTimer::GetTimeInMS. */
 timeMs:number;
}
export interface SunReflectionStrip {
 /** Native positions, three per vertex. */
 positions:Float32Array;uvs:Float32Array;indices:Uint16Array;
 color:[number,number,number];
}
/** CCoronas::RenderSunReflection (0x6FBAA0): a strip on the sea from 40 units toward the sun out to about 1.4 km,
 * brightest with the sun a quarter up, textured with `coronaheadlightline` and shimmering with 20 widths on a 2048 ms
 * cycle. Returns nothing when the sun is down, too high or hidden by weather. */
export function sunReflection(input:SunReflectionInput):SunReflectionStrip|undefined{
 const [sx,sy,sz]=input.toSun,cam=input.camera;
 if(sz<=-.05)return undefined;
 let t=(.3-Math.abs(sz-.25))/.3*(1-input.cloudCoverage)*(1-input.foggyness)*(1-input.wind);
 if(t<=0)return undefined;
 for(const [x,y] of SHORES)t*=Math.min(Math.max((Math.hypot(cam[0]-x,cam[1]-y)-250)/100,0),1);
 t*=.25;
 const cx=sx*40+cam[0],cy=sy*40+cam[1],l=Math.hypot(sx,sy)||1,dx=sx/l,dy=sy/l,z=input.wind*.5+.1;
 const color=[0,1,2].map(i=>Math.trunc((input.sunCorona[i]+input.sunCore[i])*t)&255) as [number,number,number];
 const positions=new Float32Array(44*3),uvs=new Float32Array(44*2),indices=new Uint16Array(126);
 let v=0,n=0;
 const push=(ox:number,oy:number,u:number,w:number)=>{positions.set([cx+ox,cy+oy,z],v*3);uvs.set([u,w],v*2);v++;};
 // GetPerpRight is (y, −x) and GetPerpLeft (−y, x). The quad nearest the camera spans the texture's lower half.
 const core=SIZE/2,corona=SIZE;
 indices.set([2,1,0,2,3,1],n);n+=6;
 push(dy*core,-dx*core,0,1);push(-dy*core,dx*core,1,1);
 push(dx*corona+dy*core,dy*corona-dx*core,0,.5);push(dx*corona-dy*core,dy*corona+dx*core,1,.5);
 // Twenty more pairs, each joined to the last, widening and swaying to look like moving water.
 const time=input.timeMs>>>0;
 for(let i=0;i<20;i++){
  indices.set([v,v-1,v-2,v,v+1,v-1],n);n+=6;
  const width=Math.sin(((time+900*i)%PERIOD)/PERIOD*2*Math.PI)*10+(Math.trunc(i*970/20)+30),along=Math.trunc(i*1440/20)+60;
  push(dx*along+dy*width,dy*along-dx*width,0,.5);push(dx*along-dy*width,dy*along+dx*width,1,.5);
 }
 return {positions,uvs,indices,color};
}
