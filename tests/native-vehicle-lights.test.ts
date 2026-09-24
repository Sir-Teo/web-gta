import {expect,test} from 'vitest';
import {vehicleLightsStatus} from '../src/simulation/nativeVehicleLights';

const base={seed:100,gangDriverOddSeed:false,gangArea:false,hours:12,minutes:0,foggyness:0,wetRoads:0,contactBrightness:1,camNoRain:false};
test('GetVehicleLightsStatus: night, the staggered switch at 20:xx and 06:xx, fog and rain, the dark, gang cars',()=>{
 expect(vehicleLightsStatus(base)).toBe(false);
 expect(vehicleLightsStatus({...base,hours:21})).toBe(true);expect(vehicleLightsStatus({...base,hours:5,minutes:59})).toBe(true);
 // seed % 64 = 36: on after 20:36, off from 06:36.
 expect(vehicleLightsStatus({...base,hours:20,minutes:36})).toBe(false);expect(vehicleLightsStatus({...base,hours:20,minutes:37})).toBe(true);
 expect(vehicleLightsStatus({...base,hours:6,minutes:35})).toBe(true);expect(vehicleLightsStatus({...base,hours:6,minutes:36})).toBe(false);
 // Rain or fog past seed / 50000.
 expect(vehicleLightsStatus({...base,wetRoads:.003})).toBe(true);expect(vehicleLightsStatus({...base,seed:30000,wetRoads:.5})).toBe(false);
 expect(vehicleLightsStatus({...base,contactBrightness:.04,camNoRain:true})).toBe(true);expect(vehicleLightsStatus({...base,contactBrightness:.04})).toBe(false);
 expect(vehicleLightsStatus({...base,hours:23,gangDriverOddSeed:true,gangArea:true})).toBe(false);
 expect(vehicleLightsStatus({...base,hours:23,gangDriverOddSeed:true})).toBe(true);
});
