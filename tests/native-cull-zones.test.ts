import {expect,test} from 'vitest';
import {readCullZoneLine} from '../src/assets/ipl';
import {NativeCullZones,ZONE} from '../src/world/nativeCullZones';

test('LoadCullZone splits tunnel zones from attribute zones and CZoneDef tests the int16 box',()=>{
 const zones=new NativeCullZones();
 // A tunnel (0x2800 = TUNNEL | the unnamed 0x2000 CWeather reads) and a no-rain box.
 zones.load([readCullZoneLine('-1450.47, -102.347, 4.69406, 0, 149, 4.69406, 29, 0, 12.6941, 10240, 0')!,readCullZoneLine('0, 0, 0, 10, 0, -5, 0, 10, 20, 8, 0')!]);
 expect(zones.tunnelZones).toHaveLength(1);expect(zones.attributeZones.map(z=>z.flags)).toEqual([0x2000,ZONE.noRain]);
 expect(zones.tunnelAttributesAt([-1450,-102,8])).toBe(10240);
 expect(zones.tunnelAttributesAt([-1450,-102,20])).toBe(0);
 expect(zones.attributesAt([3,3,1])).toBe(ZONE.noRain);expect(zones.attributesAt([30,3,1])).toBe(0);
 // Update: the camera on frame 2 of 8, the player on 6.
 zones.update(2,[3,3,1],[99,99,0],false);expect(zones.camNoRain).toBe(true);expect(zones.playerNoRain).toBe(false);
 expect(zones.renderTunnels([-1450,-102,8])).toEqual({tunnels:true,outside:false});
 expect(zones.renderTunnels([0,0,500])).toEqual({tunnels:false,outside:true});
});
test('a player in a military zone gets five stars unless the script disabled them',()=>{
 const zones=new NativeCullZones();zones.load([readCullZoneLine('0, 0, 0, 10, 0, -5, 0, 10, 20, 4096, 0')!]);
 let stars=0;zones.update(6,[0,0,0],[1,1,1],false,()=>{stars=5;});expect(stars).toBe(5);
 stars=0;zones.update(14,[0,0,0],[1,1,1],true,()=>{stars=5;});expect(stars).toBe(0);
});
import {fewerPedsLimits} from '../src/world/nativeCullZones';
import {VEHICLE_AIR_RESISTANCE_MULT,nativeAirResistance} from '../src/simulation/nativeAirResistance';
test('fewer-peds and extra-air-resistance zones follow the player, not the camera',()=>{
 const zones=new NativeCullZones();
 zones.load([readCullZoneLine('0, 0, 0, 10, 0, -5, 0, 10, 20, 1024, 0')!,readCullZoneLine('100, 0, 0, 10, 0, -5, 0, 10, 20, 16384, 0')!]);
 zones.update(2,[3,3,1],[500,500,0],false);expect(zones.fewerPeds).toBe(false);
 zones.update(6,[500,500,0],[3,3,1],false);expect(zones.fewerPeds).toBe(true);expect(zones.extraAirResistance).toBe(false);
 zones.update(14,[3,3,1],[103,3,1],false);expect(zones.fewerPeds).toBe(false);expect(zones.extraAirResistance).toBe(true);
 expect(fewerPedsLimits({civilians:18,total:26},true)).toEqual({civilians:10,total:15});
 expect(fewerPedsLimits({civilians:18,total:26},false)).toEqual({civilians:18,total:26});
 expect(fewerPedsLimits(undefined,true)).toBeUndefined();
});
test('ApplyAirResistance takes 2.5 times the drag in an extra-air-resistance zone',()=>{
 const v={x:0,y:40/50,z:0},w={x:0,y:0,z:0};
 const plain=nativeAirResistance(v,w,1,.001),extra=nativeAirResistance(v,w,1,.001,VEHICLE_AIR_RESISTANCE_MULT);
 expect(1-plain.factor).toBeCloseTo(.0008,6);expect(1-extra.factor).toBeCloseTo(.002,6);
});
