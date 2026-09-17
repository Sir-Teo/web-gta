import {WEATHER_REGION,nativeWeatherRegion} from './weatherRegion';
/** eWeatherType. */
export const WEATHER={
 extraSunnyLA:0,sunnyLA:1,extraSunnySmogLA:2,sunnySmogLA:3,cloudyLA:4,sunnySF:5,extraSunnySF:6,cloudySF:7,rainySF:8,foggySF:9,
 sunnyVegas:10,extraSunnyVegas:11,cloudyVegas:12,extraSunnyCountry:13,sunnyCountry:14,cloudyCountry:15,rainyCountry:16,
 extraSunnyDesert:17,sunnyDesert:18,sandstormDesert:19,underwater:20,extraColours1:21,extraColours2:22,
} as const;
/** WeatherTypesList* from game_sa/Data/Weather.def (0x8D5EB0...), 64 hourly entries per region. */
export const WEATHER_TYPES_LISTS:Record<number,readonly number[]>={
 [WEATHER_REGION.default]:[13,13,13,13,13,13,13,13,14,15,9,9,15,14,13,14,14,13,13,13,13,14,14,13,13,13,13,13,13,13,13,13,13,13,14,14,14,14,14,14,15,9,9,15,16,16,16,16,15,14,14,14,14,13,13,13,13,13,13,13,13,13,13,13],
 [WEATHER_REGION.la]:[2,2,0,0,0,2,2,2,3,0,3,2,0,0,3,3,3,4,4,0,0,1,1,0,2,2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,2,2,3,3,0,0,16,0,4,1,1,1,1,0,0,2,2,2,2,2,2,2,2,2],
 [WEATHER_REGION.sf]:[5,5,5,5,5,7,7,9,9,7,5,5,5,5,5,7,7,7,8,8,7,7,5,5,5,5,6,6,5,7,9,9,7,5,5,7,5,5,6,6,5,5,5,7,7,8,8,7,7,9,9,5,5,6,6,6,5,5,6,7,7,6,6,5],
 [WEATHER_REGION.lv]:[11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,10,10,10,10,10,11,11,11,11,11,11,11,11,11,10,11,11,11,11,10,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,10,10,12,12,10,12,10,10],
 [WEATHER_REGION.desert]:[17,17,17,19,19,17,17,17,17,17,17,17,17,17,17,17,17,17,17,18,18,18,18,18,17,17,17,17,17,17,17,17,17,17,17,17,17,19,19,19,17,17,17,17,17,17,17,17,17,17,18,18,18,17,17,17,17,17,17,17,19,19,19,17],
};
const EXTRA_SUNNY=new Set([0,2,13,6,11,17]);
const SUNNY=new Set([1,3,14,5,10,18]);
const rainy=(w:number)=>w===WEATHER.rainyCountry||w===WEATHER.rainySF;
/** IsExtraSunny (eWeatherType.h). */
export const isExtraSunny=(w:number)=>EXTRA_SUNNY.has(w);
/** Windyness at 0x8D5E50 is not present in any local source. These values follow the related reVC table by weather
 * category (sunny 0.25, cloudy 0.7, rainy 1, foggy and extra sunny 0); the sandstorm uses reVC's strongest (hurricane) 2. */
export const WINDYNESS_BY_WEATHER=Array.from({length:23},(_,w)=>EXTRA_SUNNY.has(w)?0:SUNNY.has(w)?.25:rainy(w)?1:w===WEATHER.foggySF?0:w===WEATHER.sandstormDesert?2:w>=20?0:.7);
/** CWeather::Update's blended sky factors for an old/new pair at InterpolationValue `t`. */
export function nativeWeatherBlend(oldW:number,newW:number,t:number){
 const clear=(w:number)=>SUNNY.has(w)||EXTRA_SUNNY.has(w),foggy=(w:number)=>w===WEATHER.foggySF||w===WEATHER.sandstormDesert;
 return {
  cloudCoverage:(clear(oldW)?0:1-t)+(clear(newW)?0:t),
  foggyness:(foggy(oldW)?1-t:0)+(foggy(newW)?t:0),
  foggynessSF:(oldW===WEATHER.foggySF?1-t:0)+(newW===WEATHER.foggySF?t:0),
  extraSunnyness:(EXTRA_SUNNY.has(oldW)?1-t:0)+(EXTRA_SUNNY.has(newW)?t:0),
 };
}
export interface WeatherClock {hours:number;minutes:number;seconds:number}
export interface WeatherUpdateInput {
 clock:WeatherClock;
 /** CTimer::m_snTimeInMilliseconds. */timeMs:number;
 /** CTimer::m_FrameCounter. */frame:number;
 /** CTimer::ms_fTimeStep (native 50 Hz frames). */timeStep:number;
 /** Camera position (native). */camera:{x:number;y:number;z:number};
 /** CTimeCycle::m_VectorToSun z. */sunZ:number;
 /** CGame::currArea or a no-rain cull zone. */noRain?:boolean;
 underwaterness?:number;
 random?:()=>number;
}
/** CWeather: hourly region weather lists, forced weather, interpolated weather factors and lightning.
 * CWeather::Update (0x72B850) is not reversed in gta-reversed; this follows the decompiled Grinch_ reimplementation
 * (pinned in docs/research/NATIVE_WEATHER.md) with its list index restored to WeatherTypeInList. */
export class NativeWeather {
 oldWeather:number=WEATHER.extraSunnyLA;newWeather:number=WEATHER.extraSunnyLA;forcedWeather=-1;
 weatherTypeInList=0;interpolation=0;region:number=WEATHER_REGION.default;
 rain=0;sandstorm=0;wetRoads=0;cloudCoverage=0;foggyness=0;foggynessSF=0;extraSunnyness=0;rainbow=0;sunGlare=0;heatHaze=0;
 wind=0;windClipped=0;gust=0;wavyness=0;windDir={x:0,y:0,z:0};trafficLightsBrightness=0;headLightsSpectrum=0;underwaterness=0;
 lightningBurst=false;lightningFlash=false;lightningStart=0;lightningFlashLastChange=0;lightningDuration=0;whenToPlayLightningSound=0;
 /** AE_THUNDER requests raised by the last update (CAEWeatherAudioEntity::AddAudioEvent). */
 thunder?:{duration:number};
 /** CWeather::UpdateWeatherRegion. */
 updateRegion(x:number,y:number){this.region=nativeWeatherRegion(x,y);}
 /** CWeather::SetWeatherToAppropriateTypeNow: the first entry of the region's list, unforced. */
 setAppropriateNow(x:number,y:number){this.updateRegion(x,y);const w=WEATHER_TYPES_LISTS[this.region][0];this.forcedWeather=-1;this.oldWeather=w;this.newWeather=w;}
 forceWeather(w:number){this.forcedWeather=w;}
 forceWeatherNow(w:number){this.forcedWeather=w;this.oldWeather=w;this.newWeather=w;}
 releaseWeather(){this.forcedWeather=-1;}
 get rainy(){return this.rain>=.2;}
 update(input:WeatherUpdateInput){
  const random=input.random??Math.random,rand=()=>Math.trunc(random()*32768);
  this.thunder=undefined;
  if((input.frame&15)===0)this.updateRegion(input.camera.x,input.camera.y);
  const clock=input.clock,interpolation=(clock.seconds/60+clock.minutes)/60;
  if(interpolation<this.interpolation){
   // A new game hour: the previous target becomes the old weather.
   this.updateRegion(input.camera.x,input.camera.y);this.oldWeather=this.newWeather;
   if(this.forcedWeather>=0)this.newWeather=this.forcedWeather;
   else if(input.camera.z<950){this.weatherTypeInList=(this.weatherTypeInList+1)%64;this.newWeather=WEATHER_TYPES_LISTS[this.region][this.weatherTypeInList];}
  }
  this.interpolation=interpolation;
  const oldW=this.oldWeather,newW=this.newWeather,t=this.interpolation,ms=input.timeMs>>>0;
  // Lightning while both endpoints are rainy.
  if(input.noRain||this.underwaterness>0||!rainy(newW)||!rainy(oldW)){this.lightningFlash=false;this.lightningBurst=false;}
  else if(this.lightningBurst){
   if(rand()%256>=24){if(ms-this.lightningFlashLastChange>50){const flash=rand()%2===1;if(flash!==this.lightningFlash){this.lightningFlash=flash;this.lightningFlashLastChange=ms;}}}
   else{this.lightningBurst=false;this.lightningDuration=Math.min(Math.max(0,input.frame-this.lightningStart),20);this.whenToPlayLightningSound=ms+150*(20-this.lightningDuration);this.lightningFlash=false;}
  }else if(rand()>=200)this.lightningFlash=false;
  else{this.lightningStart=input.frame;this.lightningFlashLastChange=ms;this.lightningBurst=true;this.lightningFlash=true;}
  if(this.whenToPlayLightningSound&&ms>this.whenToPlayLightningSound){this.thunder={duration:this.lightningDuration};this.whenToPlayLightningSound=0;}
  this.wetRoads=rainy(oldW)?rainy(newW)?1:1-t:rainy(newW)?t:0;
  const pulse=((ms>>>13)&3)*.1+.7,step=input.timeStep*.005;
  const approach=(current:number,target:number)=>Math.abs(target-current)>=step?current+(target<current?-step:step):target;
  this.rain=approach(this.rain,pulse*((rainy(newW)?t:0)+(rainy(oldW)?1-t:0)));
  this.sandstorm=approach(this.sandstorm,pulse*((newW===WEATHER.sandstormDesert?t:0)+(oldW===WEATHER.sandstormDesert?1-t:0)));
  const clear=(w:number)=>SUNNY.has(w)||EXTRA_SUNNY.has(w);
  Object.assign(this,nativeWeatherBlend(oldW,newW,t));
  this.rainbow=[4,15,12,7].includes(oldW)&&SUNNY.has(newW)&&t<.5&&clock.hours>6&&clock.hours<21?1-Math.abs(t-.25)*4:0;
  this.sunGlare=(clear(oldW)?1-t:0)+(clear(newW)?t:0);
  if(this.sunGlare>0){this.sunGlare=Math.min(1,Math.max(0,Math.min(1,input.sunZ*7)*this.sunGlare));this.sunGlare*=1-(rand()&31)*.007;}
  const hazy=(w:number)=>w===18||w===17||w===11||w===0;
  this.heatHaze=(hazy(oldW)?1-t:0)+(hazy(newW)?t:0);
  this.wind=WINDYNESS_BY_WEATHER[oldW]*(1-t)+WINDYNESS_BY_WEATHER[newW]*t;
  this.windClipped=Math.min(this.wind,1);
  // Windyness gust tables (CWeather::WindDir): base north-east with a gust
  // swing synthesized from the frame counter and wind strength.
  const gust=1+0.35*Math.sin(ms*0.0011+this.wind*3.1)+0.18*Math.sin(ms*0.0037);
  this.gust=Math.max(0,this.wind*gust);
  const swing=Math.sin(ms*0.0006)*0.25*this.windClipped;
  this.windDir={x:this.windClipped*.7*(1+swing),y:this.windClipped*.7*(1-swing),z:0};
  this.wavyness=Math.min(this.windClipped+.3,1);
  this.rain=Math.min(1-this.underwaterness,this.rain);
  const h=clock.hours,m=clock.minutes;
  this.trafficLightsBrightness=h>20?1:h>19?m/60:h>6?0:h<=5?1:1-m/60;
  this.headLightsSpectrum=Math.min(Math.max(this.rain,this.foggyness),1);
  this.trafficLightsBrightness=Math.max(this.trafficLightsBrightness,this.wetRoads,this.foggyness,this.rain);
 }
 /** The values LocalTimecycle reads, current after ForceWeatherNow even while the game is paused. */
 state(){return {old:this.oldWeather,new:this.newWeather,interpolation:this.interpolation,...nativeWeatherBlend(this.oldWeather,this.newWeather,this.interpolation)};}
 snapshot(){return {old:this.oldWeather,new:this.newWeather,forced:this.forcedWeather,list:this.weatherTypeInList,region:this.region,interpolation:+this.interpolation.toFixed(4),rain:+this.rain.toFixed(3),sandstorm:+this.sandstorm.toFixed(3),wetRoads:+this.wetRoads.toFixed(3),cloudCoverage:+this.cloudCoverage.toFixed(3),foggyness:+this.foggyness.toFixed(3),extraSunnyness:+this.extraSunnyness.toFixed(3),rainbow:+this.rainbow.toFixed(3),wind:+this.wind.toFixed(3),lightning:this.lightningFlash};}
}
