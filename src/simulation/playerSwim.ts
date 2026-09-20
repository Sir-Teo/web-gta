import {PED_ORIGIN_HEIGHT,SWIM,SWIM_STOP_TIME,swimBlendRatio,swimBreathMultiplier,swimEntry,swimSurfaceState,type SwimStrokeAssociation} from './nativeSwim';
import {handlePlayerBreath,type PlayerBreathState} from './playerBreath';
/** Mutable player fields the swim task reads and writes. */
export interface SwimPlayer extends PlayerBreathState {
 position:{x:number;y:number;z:number};health:number;grounded:boolean;
 swimming:boolean;swimState:number;swimBlend:number;breath:number;
 swimStopTime:number;swimDiveTime:number;swimDiveDuration:number;swimVel:{x:number;z:number};
}
/** Per-step player input for the swim task. */
export interface SwimInput {moveMag:number;sprint:boolean;jump:boolean;dive:boolean;underwaterStroke?:SwimStrokeAssociation}
/** CTaskComplexInWater/CTaskSimpleSwim player flow: entry with the origin 0.6 under (straight to underwater
 * sprinting when it is 2 under), the strand exit (CPed::ProcessBuoyancy: no water ends the task at once; standing
 * where the origin is not 0.6 under counts SWIM_STOP_TIME), surface/dive state selection, dive timing and breath.
 * Returns the dive clip duration the caller should supply (undefined keeps diving). */
export function updatePlayerSwim(player:SwimPlayer,input:SwimInput,water:number|undefined,dt:number,diveDuration:number|undefined){
 const stop=()=>{player.swimming=false;player.swimState=0;player.swimBlend=0;player.swimStopTime=0;player.swimDiveTime=0;player.swimVel={x:0,z:0};};
 if(!player.swimming){
  if(player.health>0&&swimEntry(player.position.y,water)){player.swimming=true;player.swimState=water!-2>player.position.y+PED_ORIGIN_HEIGHT?SWIM.underwaterSprinting:0;player.swimBlend=0;player.swimStopTime=0;player.swimDiveTime=0;player.swimVel={x:0,z:0};}
  return {breath:player.breath,damage:0};
 }
 if(player.health<=0){stop();return {breath:player.breath,damage:0};}
 if(water===undefined)stop();
 else if(player.grounded&&!(player.position.y+PED_ORIGIN_HEIGHT+.6<water)){player.swimStopTime+=dt*50;if(player.swimStopTime>SWIM_STOP_TIME)stop();}
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
  if(water!==undefined&&player.position.y+PED_ORIGIN_HEIGHT>water-.5)player.swimState=SWIM.tread;
 }
 return handlePlayerBreath(player,player.swimState===SWIM.underwaterSprinting,swimBreathMultiplier(player.swimState,input.underwaterStroke),dt*50);
}
