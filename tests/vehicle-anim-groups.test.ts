import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {readHandling} from '../src/assets/handling';
import {VEHICLE_ANIM,nativeDoorAnimRatio,readVehicleAnimGroups,vehicleAnimation} from '../src/assets/vehicleAnimGroups';
import {nativeDoorPoint} from '../src/simulation/CarEntry';
const groups=readVehicleAnimGroups(readHandling(readFileSync('public/play/world/files/vehicles/handling.cfg','latin1')).supplements);
test('handling.cfg ^ rows fill CVehicleAnimGroup with group selectors, blend times and door windows',()=>{
 expect(groups.size).toBe(30);
 expect(groups.get(0)).toEqual({id:0,first:0,second:0,flags:0,special:0,times:{getIn:.5,jumpOut:0,getOut:-.5,jackedOut:-.3,fallOut:.3},openOut:[.41,.8],closeIn:[.3,.45],openIn:[.06,.43],closeOut:[.2,.43]});
 const low=groups.get(1)!;expect(low.flags).toBe((1<<14)|(1<<16)|(1<<17));
 expect(vehicleAnimation(low,VEHICLE_ANIM.getinLHS)).toEqual({group:1,file:'ped',name:'CAR_getinL_LHS'});
 expect(vehicleAnimation(low,VEHICLE_ANIM.rolloutLHS)).toEqual({group:0,file:'ped',name:'CAR_rollout_LHS'});
 expect(vehicleAnimation(groups.get(2)!,VEHICLE_ANIM.getinLHS)).toEqual({group:2,file:'truck',name:'TRUCK_getin_LHS'});
 expect(groups.get(2)!.openIn).toEqual([.03,.23]);expect(groups.get(19)).toBeDefined();expect(vehicleAnimation(groups.get(19)!,VEHICLE_ANIM.getinLHS)?.name).toBe('CAR_jumpin_LHS');
 expect(vehicleAnimation(groups.get(0)!,12)).toBeUndefined();
});
test('CVehicle::ProcessOpenDoor windows, monotonic stages and untouched window edges',()=>{
 const std=groups.get(0)!;
 expect(nativeDoorAnimRatio(std,'open',.3,0)).toBe(0);expect(nativeDoorAnimRatio(std,'open',.605,0)).toBeCloseTo(.5);expect(nativeDoorAnimRatio(std,'open',.605,.7)).toBeUndefined();expect(nativeDoorAnimRatio(std,'open',.41,0)).toBeUndefined();expect(nativeDoorAnimRatio(std,'open',.9,0)).toBe(1);
 expect(nativeDoorAnimRatio(std,'closeInside',.375,.2)).toBeCloseTo(.5);expect(nativeDoorAnimRatio(std,'closeInside',.2,0)).toBe(1);
 expect(nativeDoorAnimRatio(std,'closeOutside',.315,.2)).toBeUndefined();expect(nativeDoorAnimRatio(std,'closeOutside',.315,1)).toBeCloseTo(.5);
 expect(nativeDoorAnimRatio(std,'getOut',.245,0)).toBeCloseTo(.5);expect(nativeDoorAnimRatio(std,'jacked',.25,0)).toBeCloseTo(.5);
 expect(nativeDoorAnimRatio(std,'pullout',1,0,0)).toBe(1);expect(nativeDoorAnimRatio(std,'pullout',1,0,13)).toBeUndefined();expect(nativeDoorAnimRatio(std,'rollout',.055,0,0)).toBeCloseTo(.5);
});
test('GetPositionToOpenCarDoor from the Greenwood seat, the CAR_getin_LHS end offset and the handling seat offset',()=>{
 const seat={x:.463,y:.14,z:-.095},end={x:.951,y:.486,z:-.35};
 const left=nativeDoorPoint(seat,end,.22,'left');expect(left.x).toBeCloseTo(-1.634);expect(left.y).toBeCloseTo(-.346);expect(left.z).toBeCloseTo(.255);
 expect(nativeDoorPoint(seat,end,.22,'left',0).x).toBeCloseTo(-1.414);expect(nativeDoorPoint({...seat,x:-.463},end,.22,'right').x).toBeCloseTo(1.634);
});
