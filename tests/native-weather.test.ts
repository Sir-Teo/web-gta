import {expect,test} from 'vitest';
import {NativeWeather,WEATHER,WEATHER_TYPES_LISTS,WINDYNESS_BY_WEATHER} from '../src/world/nativeWeather';
import {WEATHER_REGION} from '../src/world/weatherRegion';
const grove={x:2495,y:-1687,z:13};
const run=(w:NativeWeather,fromMinutes:number,seconds:number,camera=grove,random=()=>.5)=>{
 let frame=0;
 for(let t=0;t<seconds;t+=1/50){const total=fromMinutes+t,today=((total%1440)+1440)%1440;w.update({clock:{hours:Math.floor(today/60),minutes:Math.floor(today%60),seconds:Math.floor(today%1*60)},timeMs:Math.floor(t*1000),frame:frame++,timeStep:1,camera,sunZ:.5,random});}
};
test('weather follows the region list one entry per game hour and blends by minutes',()=>{
 const w=new NativeWeather();
 w.setAppropriateNow(grove.x,grove.y);
 expect(w.region).toBe(WEATHER_REGION.la);
 expect([w.oldWeather,w.newWeather]).toEqual([WEATHER.extraSunnySmogLA,WEATHER.extraSunnySmogLA]);
 run(w,12*60+10,40);
 expect(w.interpolation).toBeCloseTo((49+58/60)/60,4);
 // The hour boundary makes the old target current and advances WeatherTypeInList.
 run(w,12*60+59,2);
 expect(w.weatherTypeInList).toBe(1);expect(w.oldWeather).toBe(WEATHER.extraSunnySmogLA);expect(w.newWeather).toBe(WEATHER_TYPES_LISTS[WEATHER_REGION.la][1]);
 expect(w.interpolation).toBeLessThan(.02);
 // Above 950 units the list does not advance.
 run(w,13*60+59,2,{...grove,z:1000});
 expect(w.weatherTypeInList).toBe(1);
});
test('forced rainy weather ramps rain toward the pulsed target, wets roads and raises headlight spectrum',()=>{
 const w=new NativeWeather();w.setAppropriateNow(grove.x,grove.y);
 w.forceWeatherNow(WEATHER.rainyCountry);
 run(w,9*60,30);
 expect(w.wetRoads).toBe(1);
 // 0.005 per native frame toward ((ms >> 13) & 3) * 0.1 + 0.7.
 expect(w.rain).toBeGreaterThanOrEqual(.7);expect(w.rain).toBeLessThanOrEqual(1);
 expect(w.cloudCoverage).toBe(1);expect(w.extraSunnyness).toBe(0);
 expect(w.headLightsSpectrum).toBe(w.rain);expect(w.trafficLightsBrightness).toBe(1);
 expect(w.wind).toBe(WINDYNESS_BY_WEATHER[WEATHER.rainyCountry]);
});
test('foggy San Fierro, sandstorms and the rainbow after cloudy weather',()=>{
 const w=new NativeWeather();
 w.oldWeather=WEATHER.cloudySF;w.newWeather=WEATHER.sunnySF;
 run(w,10*60+15,1);
 expect(w.cloudCoverage).toBeCloseTo(1-w.interpolation,5);
 expect(w.rainbow).toBeGreaterThan(.9);
 w.forceWeatherNow(WEATHER.foggySF);run(w,10*60+20,1);
 expect(w.foggyness).toBe(1);expect(w.foggynessSF).toBe(1);
 w.forceWeatherNow(WEATHER.sandstormDesert);run(w,10*60+20,20);
 expect(w.foggyness).toBe(1);expect(w.sandstorm).toBeGreaterThan(.6);expect(w.foggynessSF).toBe(0);
});
test('lightning bursts only in rain and schedules thunder by burst duration',()=>{
 const w=new NativeWeather();w.forceWeatherNow(WEATHER.rainySF);
 // One burst: rand() < 200 starts it, rand() % 256 < 24 ends it on the next frame; later frames draw no new burst.
 let n=0;const scripted=[.001,0],random=()=>n<scripted.length?scripted[n++]:.9;
 let thunder=false;
 for(let i=0;i<400&&!thunder;i++){w.update({clock:{hours:3,minutes:10,seconds:0},timeMs:i*20,frame:i,timeStep:1,camera:grove,sunZ:0,random});if(w.thunder)thunder=true;}
 expect(thunder).toBe(true);
 w.forceWeatherNow(WEATHER.sunnySF);w.update({clock:{hours:3,minutes:10,seconds:1},timeMs:9000,frame:500,timeStep:1,camera:grove,sunZ:0,random:()=>0});
 expect(w.lightningFlash).toBe(false);expect(w.lightningBurst).toBe(false);
});
