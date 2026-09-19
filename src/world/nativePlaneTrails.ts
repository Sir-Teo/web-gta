import type {NativeCoronas} from './nativeCoronas';
type Vec3=[number,number,number];
/** POINT_EXPIRATION_TIME and PLANE_TRAIL_BUF_SIZE. */
const EXPIRY=30000,POINTS=16;

/** CPlaneTrail (PlaneTrail.cpp, reversed): sixteen positions, one every 2 s, newest first. */
export class PlaneTrail {
 readonly positions:Vec3[]=Array.from({length:POINTS},()=>[0,0,0]);
 /** m_Timepoints: 0 marks a point not in use. */
 readonly timepoints=new Array<number>(POINTS).fill(0);
 /** CPlaneTrail::RegisterPoint (0x7172D0). */
 registerPoint(pos:Vec3,now:number){
  const shift=this.timepoints[0]!==0&&now-this.timepoints[0]>2000;
  if(shift){for(let i=POINTS-1;i>0;i--){this.timepoints[i]=this.timepoints[i-1];this.positions[i]=this.positions[i-1];}}
  this.positions[0]=[...pos];
  if(shift||this.timepoints[0]===0)this.timepoints[0]=now;
 }
 /** CPlaneTrail::Render (0x717180): points younger than 30 s as white vertices, fading over their last 10 s. Expired
  * points are cleared. Returns the line list the original draws: its fixed indices join the first `n` vertices in
  * buffer order, whichever points they are. */
 render(intensity:number,now:number){
  const maxAlpha=Math.trunc(intensity*110),vertices:{position:Vec3;alpha:number}[]=[];
  if(!maxAlpha)return [];
  const buffer:({position:Vec3;alpha:number}|undefined)[]=[];
  for(let i=0;i<POINTS;i++){
   const delta=(now-this.timepoints[i])>>>0;
   if(this.timepoints[i]!==0&&delta<=EXPIRY){buffer[i]={position:this.positions[i],alpha:Math.trunc(maxAlpha*Math.min(1,(EXPIRY-delta)/10000))};vertices.push(buffer[i]!);}
   else this.timepoints[i]=0;
  }
  // RwIm3DTransform(vertBuff, nvert): the first nvert slots of the buffer, set or not.
  const lines:{from:{position:Vec3;alpha:number};to:{position:Vec3;alpha:number}}[]=[];
  for(let i=0;i+1<vertices.length;i++){const a=buffer[i],b=buffer[i+1];if(a&&b)lines.push({from:a,to:b});}
  return lines;
 }
}
/** The lit hours. gta-reversed's CClock::ClockHoursInRange helper tests `hour > after && hour < before`, which no hour
 * passes for these night ranges (22 to 7 and so on), so it is read as wrapping past midnight with the same strictness. */
const hoursInRange=(hour:number,after:number,before:number)=>after>before?hour>after||hour<before:hour>after&&hour<before;
/** CPlaneTrails::Update's three sky planes: centre scale, light colour, corona id, blink offset and lit hours. */
const PLANES:{pos:Vec3;color:[number,number,number];id:number;offset:number;after:number;before:number}[]=[
 {pos:[2590,2200,550],color:[255,0,0],id:101,offset:0,after:22,before:7},
 {pos:[2000,-2600,500],color:[255,255,128],id:102,offset:350,after:21,before:7},
 {pos:[2100,1300,600],color:[255,255,255],id:103,offset:200,after:20,before:6},
];
/** CPlaneTrails (PlaneTrails.cpp, reversed): three distant planes circling the map every 131 s at 500 to 600 units, each
 * leaving a contrail and, at night, a light that blinks every 512 ms. Positions are native. */
export class NativePlaneTrails {
 readonly trails=PLANES.map(()=>new PlaneTrail());
 /** CPlaneTrails::Update (0x7174F0) with CPlaneTrail::Update. */
 update(now:number,hour:number,coronas:NativeCoronas,camera:Vec3){
  now>>>=0;
  const t=(now%131072)/20860;
  PLANES.forEach((plane,i)=>{
   const pos:Vec3=[plane.pos[0]*Math.sin(t),plane.pos[1]*Math.cos(t),plane.pos[2]];
   this.trails[i].registerPoint(pos,now);
   if(!hoursInRange(hour,plane.after,plane.before))return;
   // CORONATYPE_HEADLIGHT is the coronastar raster too.
   if(((now+plane.offset)>>>0)&512)coronas.register({id:plane.id,color:plane.color,intensity:255,position:pos,size:5,range:2000,flareType:0,reflection:false,pullTowardsCamera:1.5,fadeSpeed:15},camera);
   else coronas.updateCoors(plane.id,pos,2000,camera);
  });
 }
 /** CPlaneTrails::Render (0x7173A0): the brightest sky-bottom channel, cut by cloud, fog and rain, sets the alpha. */
 render(skyBottom:readonly [number,number,number],weather:{cloudCoverage:number;foggyness:number;rain:number},now:number){
  const intensity=Math.min(Math.max(...skyBottom)/255,1-weather.cloudCoverage,1-weather.foggyness,1-weather.rain);
  if(intensity<=.0001)return [];
  return this.trails.flatMap(trail=>trail.render(intensity,now>>>0));
 }
}
