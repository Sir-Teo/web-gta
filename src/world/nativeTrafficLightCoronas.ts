import type {Model2dEffect} from '../assets/twoDEffect';
import type {NativeCoronas} from './nativeCoronas';
import type {LightPool} from './nativeEntityLights';
import {TRAFFIC_LIGHT,type TrafficLightState} from './nativeTrafficLights';
import {BRIGHT_LIGHT,type NativeBrightLights} from './nativeBrightLights';

/** CTrafficLights::IsMITrafficLight's models (ModelIndices.cpp), lowercased. */
export const TRAFFIC_LIGHT_MODELS=new Set(['trafficlight1','mtraffic4','mtraffic1','vgsstriptlights1','mtraffic2','cj_traffic_light3','cj_traffic_light4','cj_traffic_light5','gay_traffic_light']);
/** MI_TRAFFICLIGHTS_3/4/5, _GAY and _MIAMI: their lit lenses are CBrightLights' small octagons. */
const SMALL_LENS_MODELS=new Set(['cj_traffic_light3','cj_traffic_light4','cj_traffic_light5','gay_traffic_light','mtraffic1']);
/** eTrafficLightsDirection. */
export const TRAFFIC_DIRECTION={northSouth:1,westEast:2} as const;

/** CTrafficLights::FindTrafficLightType (0x49D580): the pole's forward in degrees, CGeneral::GetATanOfXY. */
export function trafficLightType(matrix:readonly number[]){
 let o=Math.atan2(matrix[5],matrix[4])*180/Math.PI;if(o<0)o+=360;
 return (o<=60||o>=150)&&(o<=240||o>=330)?TRAFFIC_DIRECTION.westEast:TRAFFIC_DIRECTION.northSouth;
}
export interface TrafficLightFrame {
 /** LightForCars1_Visual and LightForCars2_Visual. */
 visual:readonly [TrafficLightState,TrafficLightState];
 /** TheCamera's forward, native. */
 cameraForward:readonly [number,number,number];camera:readonly [number,number,number];
 /** m_fSpriteBrightness and m_fSpriteSize (timecyc ×10). */
 spriteBrightness:number;spriteSize:number;
 /** m_fLightsOnGroundBrightness (timecyc ×10) and CWeather::TrafficLightsBrightness. */
 lightsOnGroundBrightness:number;trafficLightsBrightness:number;
}
/** CTrafficLights::DisplayActualLight (0x49DAB0), from CEntity::PreRender for traffic light models: the lit colour of
 * the phase for the pole's direction, on the side facing the camera, its lens (CBrightLights::RegisterOne), and a pool
 * of that colour below the lamps. aTrafficLightColoursR/G/B (0x8A6214) are exe data gta-reversed does not carry, so
 * each lamp's own 2d effect colour stands in. Point lights are not ported. */
export function displayActualLight(entity:{id:number;name?:string;matrix:readonly number[];effects:readonly Model2dEffect[]},frame:TrafficLightFrame,coronas:NativeCoronas,bright?:NativeBrightLights):LightPool[]{
 const m=entity.matrix;if(m[10]<.96)return [];
 const lensBase=entity.name&&SMALL_LENS_MODELS.has(entity.name)?BRIGHT_LIGHT.greenSmall:BRIGHT_LIGHT.greenBig;
 const state=frame.visual[trafficLightType(m)===TRAFFIC_DIRECTION.northSouth?0:1];
 const sameDir=frame.cameraForward[0]*m[4]+frame.cameraForward[1]*m[5]+frame.cameraForward[2]*m[6]>0;
 const center=[0,0,0];let lit:[number,number,number]|undefined;
 entity.effects.forEach((effect,i)=>{
  const light=effect.light;if(!light)return;
  const p=effect.position,world:[number,number,number]=[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
  center[0]+=world[0];center[1]+=world[1];center[2]+=world[2];
  const colorState=light.color[0]>200?light.color[1]>100?TRAFFIC_LIGHT.yellow:TRAFFIC_LIGHT.red:TRAFFIC_LIGHT.green;
  if(colorState===state)lit??=[light.color[0],light.color[1],light.color[2]];
  if(sameDir===p[1]>0||colorState!==state)return;
  const brightness=frame.spriteBrightness*.07;
  coronas.register({id:entity.id+i,color:[Math.trunc(light.color[0]*brightness)&255,Math.trunc(light.color[1]*brightness)&255,Math.trunc(light.color[2]*brightness)&255],intensity:255,
   position:world,size:frame.spriteSize*.175,range:50,reflection:true,pullTowardsCamera:1.5,fadeSpeed:15},frame.camera);
  // The lens faces along the pole: RegisterOne takes its up and right.
  bright?.registerOne(world,[m[8],m[9],m[10]],[m[0],m[1],m[2]],state+lensBase,frame.camera);
 });
 if(!entity.effects.length||state===TRAFFIC_LIGHT.off||frame.trafficLightsBrightness<=.05||!lit)return [];
 // vecCenter /= m_n2dfxCount: every effect counts, not only the lights.
 const n=entity.effects.length,mult=frame.lightsOnGroundBrightness*frame.trafficLightsBrightness/80;
 return [{id:entity.id+255,position:[center[0]/n,center[1]/n,center[2]/n],size:8,color:[Math.trunc(lit[0]*mult)&255,Math.trunc(lit[1]*mult)&255,Math.trunc(lit[2]*mult)&255],intensity:128,maxHeight:12}];
}
