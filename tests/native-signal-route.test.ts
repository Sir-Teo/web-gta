import {expect,test} from 'vitest';
import type {PathArea,NavigationNode} from '../src/assets/pathNodes';
import {nativeShouldStopForPathLight as stop,type NativeSignalRouteVehicle} from '../src/world/nativeSignalStop';

const navigation:NavigationNode={position:[100,200],direction:[1,0],attachedTo:{area:16,node:4},trafficLightState:1,trafficLightDirection:true,width:1,sameLanes:1,oppositeLanes:1,bridgeLights:false,flags:0};
const area=(id:number,navi:NavigationNode[]):PathArea=>({area:id,navigation:navi,nodes:[],links:[],navigationLinks:[],vehicleCount:0,pedestrianCount:0,linkCount:0,lengths:new Uint8Array(),intersections:new Uint8Array(),bytesRead:0});
const vehicle=():NativeSignalRouteVehicle=>({position:[105,200],appearance:'car',physicsStatus:true,current:{navigationAddress:{area:15,node:0},routeAddress:{area:16,node:4},travelSign:-1}});

test('resolves navigation in its own area, independently of the route anchor area',()=>{
 const areas=new Map([[15,area(15,[navigation])]]),v=vehicle();
 expect(stop(areas,v,12000)).toBe(true);
 expect(areas.has(16)).toBe(false);
 // Streaming removes the navigation owner; the next check cannot use stale data.
 areas.delete(15);expect(stop(areas,v,12000)).toBe(false);
 areas.set(15,area(15,[{...navigation,trafficLightState:2}]));expect(stop(areas,v,12000)).toBe(false);
 expect(stop(areas,v,0)).toBe(true);
});

test('skips invalid/unloaded navigation slots and still evaluates subsequent slots',()=>{
 const areas=new Map([[15,area(15,[navigation])],[63,area(63,Array(1024).fill(navigation))]]),v=vehicle();
 v.next={...v.current!};
 for(const address of [null,{area:63,node:1023},{area:64,node:0},{area:-1,node:0},{area:15,node:1024},{area:15,node:-1},{area:15,node:.5},{area:NaN,node:0},{area:15,node:1},{area:14,node:0}]){
  v.current={...v.next,navigationAddress:address};
  expect(stop(areas,v,12000)).toBe(true);
  expect(stop(areas,{...v,next:undefined},12000)).toBe(false);
 }
 // Area 63 itself is valid; only the all-ones packed address is the sentinel.
 v.current={...v.next,navigationAddress:{area:63,node:0}};expect(stop(areas,{...v,next:undefined},12000)).toBe(true);
});

test('keeps distinct route addresses and signs for current, next and previous',()=>{
 const areas=new Map([[15,area(15,[navigation])]]),v=vehicle();
 v.current!.routeAddress={area:15,node:4};v.next={navigationAddress:{area:15,node:0},routeAddress:{area:16,node:4},travelSign:1};
 v.previous={...v.next,travelSign:-1};expect(stop(areas,v,12000)).toBe(true);
 v.physicsStatus=false;expect(stop(areas,v,12000)).toBe(false);
 v.next.travelSign=-1;expect(stop(areas,v,12000)).toBe(true);
});
