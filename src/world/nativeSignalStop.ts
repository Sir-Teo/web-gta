import type {NavigationNode,PathAddress,PathArea} from '../assets/pathNodes';
import {nativeTrafficLights,type TrafficLightConditions} from './nativeTrafficLights';

/** Resolved autopilot link; omit links whose address or path area is unavailable.
 * routeAddress maps to currentAddress / startingRouteNode / endingRouteNode for
 * current / next / previous respectively. travelSign retains _smthCurr/Next/Prev. */
export interface NativeSignalApproach {
 navigation:Pick<NavigationNode,'position'|'direction'|'attachedTo'|'trafficLightState'|'trafficLightDirection'>;
 routeAddress:PathAddress;
 travelSign:number;
}
export interface NativeSignalVehicle {
 /** Native XY coordinates, before the renderer's Y-up conversion. */
 position:readonly [number,number];
 appearance:'car'|'bike'|'boat'|'heli'|'plane';
 physicsStatus:boolean;
 current?:NativeSignalApproach;
 next?:NativeSignalApproach;
 previous?:NativeSignalApproach;
}
/** Autopilot state retains navigation addresses instead of references into an
 * area that streaming may unload. Route addresses are separate path-node IDs. */
export interface NativeSignalRoute {
 navigationAddress:PathAddress|null;
 routeAddress:PathAddress;
 travelSign:number;
}
export interface NativeSignalRouteVehicle extends Omit<NativeSignalVehicle,'current'|'next'|'previous'> {
 current?:NativeSignalRoute;
 next?:NativeSignalRoute;
 previous?:NativeSignalRoute;
}
/** Resolve against the currently loaded areas on every decision. Null and the
 * decoded 0xffff sentinel (area 63, link 1023) are invalid navigation addresses.
 * Unavailable/out-of-range links are skipped; do not substitute nearby nodes. */
export function nativeShouldStopForPathLight(areas:ReadonlyMap<number,PathArea>,vehicle:NativeSignalRouteVehicle,
 milliseconds:number,conditions:TrafficLightConditions={},ignorePhase=false):boolean {
 const resolve=(route:NativeSignalRoute|undefined):NativeSignalApproach|undefined=>{
  const address=route?.navigationAddress;
  if(!route||!address||!Number.isInteger(address.area)||address.area<0||address.area>=64||
   !Number.isInteger(address.node)||address.node<0||address.node>=1024||address.area===63&&address.node===1023)return;
  const navigation=areas.get(address.area)?.navigation[address.node];
  return navigation?{navigation,routeAddress:route.routeAddress,travelSign:route.travelSign}:undefined;
 };
 return nativeShouldStopForLight({...vehicle,current:resolve(vehicle.current),next:resolve(vehicle.next),previous:resolve(vehicle.previous)},milliseconds,conditions,ignorePhase);
}
/** CTrafficLights::ShouldCarStopForLight (0x49D610). ignorePhase corresponds to
 * source bUnkn: it bypasses phase only, not approach applicability or distance.
 * Preserve ordered early returns, including green before the distance test. */
export function nativeShouldStopForLight(vehicle:NativeSignalVehicle,milliseconds:number,
 conditions:TrafficLightConditions={},ignorePhase=false):boolean {
 const {cars}=nativeTrafficLights(milliseconds,conditions);
 if(vehicle.appearance==='heli'||vehicle.appearance==='plane')return false;
 for(const [approach,window] of [[vehicle.current,12],[vehicle.next,12],[vehicle.physicsStatus?vehicle.previous:undefined,6]] as const){
  if(!approach)continue;
  const {navigation:n,routeAddress,travelSign}=approach;
  if(n.trafficLightState===0)continue;
  const attached=n.attachedTo.area===routeAddress.area&&n.attachedTo.node===routeAddress.node;
  if(attached!==n.trafficLightDirection)continue;
  if(!ignorePhase&&((n.trafficLightState!==1||cars[0]===0)&&(n.trafficLightState!==2||cars[1]===0)))return false;
  // Native decoded vectors need not have exactly unit length. Normalizing them
  // would move the stop window relative to the imported road geometry.
  const dot=(vehicle.position[0]-n.position[0])*n.direction[0]+(vehicle.position[1]-n.position[1])*n.direction[1];
  if(travelSign===-1?dot>0&&dot<window:dot<0&&dot>-window)return true;
 }
 return false;
}
