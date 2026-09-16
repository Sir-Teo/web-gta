/** eWeatherRegion. */
export const WEATHER_REGION={default:0,la:1,sf:2,lv:3,desert:4} as const;
/** CWeather::FindWeatherRegion for a native 2D position. */
export function nativeWeatherRegion(x:number,y:number){
 if(x>1000&&y>910)return WEATHER_REGION.lv;
 if(x>-850&&x<1000&&y>1280)return WEATHER_REGION.desert;
 if(x<-1430&&y>-580&&y<1430)return WEATHER_REGION.sf;
 if(x>250&&x<3000&&y>-3000&&y<-850)return WEATHER_REGION.la;
 return WEATHER_REGION.default;
}
