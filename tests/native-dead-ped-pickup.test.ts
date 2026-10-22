import {expect,test} from 'vitest';
import {deadPedPickupCoors,type DeadPedPickupWorld} from '../src/ped/nativeDeadPedPickup';

const ped={x:10,y:20,z:5};
/** A flat floor at z 4, nothing in the way, draws cycling through the given values. */
function world(draws:number[],over:Partial<DeadPedPickupWorld>={}):DeadPedPickupWorld{
 let i=0;
 return {groundZ:()=>4,pickupsInBubble:()=>false,lineOfSightClear:()=>true,vehicleInSphere:()=>false,random256:()=>draws[i++%draws.length],...over};
}

test('the first try 1.5 units out on clear ground, half a unit over it',()=>{
 // Draws 0 and 0: sin 0 across, cos 0 along, so straight north of the ped.
 const at=deadPedPickupCoors(ped,{x:100,y:100},world([0,0]));
 expect(at.x).toBeCloseTo(10,6);expect(at.y).toBeCloseTo(21.5,6);expect(at.z).toBeCloseTo(4.5,6);
});

test('a spot within 2 of the player, near a pickup or by a car is passed over for the first half of the tries',()=>{
 // Every try lands north; the player stands there, so only the late tries (index 17 on, the eighteenth) may take it.
 let tries=0;
 const w=world([0,0],{groundZ:()=>{tries++;return 4;}});
 deadPedPickupCoors(ped,{x:10,y:21.5},w);
 expect(tries).toBe(18);
 tries=0;deadPedPickupCoors(ped,{x:100,y:100},world([0,0],{groundZ:()=>{tries++;return 4;},vehicleInSphere:()=>true}));
 expect(tries).toBe(18);
 tries=0;deadPedPickupCoors(ped,{x:100,y:100},world([0,0],{groundZ:()=>{tries++;return 4;},pickupsInBubble:()=>true}));
 expect(tries).toBe(18);
});

test('the line back to the ped asks after vehicles and objects only in the first half; no ground anywhere leaves the ped\'s spot',()=>{
 const asked:boolean[]=[];
 deadPedPickupCoors(ped,{x:100,y:100},world([0,0],{lineOfSightClear:(_a,_b,both)=>{asked.push(both);return false;}}));
 expect(asked.length).toBe(32);expect(asked.slice(0,16).every(Boolean)).toBe(true);expect(asked.slice(16).some(Boolean)).toBe(false);
 expect(deadPedPickupCoors(ped,{x:100,y:100},world([0,0],{groundZ:()=>undefined}))).toEqual({x:10,y:20,z:Math.fround(5.4)});
});
