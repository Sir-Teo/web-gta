import {nativeExtraSunny} from './nativeStreak';
import { readTimecycle } from '../assets/timecycle';
import { prepareTimecycle, sampleNativeTimecycle, type NativeTimecycle } from './nativeTimecycle';
import type { NativeSkyColors } from './nativeSkyColors';
import { viewerFoggyness, viewerLowCloudVisibility } from './viewerWeather';

type RGB = [number,number,number];
export interface ImportedLighting { water?:{color:RGB;opacity:number}; extraSunny?:boolean; lowClouds?: {color:RGB;visibility:number}; skyColors?: NativeSkyColors; skyFoggyness?: number; top: RGB; horizon: RGB; ambient: RGB; objectAmbient?: RGB; directionalMultiplier?:number; shadowStrength?:number; sunCore: RGB; sunCorona: RGB; sunSize:number; fog?: {start:number;end:number} }
const displayChannel=(byte:number)=>{const c=byte/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;};
const skyBytes=(...channels:number[])=>channels.map(c=>((Math.trunc(c)%256)+256)%256) as RGB;
/** Session-owned native lighting; malformed replacements leave the current table intact. */
export class LocalTimecycle {
  private data?:NativeTimecycle;
  private selectedWeather=0;
  private cached?:{minutes:number;value:ImportedLighting};
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
  sample(minutes:number):ImportedLighting|undefined{
    if(!this.data)return undefined;
    if(this.cached?.minutes===minutes)return this.cached.value;
    const c=sampleNativeTimecycle(this.data,minutes,this.selectedWeather);
    const value:ImportedLighting={
      water:{color:[c.waterR,c.waterG,c.waterB].map(displayChannel) as RGB,opacity:Math.max(0,Math.min(1,c.waterAlpha/255))},
      extraSunny:nativeExtraSunny(this.selectedWeather),
      skyFoggyness:viewerFoggyness(this.selectedWeather),
      lowClouds:{color:skyBytes(c.lowCloudR,c.lowCloudG,c.lowCloudB),visibility:viewerLowCloudVisibility(this.selectedWeather)},
      skyColors:{top:skyBytes(c.skyTopR,c.skyTopG,c.skyTopB),bottom:skyBytes(c.skyBottomR,c.skyBottomG,c.skyBottomB)},
      top:[c.skyTopR,c.skyTopG,c.skyTopB].map(displayChannel) as RGB,
      horizon:[c.skyBottomR,c.skyBottomG,c.skyBottomB].map(displayChannel) as RGB,
      sunCore:[c.sunCoreR,c.sunCoreG,c.sunCoreB].map(displayChannel) as RGB,
      sunCorona:[c.sunCoronaR,c.sunCoronaG,c.sunCoronaB].map(displayChannel) as RGB,
      sunSize:c.sunSize,
      shadowStrength:c.shadowStrength,
      directionalMultiplier:c.directionalMultiplier,
      fog:c.fogStart>=0&&c.farClip>Math.max(.08,c.fogStart)?{start:c.fogStart,end:c.farClip}:undefined,
      objectAmbient:[c.objectAmbientR,c.objectAmbientG,c.objectAmbientB].map(v=>Math.fround(v/255)) as RGB,
      ambient:[c.ambientR,c.ambientG,c.ambientB].map(v=>Math.fround(v/255)) as RGB,
    };
    this.cached={minutes,value};return value;
  }
}
