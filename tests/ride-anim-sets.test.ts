import {expect,test} from 'vitest';
import {nativeRideAnims} from '../src/simulation/CarEntry';

const ride=(drivingSkill:number,speed=30,o:{low?:boolean;kart?:boolean;truck?:boolean}={})=>nativeRideAnims({low:!!o.low,kart:!!o.kart,truck:!!o.truck,drivingSkill,speed});

// iOS ProcessDrivingAnims (0x100480518): STAT_DRIVING_SKILL under 50 (0x1005908a0) takes the standard set at
// 0x100654280/0x100654290, from 50 the pro set at 0x1006542a0/0x1006542b0; nothing reads the weak clips.
test('a new player drives in the standard set, and from a skill of 50 in the pro one',()=>{
 expect(ride(0)).toEqual({idle:'CAR_sit',left:'Drive_L',right:'Drive_R',back:'CAR_LB'});
 expect(ride(49.9)).toEqual({idle:'CAR_sit',left:'Drive_L',right:'Drive_R',back:'CAR_LB'});
 expect(ride(50)).toEqual({idle:'CAR_sit_pro',left:'Drive_L_pro',right:'Drive_R_pro',back:'CAR_LB_pro'});
 expect(ride(1000)).toEqual({idle:'CAR_sit_pro',left:'Drive_L_pro',right:'Drive_R_pro',back:'CAR_LB_pro'});
});

test('the slow steering clips at 0.4 a frame or less, and the low, kart and truck sets before skill',()=>{
 expect(ride(0,20)).toMatchObject({left:'Drive_L_slow',right:'Drive_R_slow'});
 expect(ride(80,20.1)).toMatchObject({left:'Drive_L_pro',right:'Drive_R_pro'});
 expect(ride(80,5,{low:true})).toEqual({idle:'CAR_Lsit',left:'Drive_LO_l',right:'Drive_LO_R',back:'CAR_LB'});
 expect(ride(80,5,{kart:true}).idle).toBe('KART_drive');
 expect(ride(80,5,{truck:true}).idle).toBe('Drive_truck');
});
