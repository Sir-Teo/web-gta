import {expect,test} from 'vitest';
import {WorldCar} from '../src/simulation/WorldCar';

// KillPedsInVehicle kills the player whether he drives or rides as a passenger (WARP_CHAR_INTO_CAR_AS_PASSENGER).
test('a car blowing up kills the player riding in a passenger seat',()=>{
  let died=0;
  const car={occupied:false,playerPassengerSeat:1,sim:{vehicleOccupantDied:()=>{died++;}}};
  (WorldCar.prototype as any).killPlayerAboard.call(car);
  expect(died).toBe(1);
  const empty={occupied:false,playerPassengerSeat:0,sim:{vehicleOccupantDied:()=>{died++;}}};
  (WorldCar.prototype as any).killPlayerAboard.call(empty);
  expect(died).toBe(1);
});
