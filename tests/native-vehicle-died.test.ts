import {expect,test} from 'vitest';
import {respondToVehicleDeath} from '../src/simulation/nativeVehicleDied';

test('a vehicle death kills its living occupant and replaces its activity with scorched death',()=>{
 const rider={health:100,car:{wrecked:true},driveBy:{},clip:{},renderScorched:false,diedInSeat:false};
 expect(respondToVehicleDeath(rider)).toBe(true);expect(rider).toMatchObject({health:0,renderScorched:true,diedInSeat:true,driveBy:undefined,clip:undefined});
 expect(respondToVehicleDeath(rider)).toBe(false);
});

test('vehicle death excludes attached peds, removed peds, intact vehicles and already dead occupants',()=>{
 for(const overrides of [{offset:{x:0,y:0,z:0}},{gone:true},{car:{wrecked:false}},{health:0}]){
  const rider={health:100,car:{wrecked:true},renderScorched:false,...overrides},before=structuredClone(rider);
  expect(respondToVehicleDeath(rider)).toBe(false);expect(rider).toEqual(before);
 }
});
