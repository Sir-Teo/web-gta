import {expect,test} from 'vitest';
import {nativeTrafficLights,TRAFFIC_LIGHT as L} from '../src/world/nativeTrafficLights';
test('matches every native phase boundary including odd milliseconds and the pedestrian clearance interval',()=>{
 const cases:[number,number,number,number][]=[
  [0,L.green,L.red,L.red],[9999,L.green,L.red,L.red],
  [10000,L.yellow,L.red,L.red],[11999,L.yellow,L.red,L.red],
  [12000,L.red,L.green,L.red],[21999,L.red,L.green,L.red],
  [22000,L.red,L.yellow,L.red],[23999,L.red,L.yellow,L.red],
  [24000,L.red,L.red,L.green],[30765,L.red,L.red,L.green],
  [30766,L.red,L.red,L.yellow],[32767,L.red,L.red,L.yellow],
  [32768,L.green,L.red,L.red],
 ];
 for(const [time,a,b,pedestrians] of cases){const s=nativeTrafficLights(time);expect(s.cars,String(time)).toEqual([a,b]);expect(s.visualCars).toEqual(s.cars);expect(s.pedestrians).toBe(pedestrians);}
});
test('riots flash visible lamps while vehicle logic stays green; cheat does not change pedestrian phases',()=>{
 for(const time of [0,1023,1024,2047,2048,24000]){
  const state=nativeTrafficLights(time,{riots:true});expect(state.cars).toEqual([L.green,L.green]);expect(state.visualCars).toEqual(Array(2).fill(Math.floor(time/1024)%2?L.off:L.yellow));
  expect(state.pedestrians).toBe(nativeTrafficLights(time).pedestrians);
 }
 const cheat=nativeTrafficLights(14000,{greenLightsCheat:true});expect(cheat.cars).toEqual([L.green,L.green]);expect(cheat.visualCars).toEqual(cheat.cars);expect(cheat.pedestrians).toBe(L.red);
 expect(nativeTrafficLights(1024,{riots:true,greenLightsCheat:true}).visualCars).toEqual([L.off,L.off]);
});
test('uses unsigned timer phases up to rollover and rejects accidental wall-clock or fractional inputs',()=>{
 expect(nativeTrafficLights(0xffffffff)).toEqual(nativeTrafficLights(32767));
 expect(nativeTrafficLights(0)).toEqual(nativeTrafficLights(32768));
 for(const time of [-1,.5,NaN,Infinity,0x100000000,Date.now()])expect(()=>nativeTrafficLights(time)).toThrow('traffic-light');
});
