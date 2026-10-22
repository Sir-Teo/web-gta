import {readFileSync} from 'node:fs';
import {expect,test,vi} from 'vitest';
import {ScmMission} from '../src/simulation/ScmMission';
function setup(){
 const car={},other={},pose={x:10,y:20,z:30};let riding=true,passenger=true;
 const m=new ScmMission(new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),{infoLabels:['TEST'],population:[]}as any,{
  playerPed:()=>({position:pose,vehicle:riding?{appearance:2,train:false,model:417,passenger,passengerSeat:0}:undefined,stopped:true,health:100,dead:false}),
  playerVehicleEntity:()=>car,scriptVehiclePosition:()=>pose,scriptVehicleHeading:()=>0,scriptVehicleAlive:()=>true,
 }as any);
 const h=m.vehicles.handleFor(car,417),unrelated=m.vehicles.handleFor(other,487),w=m.runtime.world!;
 return{m,w,h,unrelated,setRiding:(on:boolean)=>riding=on,setPassenger:(on:boolean)=>passenger=on};
}
test('passenger seat queries include CJ and clear when he leaves',()=>{
 const f=setup();expect(f.w.pedInPassengerSeat!(f.h,0)).toBe(1);expect(f.w.vehiclePassengerSeatIsFree!(f.h,0)).toBe(false);expect(f.w.vehiclePassengerCount!(f.h)).toBe(1);
 expect(f.w.pedInPassengerSeat!(f.h,1)).toBe(-1);expect(f.w.vehiclePassengerSeatIsFree!(f.h,1)).toBe(true);expect(f.w.vehiclePassengerCount!(f.unrelated)).toBe(0);
 f.setRiding(false);expect(f.w.pedInPassengerSeat!(f.h,0)).toBe(-1);expect(f.w.vehiclePassengerSeatIsFree!(f.h,0)).toBe(true);expect(f.w.vehiclePassengerCount!(f.h)).toBe(0);
});
test('the player augments NPC passenger queries while a driver does not occupy a passenger seat',()=>{
 const f=setup();vi.spyOn(f.m.peds,'passengersOf').mockReturnValue(2);vi.spyOn(f.m.peds,'occupantOf').mockImplementation((_h,seat)=>seat===1?99:undefined);vi.spyOn(f.m.peds,'seatTaken').mockImplementation((_h,seat)=>seat===1);
 expect(f.w.vehiclePassengerCount!(f.h)).toBe(3);expect(f.w.pedInPassengerSeat!(f.h,0)).toBe(1);expect(f.w.pedInPassengerSeat!(f.h,1)).toBe(99);expect(f.w.vehiclePassengerSeatIsFree!(f.h,1)).toBe(false);
 f.setPassenger(false);expect(f.w.vehiclePassengerCount!(f.h)).toBe(2);expect(f.w.pedInPassengerSeat!(f.h,0)).toBe(-1);expect(f.w.vehiclePassengerSeatIsFree!(f.h,0)).toBe(true);
});
