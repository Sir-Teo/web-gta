import {expect,test} from 'vitest';
import {FRONT_CLIPS,fallenDuringGetUp,getUpBlockedBy,getUpClip,isFrontClip,stuckUnderCarDamage,GET_UP_CLEAR_RADIUS} from '../src/ped/nativeGetUp';
test('the get-up clip follows the ANIMATION_IS_FRONT flag of the fall clip',()=>{
 for(const clip of ['ko_shot_front','KO_skid_back','floor_hit_f','ev_dive','car_jackedlhs','car_rollout_rhs','fall_front'])expect(getUpClip(clip)).toBe('getup_front');
 for(const clip of ['ko_skid_front','ko_spin_l','ko_spin_r','ko_shot_face','ko_shot_stom','floor_hit','fall_back','kd_left',undefined])expect(getUpClip(clip)).toBe('getup');
 expect(isFrontClip('GETUP_FRONT')).toBe(true);expect(FRONT_CLIPS.size).toBe(10);
});
test('a car over the origin sphere holds the ped down unless it is a bike, the mount or the floor under it',()=>{
 expect(GET_UP_CLEAR_RADIUS).toBe(.25);
 expect(getUpBlockedBy(undefined)).toBe(false);
 expect(getUpBlockedBy({bike:false,standingOn:false,attached:false})).toBe(true);
 expect(getUpBlockedBy({bike:true,standingOn:false,attached:false})).toBe(false);
 expect(getUpBlockedBy({bike:false,standingOn:true,attached:false})).toBe(false);
 expect(getUpBlockedBy({bike:false,standingOn:false,attached:true})).toBe(false);
});
test('a stuck player loses the time step a frame; a stuck NPC nothing until the player loses controls',()=>{
 expect(stuckUnderCarDamage(1,true)).toBe(1);expect(stuckUnderCarDamage(1.5,true)).toBe(1.5);expect(stuckUnderCarDamage(0,true)).toBe(0);
 expect(stuckUnderCarDamage(1,false)).toBe(0);expect(stuckUnderCarDamage(1,false,true)).toBe(1000);
});
test('the ped counts as fallen for the first three quarters of the get-up',()=>{
 expect(fallenDuringGetUp(0,1.37)).toBe(true);expect(fallenDuringGetUp(1.0,1.37)).toBe(true);expect(fallenDuringGetUp(1.03,1.37)).toBe(false);
});
