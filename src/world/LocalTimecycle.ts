import {applyTimecycleBoxes,prepareTimecycleBoxes,type NativeTimecycleBox} from './nativeTimecycleBoxes';
import type {TimecycleBox} from '../assets/timecycleBoxes';
import {nativeExtraSunny} from './nativeStreak';
import { readTimecycle } from '../assets/timecycle';
import { prepareTimecycle, sampleNativeTimecycle, sampleNativeWeatherTimecycle, type NativeTimecycle } from './nativeTimecycle';
import {isExtraSunny} from './nativeWeather';
import type { NativeSkyColors } from './nativeSkyColors';
import { viewerFoggyness, viewerLowCloudVisibility } from './viewerWeather';

type RGB = [number,number,number];
/** CWeather values the timecycle and sky read each frame. */
export interface NativeWeatherState {old:number;new:number;interpolation:number;foggyness:number;cloudCoverage:number;extraSunnyness:number}
export interface ImportedLighting { regionalLodMultiplier?:number; water?:{color:RGB;opacity:number}; extraSunny?:boolean; lowClouds?: {color:RGB;visibility:number}; skyColors?: NativeSkyColors; skyFoggyness?: number; top: RGB; horizon: RGB; ambient: RGB; objectAmbient?: RGB; directionalMultiplier?:number; shadowStrength?:number; sunCore: RGB; sunCorona: RGB; /** m_nSunCore and m_nSunCorona as timecyc bytes. */ sunBytes?:{core:RGB;corona:RGB}; sunSize:number;
  /** m_CurrentColours.m_fSpriteBrightness, m_fSpriteSize and m_fLightsOnGroundBrightness: the stored ×10 values,
   * interpolated. */ spriteBrightness?:number; spriteSize?:number; lightsOnGroundBrightness?:number; fog?: {start:number;end:number};
  /** CTimeCycle::GetPostFxColors: the interpolated postfx1 and postfx2 bytes with their alphas (CPostEffects::ColourFilter). */
  postFx?:{pass1:{r:number;g:number;b:number;a:number};pass2:{r:number;g:number;b:number;a:number}} }
const displayChannel=(byte:number)=>{const c=byte/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;};
const skyBytes=(...channels:number[])=>channels.map(c=>((Math.trunc(c)%256)+256)%256) as RGB;
/** Session-owned native lighting; malformed replacements leave the current table intact. */
export class LocalTimecycle {
  private data?:NativeTimecycle;
  private selectedWeather=0;
  private boxes:NativeTimecycleBox[]=[];
  private cached?:{minutes:number;position?:string;weather?:string;value:ImportedLighting};
  private weatherState?:NativeWeatherState;
  /** Native CWeather state; when set it replaces the static weather selection. */
  setWeatherState(state?:NativeWeatherState){this.weatherState=state?{...state}:undefined;this.cached=undefined;}
  get nativeWeather(){return this.weatherState?{...this.weatherState}:undefined;}
  get modifierCount(){return this.boxes.length;}
  setModifiers(boxes:readonly TimecycleBox[]){const prepared=prepareTimecycleBoxes(boxes);this.boxes=prepared;this.cached=undefined;}
  name='';
  get weather(){return this.selectedWeather;}
  load(text:string,name:string){
    const raw=readTimecycle(text),prepared=prepareTimecycle(raw);
    this.data=prepared;this.name=name;this.cached=undefined;
    const invalidFog=prepared.samples.filter(s=>s.fogStart<0||s.farClip<=Math.max(.08,s.fogStart)).length;
    return [...raw.warnings,...(invalidFog?[`Authored fog is used for ${invalidFog} samples with unavailable fog distances.`]:[])];
  }
  clear(){this.data=undefined;this.name='';this.cached=undefined;}
  setWeather(weather:number){
    if(!Number.isInteger(weather)||weather<0||weather>22)throw new Error('Invalid weather selection.');
    this.selectedWeather=weather;this.cached=undefined;
  }
  /** `lightsMult` is CCoronas::LightsMult, which dims to 0.6 while the sun is in view. */
  sample(minutes:number,position?:{x:number;y:number;z:number},lightsMult=1):ImportedLighting|undefined{
    if(!this.data)return undefined;
    const point=position&&this.boxes.length?[Math.fround(position.x),Math.fround(-position.z),Math.fround(position.y)] as const:undefined;
    const key=`${point?.join(',')??''}|${lightsMult}`,state=this.weatherState,weatherKey=state?`${state.old},${state.new},${state.interpolation},${state.foggyness},${state.cloudCoverage},${state.extraSunnyness}`:undefined;
    if(this.cached?.minutes===minutes&&this.cached.position===key&&this.cached.weather===weatherKey)return this.cached.value;
    const base=brightenSky(state?sampleNativeWeatherTimecycle(this.data,minutes,state.old,state.new,state.interpolation,position?.y??0):sampleNativeTimecycle(this.data,minutes,this.selectedWeather),lightsMult);
    const spatial=point?applyTimecycleBoxes(base,this.data,this.boxes,point):undefined;
    const c=spatial?.colors??base;
    const value:ImportedLighting={
      regionalLodMultiplier:spatial?.lodDistanceMultiplier,
      water:{color:[c.waterR,c.waterG,c.waterB].map(displayChannel) as RGB,opacity:Math.max(0,Math.min(1,c.waterAlpha/255))},
      extraSunny:state?isExtraSunny(state.old)&&isExtraSunny(state.new):nativeExtraSunny(this.selectedWeather),
      skyFoggyness:state?state.foggyness:viewerFoggyness(this.selectedWeather),
      // CClouds::Render: low clouds fade by max(Foggyness, CloudCoverage, ExtraSunnyness).
      lowClouds:{color:skyBytes(c.lowCloudR,c.lowCloudG,c.lowCloudB),visibility:state?1-Math.max(state.foggyness,state.cloudCoverage,state.extraSunnyness):viewerLowCloudVisibility(this.selectedWeather)},
      skyColors:{top:skyBytes(c.skyTopR,c.skyTopG,c.skyTopB),bottom:skyBytes(c.skyBottomR,c.skyBottomG,c.skyBottomB)},
      top:[c.skyTopR,c.skyTopG,c.skyTopB].map(displayChannel) as RGB,
      horizon:[c.skyBottomR,c.skyBottomG,c.skyBottomB].map(displayChannel) as RGB,
      sunCore:[c.sunCoreR,c.sunCoreG,c.sunCoreB].map(displayChannel) as RGB,
      sunCorona:[c.sunCoronaR,c.sunCoronaG,c.sunCoronaB].map(displayChannel) as RGB,
      sunBytes:{core:[c.sunCoreR,c.sunCoreG,c.sunCoreB],corona:[c.sunCoronaR,c.sunCoronaG,c.sunCoronaB]},
      sunSize:c.sunSize,
      spriteBrightness:c.spriteBrightness,spriteSize:c.spriteSize,lightsOnGroundBrightness:c.groundLight,
      shadowStrength:c.shadowStrength,
      directionalMultiplier:c.directionalMultiplier,
      fog:c.fogStart>=0&&c.farClip>Math.max(.08,c.fogStart)?{start:c.fogStart,end:c.farClip}:undefined,
      objectAmbient:[c.objectAmbientR,c.objectAmbientG,c.objectAmbientB].map(v=>Math.fround(v/255)) as RGB,
      ambient:[c.ambientR,c.ambientG,c.ambientB].map(v=>Math.fround(v/255)) as RGB,
      postFx:{pass1:{r:c.postFx1R,g:c.postFx1G,b:c.postFx1B,a:c.postFx1Alpha},pass2:{r:c.postFx2R,g:c.postFx2G,b:c.postFx2B,a:c.postFx2Alpha}},
    };
    this.cached={minutes,position:key,weather:weatherKey,value};return value;
  }
}
/** CTimeCycle::CalcColoursForPoint (0x5608E0): before the boxes, the six sky bytes brighten by
 * (1 / CCoronas::LightsMult + 3) / 4, capped at 255, so the sky lifts up to a sixth while the sun dims the lights. */
export function brightenSky<T extends {skyTopR:number;skyTopG:number;skyTopB:number;skyBottomR:number;skyBottomG:number;skyBottomB:number}>(set:T,lightsMult:number):T{
 const m=Math.fround((1/lightsMult+3)*.25);if(m===1)return set;
 const f=(v:number)=>Math.min(Math.trunc(Math.fround(v*m)),255);
 return {...set,skyTopR:f(set.skyTopR),skyTopG:f(set.skyTopG),skyTopB:f(set.skyTopB),skyBottomR:f(set.skyBottomR),skyBottomG:f(set.skyBottomG),skyBottomB:f(set.skyBottomB)};
}
