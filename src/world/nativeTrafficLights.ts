import {CHEATS} from '../simulation/nativeCheats';
export const TRAFFIC_LIGHT={green:0,yellow:1,red:2,off:3} as const;
export type TrafficLightState=typeof TRAFFIC_LIGHT[keyof typeof TRAFFIC_LIGHT];
export interface TrafficLightConditions {riots?:boolean;greenLightsCheat?:boolean;}
/** CGameLogic::LaRiotsActiveHere (0x441C10): never above z 950; with the riot cheat anywhere below it; with gbLARiots
 * only inside the two Los Santos rectangles. Native coordinates. */
export function laRiotsActiveHere(player:{x:number;y:number;z:number},riotCheat:boolean,laRiots:boolean){
 if(player.z>950)return false;
 if(riotCheat)return true;
 if(!laRiots)return false;
 const inside=(l:number,t:number,r:number,b:number)=>player.x>=l&&player.x<=r&&player.y>=t&&player.y<=b;
 return inside(1620,-2178,2824,-1067)||inside(157,-1950,1630,-1192);
}
let riotsHere=()=>false;
/** Where the lights ask LaRiotsActiveHere (the host knows the player, the cheat and the script's riot flag). */
export function setLaRiotsHere(query:()=>boolean){riotsHere=query;}
/** CTrafficLights' logical/visual phases from the unsigned game millisecond
 * timer. Advance/wrap this timer with simulation time, not the wall clock. */
/** `greenLightsCheat` defaults to CCheat::IsActive(CHEAT_BGREEN_LIGHTS_CHEAT), `riots` to LaRiotsActiveHere. */
export function nativeTrafficLights(milliseconds:number,{riots=riotsHere(),greenLightsCheat=CHEATS.isActive('greenLights')}:TrafficLightConditions={}){
 if(!Number.isInteger(milliseconds)||milliseconds<0||milliseconds>0xffffffff||typeof riots!=='boolean'||typeof greenLightsCheat!=='boolean')throw new Error('Invalid native traffic-light time or conditions.');
 const phase=Math.floor(milliseconds/2)&16383,{green,yellow,red,off}=TRAFFIC_LIGHT;
 const cars1:TrafficLightState=riots||greenLightsCheat?green:phase<5000?green:phase<6000?yellow:red;
 const cars2:TrafficLightState=riots||greenLightsCheat?green:phase<6000?red:phase<11000?green:phase<12000?yellow:red;
 const pedestrians:TrafficLightState=phase<12000?red:phase<15383?green:yellow;
 const flashing:TrafficLightState=(Math.floor(milliseconds/1024)&1)?off:yellow;
 return {phase,cars:[cars1,cars2] as const,visualCars:riots?[flashing,flashing] as const:[cars1,cars2] as const,pedestrians};
}
