import {CHEATS} from '../simulation/nativeCheats';
export const TRAFFIC_LIGHT={green:0,yellow:1,red:2,off:3} as const;
export type TrafficLightState=typeof TRAFFIC_LIGHT[keyof typeof TRAFFIC_LIGHT];
export interface TrafficLightConditions {riots?:boolean;greenLightsCheat?:boolean;}
/** CTrafficLights' logical/visual phases from the unsigned game millisecond
 * timer. Advance/wrap this timer with simulation time, not the wall clock. */
/** `greenLightsCheat` defaults to CCheat::IsActive(CHEAT_BGREEN_LIGHTS_CHEAT). */
export function nativeTrafficLights(milliseconds:number,{riots=false,greenLightsCheat=CHEATS.isActive('greenLights')}:TrafficLightConditions={}){
 if(!Number.isInteger(milliseconds)||milliseconds<0||milliseconds>0xffffffff||typeof riots!=='boolean'||typeof greenLightsCheat!=='boolean')throw new Error('Invalid native traffic-light time or conditions.');
 const phase=Math.floor(milliseconds/2)&16383,{green,yellow,red,off}=TRAFFIC_LIGHT;
 const cars1:TrafficLightState=riots||greenLightsCheat?green:phase<5000?green:phase<6000?yellow:red;
 const cars2:TrafficLightState=riots||greenLightsCheat?green:phase<6000?red:phase<11000?green:phase<12000?yellow:red;
 const pedestrians:TrafficLightState=phase<12000?red:phase<15383?green:yellow;
 const flashing:TrafficLightState=(Math.floor(milliseconds/1024)&1)?off:yellow;
 return {phase,cars:[cars1,cars2] as const,visualCars:riots?[flashing,flashing] as const:[cars1,cars2] as const,pedestrians};
}
