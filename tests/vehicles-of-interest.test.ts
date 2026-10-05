import {expect,test} from 'vitest';
import {VehiclesOfInterest} from '../src/vehicle/vehiclesOfInterest';
// CCarCtrl's apCarsToKeep: RegisterVehicleOfInterest (iOS), PruneVehiclesOfInterest and the list's upkeep.
test('two places: a kept car renewed, an empty place taken, else the one he was in longer ago replaced',()=>{
 const list=new VehiclesOfInterest<{id:string}>(),a={id:'a'},b={id:'b'},c={id:'c'};
 list.register(a,1000);list.register(b,2000);expect(list.cars).toEqual([a,b]);
 // a again: its time renewed, so b is now the older one and c takes b's place.
 list.register(a,3000);list.register(c,4000);expect(list.cars).toEqual([a,c]);expect(list.times).toEqual([3000,4000]);
 // On a tie the first place goes.
 const tie=new VehiclesOfInterest<{id:string}>();tie.register(a,5);tie.register(b,5);tie.register(c,6);expect(tie.cars).toEqual([c,b]);
 expect(list.has(a)&&list.has(c)&&!list.has(b)).toBe(true);
 list.remove(a);expect(list.cars).toEqual([undefined,c]);list.clear();expect(list.cars).toEqual([undefined,undefined]);
});
test('pruned three minutes after he was last in it, on the 19th of each 64 frames, never inside an interior',()=>{
 const list=new VehiclesOfInterest<object>(),car={};list.register(car,0);
 list.prune(180001,82,10);expect(list.has(car)).toBe(true);
 list.prune(180000,19,10);expect(list.has(car)).toBe(true);
 list.prune(180001,19+64,1000);expect(list.has(car)).toBe(true);
 list.prune(180001,19+64,10);expect(list.has(car)).toBe(false);
});
