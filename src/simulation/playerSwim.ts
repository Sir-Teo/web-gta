import {SWIM,SWIM_STOP_TIME,swimBlendRatio,swimBreath,swimEntry,swimSurfaceState} from './nativeSwim';
/** Mutable player fields the swim task reads and writes. */
export interface SwimPlayer {
 position:{x:number;y:number;z:number};health:number;grounded:boolean;
 swimming:boolean;swimState:number;swimBlend:number;breath:number;
 swimStopTime:number;swimDiveTime:number;swimDiveDuration:number;swimVel:{x:number;z:number};
}
/** Per-step player input for the swim task. */
export interface SwimInput {moveMag:number;sprint:boolean;jump:boolean;dive:boolean}
/** CTaskComplexInWater/CTaskSimpleSwim player flow: entry at 0.6 m depth,
 * shallow/strand exits, surface/dive state selection, dive timing and breath.
 * Returns the dive clip duration the caller should supply (undefined keeps diving). */
export function updatePlayerSwim(player:SwimPlayer,input:SwimInput,water:number|undefined,dt:number,diveDuration:number|undefined){
 const stop=()=>{player.swimming=false;player.swimState=0;player.swimBlend=0;player.swimStopTime=0;player.swimDiveTime=0;player.swimVel={x:0,z:0};};
 if(!player.swimming){
  if(player.health>0&&swimEntry(player.position.y,water)){player.swimming=true;player.swimState=0;player.swimBlend=0;player.swimStopTime=0;player.swimDiveTime=0;player.swimVel={x:0,z:0};}
  return {breath:player.breath,damage:0};
 }
 if(player.health<=0){stop();return {breath:player.breath,damage:0};}
 if(water===undefined)stop();
 else if(player.grounded&&water-player.position.y<.6)stop();
 else if(player.grounded){player.swimStopTime+=dt;if(player.swimStopTime>SWIM_STOP_TIME)stop();}
 else player.swimStopTime=0;
 if(!player.swimming)return {breath:player.breath,damage:0};
 player.swimBlend=swimBlendRatio(player.swimBlend,Math.min(1,input.moveMag),dt*50);
 const state=player.swimState;
 if(state<=2){
  if(input.jump)player.swimState=SWIM.backToSurface;
  else if(input.dive){player.swimState=SWIM.diveUnderwater;player.swimBlend=0;player.swimDiveTime=0;player.swimDiveDuration=diveDuration??1;}
  else player.swimState=swimSurfaceState(player.swimBlend,input.sprint);
 }else if(state===SWIM.diveUnderwater){
  player.swimDiveTime+=dt;
  if(diveDuration!==undefined&&player.swimDiveTime>=diveDuration)player.swimState=SWIM.underwaterSprinting;
 }else if(state===SWIM.backToSurface){
  if(water!==undefined&&player.position.y>water-.5)player.swimState=SWIM.tread;
 }
 const dive=swimBreath(player.breath,player.swimState===SWIM.underwaterSprinting,1.5,dt*50);
 player.breath=dive.breath;
 return dive;
}
