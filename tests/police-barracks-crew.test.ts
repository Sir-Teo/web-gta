import {expect,test} from 'vitest';
import {policeCrew} from '../src/simulation/WorldPolice';
import {pedEnteredVehicleLeaveDelay} from '../src/simulation/nativePedEnteredVehicle';

// CCarAI::AddPoliceCarOccupants: MODEL_BARRACKS shares the city cars' case, so its army driver gets a partner above one
// star or else one time in two, and above two stars one of them a shotgun one time in four.
test('the Barracks crews as a city cop car',()=>{
 expect(policeCrew(433,0,1,()=>.9)).toMatchObject({seats:1,member:{model:'army',weapon:31}});
 expect(policeCrew(433,0,1,()=>.1)).toMatchObject({seats:2});
 expect(policeCrew(433,0,2,()=>.9)).toMatchObject({seats:2,shotgunSeat:undefined});
 expect(policeCrew(433,0,3,()=>.1)).toMatchObject({seats:2,shotgunSeat:0});
 let rolls=0;expect(policeCrew(433,0,3,()=>rolls++===0?.9:.1)).toMatchObject({seats:2,shotgunSeat:1});
 // The Enforcer, FBI Rancher and Rhino keep their own crews.
 expect(policeCrew(427,0,3,()=>.1)).toMatchObject({seats:4,member:{model:'swat'}});
 expect(policeCrew(432,0,3,()=>.1)).toMatchObject({seats:1,member:{model:'army'}});
});

test('a passenger CJ did not drag out leaves after 300 to 599 ms (iOS ComputePedEnteredVehicleResponse)',()=>{
 expect(pedEnteredVehicleLeaveDelay(0)).toBe(.3);
 expect(pedEnteredVehicleLeaveDelay(0xffff)).toBe(.599);
 expect(pedEnteredVehicleLeaveDelay(0x8000)).toBe(.45);
});
