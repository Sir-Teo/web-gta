import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {readHandling} from '../src/assets/handling';
import {readVehicleAnimGroups,vehicleAnimation,VEHICLE_ANIM} from '../src/assets/vehicleAnimGroups';

test('bike entry groups resolve jumpon, getoff and ped-block align clips',()=>{
 const handling=readHandling(readFileSync('public/play/world/files/vehicles/handling.cfg','utf8'));
 const groups=readVehicleAnimGroups(handling.supplements);
 const bmx=groups.get(9)!,sport=groups.get(4)!,quad=groups.get(12)!;
 expect([bmx.first,bmx.second]).toEqual([9,3]);
 // Bicycles mount from either side with no kick clip.
 expect(vehicleAnimation(bmx,VEHICLE_ANIM.getinLHS)).toEqual({group:9,file:'bmx',name:'bmx_jumponL'});
 expect(vehicleAnimation(bmx,VEHICLE_ANIM.getinRHS)).toEqual({group:9,file:'bmx',name:'bmx_jumponR'});
 expect(vehicleAnimation(bmx,VEHICLE_ANIM.getinBike)).toBeUndefined();
 expect(vehicleAnimation(bmx,VEHICLE_ANIM.getoutLHS)).toEqual({group:9,file:'bmx',name:'bmx_getoffLHS'});
 // Sport bikes kick from their own block but align from the shared ped block.
 expect(vehicleAnimation(sport,VEHICLE_ANIM.getinBike)).toEqual({group:4,file:'bikes',name:'BIKEs_kick'});
 expect(vehicleAnimation(sport,VEHICLE_ANIM.alignLHS)).toEqual({group:3,file:'ped',name:'BIKE_pickupR'});
 expect(vehicleAnimation(sport,VEHICLE_ANIM.getoutLHS)).toEqual({group:4,file:'bikes',name:'BIKEs_getoffRHS'});
 // The quad boards with geton clips.
 expect(vehicleAnimation(quad,VEHICLE_ANIM.getinLHS)).toEqual({group:12,file:'quad',name:'quad_geton_LHS'});
 expect(vehicleAnimation(quad,VEHICLE_ANIM.getoutRHS)).toEqual({group:12,file:'quad',name:'quad_getoff_RHS'});
});
