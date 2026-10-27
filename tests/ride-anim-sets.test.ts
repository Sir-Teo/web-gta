import {expect,test} from 'vitest';
import {nativeRideAnims} from '../src/simulation/CarEntry';

const ride=(drivingSkill:number,speed=30,o:{low?:boolean;kart?:boolean;truck?:boolean}={})=>nativeRideAnims({low:!!o.low,kart:!!o.kart,truck:!!o.truck,drivingSkill,speed});

// Original-PC ProcessDrivingAnims and RideAnims.h define three skill tiers.
test('PC drivers use weak, standard and pro sets at the source thresholds',()=>{
 expect(ride(0)).toEqual({idle:'CAR_sit_weak',left:'Drive_L_weak',right:'Drive_R_weak',back:'CAR_LB_weak'});
 expect(ride(49.9)).toEqual({idle:'CAR_sit_weak',left:'Drive_L_weak',right:'Drive_R_weak',back:'CAR_LB_weak'});
 expect(ride(50)).toEqual({idle:'CAR_sit',left:'Drive_L',right:'Drive_R',back:'CAR_LB'});
 expect(ride(99.9)).toEqual({idle:'CAR_sit',left:'Drive_L',right:'Drive_R',back:'CAR_LB'});
 expect(ride(100)).toEqual({idle:'CAR_sit_pro',left:'Drive_L_pro',right:'Drive_R_pro',back:'CAR_LB_pro'});
 expect(ride(1000)).toEqual({idle:'CAR_sit_pro',left:'Drive_L_pro',right:'Drive_R_pro',back:'CAR_LB_pro'});
});

test('the slow steering clips at 0.4 a frame or less, and the low, kart and truck sets before skill',()=>{
 expect(ride(0,20)).toMatchObject({left:'Drive_L_weak_slow',right:'Drive_R_weak_slow'});
 expect(ride(80,20.1)).toMatchObject({left:'Drive_L',right:'Drive_R'});
 expect(ride(80,5,{low:true})).toEqual({idle:'CAR_Lsit',left:'Drive_LO_l',right:'Drive_LO_R',back:'CAR_LB'});
 expect(ride(80,5,{kart:true}).idle).toBe('KART_drive');
 expect(ride(80,5,{truck:true}).idle).toBe('Drive_truck');
});

test('boat wrappers retain category precedence and apply PC skill tiers to seated boats',()=>{
 const input={low:false,kart:false,truck:false,drivingSkill:0,speed:0,boat:true};
 expect(nativeRideAnims(input)).toEqual({idle:'drive_boat',left:'drive_boat_l',right:'drive_boat_r',back:'drive_boat_back'});
 expect(nativeRideAnims({...input,sitInBoat:true}).idle).toBe('CAR_sit_weak');
 expect(nativeRideAnims({...input,low:true}).idle).toBe('CAR_Lsit');
});
