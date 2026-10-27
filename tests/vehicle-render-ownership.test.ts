import {expect,test} from 'vitest';
import {Group} from 'three';
import {setVehicleRenderOwner,withHiddenVehicle} from '../src/render/vehicleRenderOwnership';

test('a vehicle draw suppresses its seated bodies and restores each original visibility',()=>{
 const vehicle=new Group(),driver=new Group(),passenger=new Group();passenger.visible=false;
 setVehicleRenderOwner(driver,vehicle);setVehicleRenderOwner(passenger,vehicle);
 const result=withHiddenVehicle(vehicle,()=>{expect([vehicle.visible,driver.visible,passenger.visible]).toEqual([false,false,false]);return 7;});
 expect(result).toBe(7);expect([vehicle.visible,driver.visible,passenger.visible]).toEqual([true,true,false]);
});
test('changing or clearing a seat owner prevents a former vehicle from hiding the ped',()=>{
 const a=new Group(),b=new Group(),ped=new Group();setVehicleRenderOwner(ped,a);setVehicleRenderOwner(ped,b);
 withHiddenVehicle(a,()=>expect(ped.visible).toBe(true));withHiddenVehicle(b,()=>expect(ped.visible).toBe(false));
 setVehicleRenderOwner(ped);withHiddenVehicle(b,()=>expect(ped.visible).toBe(true));
});
test('nested or failed draws restore visibility without leaking into later passes',()=>{
 const vehicle=new Group(),ped=new Group();setVehicleRenderOwner(ped,vehicle);
 expect(()=>withHiddenVehicle(vehicle,()=>{withHiddenVehicle(vehicle,()=>expect(ped.visible).toBe(false));expect(ped.visible).toBe(false);throw new Error('draw failed');})).toThrow('draw failed');
 expect(vehicle.visible).toBe(true);expect(ped.visible).toBe(true);
});
