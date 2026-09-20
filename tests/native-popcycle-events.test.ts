import {expect,test} from 'vitest';
import {pedTypeAtLeastDealer,playerKilledADealer} from '../src/simulation/nativePopCycleEvents';
import type {WorldZones,WorldZone} from '../src/assets/worldZones';
const zone=(infoLabel:string,i:number,min:[number,number],max:[number,number]):WorldZone=>({infoLabel,textLabel:infoLabel,type:0,min:[min[0],min[1],-100],max:[max[0],max[1],500],level:0,line:0,source:'t',zoneInfoIndex:i});
test('a player kill of a dealer (or any type from dealer up) takes one dealer strength off the zone he stands in',()=>{
 expect(pedTypeAtLeastDealer('DEALER')).toBe(true);expect(pedTypeAtLeastDealer('BUM')).toBe(true);expect(pedTypeAtLeastDealer('MISSION3')).toBe(true);
 expect(pedTypeAtLeastDealer('CIVMALE')).toBe(false);expect(pedTypeAtLeastDealer('GANG1')).toBe(false);expect(pedTypeAtLeastDealer(undefined)).toBe(false);
 const zones:WorldZones={navigation:[zone('SAN_AND',0,[-3000,-3000],[3000,3000]),zone('GAN',1,[2400,-1750],[2600,-1600])],map:[],infoLabels:['SAN_AND','GAN'],
  population:[{popType:0,gangStrength:Array(10).fill(0),dealerStrength:0,races:15,noCops:false},{popType:0,gangStrength:Array(10).fill(0),dealerStrength:2,races:15,noCops:false}]};
 expect(playerKilledADealer(zones,{x:2500,y:-1700,z:10})).toBe(1);
 expect(playerKilledADealer(zones,{x:2500,y:-1700,z:10})).toBe(0);
 expect(playerKilledADealer(zones,{x:2500,y:-1700,z:10})).toBe(0);
 expect(playerKilledADealer(undefined,{x:0,y:0,z:0})).toBeUndefined();
});
