import {LIGHT_FLAG,type Model2dEffect} from '../assets/twoDEffect';
import type {NativeCoronas} from './nativeCoronas';

/** CEntity::ProcessLightsForEntity's randomSeedRandomiser (0x8D5028). */
const SEED_RANDOMISER=[0,27034,43861,52326,64495,38437,21930,39117];
/** FADE_RATE (0x872538). */
const FADE_RATE=.0009;
/** The world state a frame's lights read. */
export interface EntityLightFrame {
 /** CTimer::GetTimeInMS and GetFrameCounter. */
 timeMs:number;frame:number;
 /** GetDayNightBalance: 1 by night. */
 dayNightBalance:number;
 /** CWeather::WetRoads and Rain. */
 wetRoads:number;rain:number;
 /** CTimeCycle::m_CurrentColours.m_fSpriteBrightness. */
 spriteBrightness:number;
 camera:readonly [number,number,number];
 /** CGeneral::GetRandomNumber, 0..32767. */
 rand:()=>number;
 /** CWeather::SunGlare (below 0 off), CTimeCycle::m_VectorToSun and m_CurrentColours' sun core, for EFFECT_SUN_GLARE. */
 sunGlare?:{amount:number;vectorToSun:readonly [number,number,number];sunCore:readonly [number,number,number]};
}
/** A placed entity with 2d effects. `matrix` is its column-major native world matrix (the IPL rotation and position). */
export interface LitEntity {
 /** A unique base for the corona ids of its effects (`(uint32)this + C`). */
 id:number;
 /** m_nRandomSeed. */
 seed:number;
 /** The model's name, lowercased. */
 name?:string;
 matrix:readonly number[];
 effects:readonly Model2dEffect[];
}
/** A light pool CShadows::StoreStaticShadow keeps under a lit effect (SHADOW_ADDITIVE). */
export interface LightPool {id:number;position:[number,number,number];size:number;color:[number,number,number];intensity:number;maxHeight:number;
 /** A rotated footprint (native 2D front and side half-vectors) instead of the `size` square, and its own camera cut-off. */
 front?:[number,number];side?:[number,number];maxDistance?:number}

const transform=(m:readonly number[],p:readonly number[]):[number,number,number]=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];

/** CEntity::ProcessLightsForEntity (0x6FC7A0) for the light effects: the flash modes, day and night fading and the
 * corona each registers. Returns the light pools to store. Point lights and fog-only lights are not ported. */
const EFFECT_SUN_GLARE=4;
/** CPointLights::AddLight's PLTYPE_POINTLIGHT from a lit 2d effect (colours 0..255 scaled, generateShadows set). */
export interface EntityPointLight {position:[number,number,number];radius:number;color:[number,number,number]}
/** `pointLights`, when given, collects the point lights the effects add (their lighting of the world is not ported;
 * CShadows::RenderExtraPlayerShadows reads them). */
export function processLightsForEntity(entity:LitEntity,frame:EntityLightFrame,coronas:NativeCoronas,pointLights?:EntityPointLight[]):LightPool[]{
 const pools:LightPool[]=[];
 // Objects tipped more than about 16° are skipped (m_matrix->GetUp().z < 0.96).
 if(entity.matrix[10]<.96)return pools;
 const time=frame.timeMs>>>0,balance=frame.dayNightBalance;
 entity.effects.forEach((effect,C)=>{
  // EFFECT_SUN_GLARE: a coronastar where the sun would glint off the effect towards the camera, sized by the square
  // root of the camera distance and brightened by the square root of the reflection's alignment with the sun.
  if(effect.type===EFFECT_SUN_GLARE){
   const glare=frame.sunGlare;if(!glare||glare.amount<0)return;
   const at=transform(entity.matrix,effect.position),origin=[entity.matrix[12],entity.matrix[13],entity.matrix[14]];
   let dir=[at[0]-origin[0],at[1]-origin[1],at[2]-origin[2]];const norm=(v:number[])=>{const l=Math.hypot(v[0],v[1],v[2]);return l>0?v.map(x=>x/l):[1,0,0];};dir=norm(dir);
   const cam=[frame.camera[0]-at[0],frame.camera[1]-at[1],frame.camera[2]-at[2]],dist=Math.hypot(cam[0],cam[1],cam[2]),scale=2/dist,toward=cam.map(x=>x*scale);
   dir=norm([dir[0]+toward[0],dir[1]+toward[1],dir[2]+toward[2]]);
   const alignment=-(dir[0]*glare.vectorToSun[0]+dir[1]*glare.vectorToSun[1]+dir[2]*glare.vectorToSun[2]);
   if(alignment<=0)return;
   const g=Math.sqrt(alignment)*glare.amount,radius=Math.sqrt(dist)*glare.amount*.5;
   coronas.register({id:entity.id+C,color:[0,1,2].map(i=>Math.trunc((glare.sunCore[i]+510)*g/3)&255) as unknown as [number,number,number],intensity:255,
    position:[at[0]+toward[0],at[1]+toward[1],at[2]+toward[2]],size:radius,range:120,pullTowardsCamera:1.5,fadeSpeed:15},frame.camera);
   return;
  }
  const light=effect.light;if(!light)return;
  const seed=(entity.seed^SEED_RANDOMISER[C%8])&0xffff;
  const position=transform(entity.matrix,effect.position),flags=light.flags;
  let timeFade=1,applyLight=false,applyOffVersion=false,applyOnVersion=false,updateCoors=false,lightFade=1;
  const atDay=!!(flags&LIGHT_FLAG.atDay),atNight=!!(flags&LIGHT_FLAG.atNight);
  if(atDay&&atNight)applyOffVersion=true;
  else if(atDay&&balance<1){applyOffVersion=true;lightFade=1-balance;}
  else if(atNight&&balance>0){applyOffVersion=true;lightFade=balance;}
  const flash=light.flashType;
  if(flash===2&&frame.wetRoads>.5||applyOffVersion){
   switch(flash){
    case 0:applyLight=true;break;
    case 1:case 2:
     if((time^seed)&0x60)applyLight=true;else applyOnVersion=true;
     if((seed^Math.floor(time/4096))&3)applyLight=true;
     break;
    case 3:if(((time+C*128)&0x200)===0)updateCoors=true;else applyLight=true;break;
    case 4:if(((time+C*256)&0x400)===0)updateCoors=true;else applyLight=true;break;
    case 5:if(((time+C*512)&0x800)===0)updateCoors=true;else applyLight=true;break;
    case 6:
     if((seed&255)>0x10){applyLight=true;break;}
     if((time^(seed*8))&0x60)applyLight=true;else applyOnVersion=true;
     if((seed^Math.floor(time/4096))&3)applyLight=true;
     break;
    // FLASH_TRAINCROSSING needs an enabled crossing object; FLASH_UNUSED the bridge.
    case 8:break;
    case 9:break;
    case 10:if(frame.rain>.0001){timeFade=frame.rain;applyLight=true;}break;
    case 11:case 12:case 13:{
     applyLight=true;
     let offset=(time+3333*(flash-11))>>>0;
     offset=(offset+(Math.trunc(entity.matrix[12]*20)>>>0))>>>0;offset=(offset+(Math.trunc(entity.matrix[13]*10)>>>0))>>>0;
     // Nine 1111 ms phases of a 10 s cycle: fade in, two lit, fade out, five dark. gta-reversed's
     // `9 * (offset % 10000 / 10000)` is always 0 in integers; the phase length (1111 × FADE_RATE ≈ 1) shows the intent.
     const mode=Math.trunc(9*(offset%10000)/10000),fade=(offset%10000-1111*mode)*FADE_RATE;
     if(mode===0)timeFade=fade;else if(mode===1||mode===2)timeFade=1;else if(mode===3)timeFade=1-fade;else applyLight=false;
     break;
    }
    // FLASH_TRAFFICLIGHT (7) is lit by the traffic light code, not here.
    default:break;
   }
  }
  const id=entity.id+C;
  let skip=false;
  if(applyLight){
   let canCreate=true;
   if(flags&LIGHT_FLAG.checkDirection){
    const m=entity.matrix,o=light.offset,dir=[m[0]*o[0]+m[4]*o[1]+m[8]*o[2],m[1]*o[0]+m[5]*o[1]+m[9]*o[2],m[2]*o[0]+m[6]*o[1]+m[10]*o[2]];
    canCreate=dir[0]*(frame.camera[0]-position[0])+dir[1]*(frame.camera[1]-position[1])+dir[2]*(frame.camera[2]-position[2])>=0;
   }
   if(canCreate){
    skip=true;
    let brightness=timeFade;
    if(flags&LIGHT_FLAG.blinking1)brightness=(1-(frame.rand()%32)*.012)*timeFade;
    if(flags&LIGHT_FLAG.blinking2&&((frame.frame+seed)&3))brightness=0;
    if(flags&LIGHT_FLAG.blinking3&&((frame.frame+seed)&0x3f)){brightness=((frame.frame+seed)&0x3f)===1?brightness*.5:0;}
    timeFade=frame.spriteBrightness*brightness/10;
    coronas.register({id,color:[Math.trunc(light.color[0]*timeFade)&255,Math.trunc(light.color[1]*timeFade)&255,Math.trunc(light.color[2]*timeFade)&255],
     intensity:Math.trunc(lightFade*255)&255,position,size:light.coronaSize,range:light.coronaFarClip,flareType:light.flareType,reflection:light.enableReflection,
     checkObstacles:!!(flags&LIGHT_FLAG.checkObstacles),neonFade:!!(flags&LIGHT_FLAG.onlyLongDistance),pullTowardsCamera:.8,fadeSpeed:15,
     onlyFromBelow:!!(flags&LIGHT_FLAG.onlyFromBelow)},frame.camera);
   }else{applyLight=false;updateCoors=true;}
  }
  if(!skip&&applyOnVersion){
   skip=true;
   coronas.register({id,color:[0,0,0],intensity:255,position,size:light.coronaSize,range:light.coronaFarClip,flareType:light.flareType,reflection:light.enableReflection,
    checkObstacles:!!(flags&LIGHT_FLAG.checkObstacles),neonFade:!!(flags&LIGHT_FLAG.onlyLongDistance),pullTowardsCamera:1.5,fadeSpeed:15},frame.camera);
  }
  if(!skip&&updateCoors)coronas.updateCoors(id,position,light.coronaFarClip,frame.camera);
  // POINT LIGHTS: a lit effect with a range adds a light of its colour × LightFade × TimeFade / 256 (a black one is an
  // antilight, which casts nothing).
  if(pointLights&&light.pointlightRange!==0&&applyLight&&(light.color[0]||light.color[1]||light.color[2])){
   const m=lightFade*timeFade/256;pointLights.push({position:[...position] as [number,number,number],radius:light.pointlightRange,color:[light.color[0]*m,light.color[1]*m,light.color[2]*m]});
  }
  if(light.shadowSize!==0){
   const maxHeight=light.shadowZDistance||15;
   if(applyLight){
    const mult=light.shadowColorMultiplier*timeFade/256;
    pools.push({id,position,size:light.shadowSize,color:[Math.trunc(light.color[0]*mult)&255,Math.trunc(light.color[1]*mult)&255,Math.trunc(light.color[2]*mult)&255],intensity:128,maxHeight});
   }else if(applyOnVersion)pools.push({id,position,size:light.shadowSize,color:[0,0,0],intensity:0,maxHeight});
  }
 });
 return pools;
}
