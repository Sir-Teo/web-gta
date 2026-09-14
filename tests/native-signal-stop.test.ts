import {expect,test} from 'vitest';
import {nativeShouldStopForLight as stop,type NativeSignalApproach,type NativeSignalVehicle} from '../src/world/nativeSignalStop';

const approach=(overrides:Partial<NativeSignalApproach['navigation']>={}):NativeSignalApproach=>({
 navigation:{position:[100,200],direction:[1,0],attachedTo:{area:15,node:10},trafficLightState:1,trafficLightDirection:true,...overrides},
 routeAddress:{area:15,node:10},travelSign:-1,
});
const vehicle=(current=approach()):NativeSignalVehicle=>({position:[105,200],appearance:'car',physicsStatus:true,current});

test('yellow and red stop, green passes, with logical riot/cheat overrides',()=>{
 const v=vehicle();
 for(const [time,expected] of [[0,false],[9999,false],[10000,true],[12000,true],[32768,false]] as const)expect(stop(v,time)).toBe(expected);
 v.current=approach({trafficLightState:2});
 expect(stop(v,0)).toBe(true);expect(stop(v,12000)).toBe(false);expect(stop(v,22000)).toBe(true);
 expect(stop(v,0,{riots:true})).toBe(false);expect(stop(v,0,{greenLightsCheat:true})).toBe(false);
 expect(stop(v,12000,{},true)).toBe(true);
});

test('direction flag compares the complete route address, including area',()=>{
 for(const flag of [false,true])for(const attached of [false,true]){
  const a=approach({trafficLightDirection:flag});a.routeAddress={area:attached?15:16,node:10};
  expect(stop(vehicle(a),12000),`${flag}/${attached}`).toBe(flag===attached);
 }
 const v=vehicle();v.current!.routeAddress.node=11;expect(stop(v,12000)).toBe(false);
 v.current=approach({trafficLightState:0});expect(stop(v,12000,{},true)).toBe(false);
});

test('strict signed approach windows exclude zero, endpoints and the far side',()=>{
 for(const slot of ['current','next','previous'] as const)for(const sign of [-1,1]){
  const limit=slot==='previous'?6:12;
  for(const [distance,expected] of [[-.001,false],[0,false],[.001,true],[limit-.001,true],[limit,false],[limit+.001,false]] as const){
   const a=approach();a.travelSign=sign;
   const v=vehicle();delete v.current;v[slot]=a;v.position=[100+distance*(sign===-1?1:-1),200];
   expect(stop(v,12000),`${slot}/${sign}/${distance}`).toBe(expected);
  }
 }
});

test('uses the imported vector projection rather than radius, heading or normalized direction',()=>{
 const v=vehicle(approach({direction:[.5,0]}));v.position=[120,900];expect(stop(v,12000)).toBe(true);
 v.position=[124,900];expect(stop(v,12000)).toBe(false);
 v.current=approach({direction:[0,-1]});v.position=[900,195];expect(stop(v,12000)).toBe(true);
});

test('checks current then next then physics-only previous, preserving green short-circuit',()=>{
 const v=vehicle(approach({trafficLightState:2}));v.next=approach();
 v.current!.navigation.position=[1000,200];
 // Current is green, far outside the window; it still suppresses next's red.
 expect(stop(v,12000)).toBe(false);
 v.current!.navigation.trafficLightDirection=false;expect(stop(v,12000)).toBe(true);
 delete v.current;expect(stop(v,12000)).toBe(true);
 delete v.next;v.previous=approach();expect(stop(v,12000)).toBe(true);
 v.physicsStatus=false;expect(stop(v,12000)).toBe(false);
 v.current=approach();expect(stop(v,12000)).toBe(true);
 v.next=approach({trafficLightState:2});expect(stop(v,12000)).toBe(true);
 delete v.current;v.physicsStatus=true;expect(stop(v,12000)).toBe(false);
 v.next.navigation.trafficLightDirection=false;expect(stop(v,12000)).toBe(true);
});

test('excludes aircraft; the phase override still requires a nearby applicable link',()=>{
 for(const appearance of ['car','bike','boat','heli','plane'] as const){
  const v=vehicle();v.appearance=appearance;expect(stop(v,12000)).toBe(!['heli','plane'].includes(appearance));
 }
 const v=vehicle();v.position=[150,200];expect(stop(v,0,{},true)).toBe(false);
 v.position=[105,200];v.current!.navigation.trafficLightDirection=false;expect(stop(v,0,{},true)).toBe(false);
 // Reserved group 3 follows source behavior: pass normally, proximity with override.
 v.current=approach({trafficLightState:3});expect(stop(v,12000)).toBe(false);expect(stop(v,12000,{},true)).toBe(true);
});
