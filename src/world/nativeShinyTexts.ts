/* CTrafficLights::DisplayActualLight's pedestrian signal and CShinyTexts (gta-reversed ead3051). Four traffic light
 * models carry a walk / don't-walk sign: two corner points in entity space (MI_TRAFFICLIGHTS (0.713, 1.262 on x
 * 2.673), MI_TRAFFICLIGHTS_4 and _GAY, MI_TRAFFICLIGHTS_5) span the sign, whose raster (`handman`) holds the red hand
 * on its left half and the walking man on its right. CTrafficLights::LightForPeds runs on the clock: (ms / 2) & 16383
 * under 12000 is red, under 15383 green, then a short yellow; the red half draws for red, the green half for green or
 * while bit 0x100 of the time is set (the man blinks through the yellow). CShinyTexts::RegisterOne keeps a sign within
 * 60 units of the camera and fades its colour to nothing over the second half of that range; CShinyTexts::Render draws
 * the quads additively (ONE, ONE) with the raster and the vertex colour, no depth write. Native world space, z up. */
import {TRAFFIC_LIGHT,type TrafficLightState} from './nativeTrafficLights';
export type V3=[number,number,number];
export const PED_SIGNAL_MAX_DISTANCE=60;
/** CTrafficLights::LightForPeds. */
export function lightForPeds(milliseconds:number):TrafficLightState{
 const masked=(Math.floor(milliseconds/2)>>>0)&16383;
 if(masked<12000)return TRAFFIC_LIGHT.red;
 if(masked<16383-1000)return TRAFFIC_LIGHT.green;
 return TRAFFIC_LIGHT.yellow;
}
/** The sign's two corners in entity space per traffic light model (lowercase names), or undefined. */
export function pedSignalCorners(modelName:string|undefined):[V3,V3]|undefined{
 switch(modelName?.toLowerCase()){
  case 'cj_traffic_light4':case 'gay_traffic_light':return [[.189,-.157,1.848],[-.141,-.157,1.607]];
  case 'cj_traffic_light5':return [[.222,-.261,1.867],[-.044,-.261,1.561]];
  case 'trafficlight1':return [[2.673,.713,-.127],[2.673,1.262,-.539]];
 }
 return undefined;
}
export interface ShinyQuad {corners:[V3,V3,V3,V3];uv:[number,number,number,number,number,number,number,number];colour:[number,number,number]}
const transform=(m:readonly number[],p:V3):V3=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
/** CShinyTexts::RegisterOne's distance fade: full colour to half the range, then linearly to nothing. */
export function shinyFade(distance:number,maxDistance:number){
 if(distance>maxDistance)return undefined;
 const half=maxDistance/2;return half<distance?1-(distance-half)/half:1;
}
/** The pedestrian sign quad of a traffic light entity this frame, if its model carries one and it is in range. */
export function pedSignalQuad(entity:{name?:string;matrix:readonly number[]},milliseconds:number,camera:readonly number[]):ShinyQuad|undefined{
 const corners=pedSignalCorners(entity.name);if(!corners)return undefined;
 const [c1,c2]=corners,mid:V3=[(c1[0]+c2[0])/2,(c1[1]+c2[1])/2,(c1[2]+c2[2])/2];
 const state=lightForPeds(milliseconds);
 let local:[V3,V3,V3,V3],uv:ShinyQuad['uv'],colour:[number,number,number];
 if(state===TRAFFIC_LIGHT.red){
  local=[[c2[0],c2[1],c1[2]],[mid[0],mid[1],c1[2]],[c2[0],c2[1],c2[2]],[mid[0],mid[1],c2[2]]];uv=[.5,0,0,0,.5,1,0,1];colour=[255,0,0];
 }else if(state===TRAFFIC_LIGHT.green||((Math.floor(milliseconds)>>>0)&0x100)){
  local=[[mid[0],mid[1],c1[2]],[c1[0],c1[1],c1[2]],[mid[0],mid[1],c2[2]],[c1[0],c1[1],c2[2]]];uv=[1,0,.5,0,1,1,.5,1];colour=[255,255,255];
 }else return undefined;
 const world=local.map(p=>transform(entity.matrix,p)) as [V3,V3,V3,V3];
 const fade=shinyFade(Math.hypot(camera[0]-world[0][0],camera[1]-world[0][1],camera[2]-world[0][2]),PED_SIGNAL_MAX_DISTANCE);
 if(fade===undefined)return undefined;
 return {corners:world,uv,colour:colour.map(c=>Math.trunc(c*fade)) as [number,number,number]};
}
