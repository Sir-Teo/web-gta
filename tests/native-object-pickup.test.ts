import {expect,test} from 'vitest';
import {nativeObjectPickupPlan,nativeObjectPickupLift} from '../src/simulation/nativeObjectPickup';
const bounds={min:{x:-.5,y:-.5,z:-.1},max:{x:.5,y:.5,z:1}},object={position:{x:10,y:20,z:2},heading:0};

test('pickup chooses the facing COL side outside the box and transforms its approach point to the world',()=>{
 const plans=[[13,20],[7,20],[10,23],[10,17],[13,23]].map(([x,y])=>nativeObjectPickupPlan({x,y,z:3},object,bounds));
 const expected=[[10.9,20],[9.1,20],[10,20.9],[10,19.1],[10,20.9]];for(let i=0;i<plans.length;i++){expect(plans[i].approach.x).toBeCloseTo(expected[i][0],5);expect(plans[i].approach.y).toBeCloseTo(expected[i][1],5);expect(plans[i].approach.z).toBeCloseTo(2.9,5);}
 expect(plans[0].offset).toEqual({x:Math.fround(-.2),y:Math.fround(Math.fround(-.2)+.5),z:Math.fround(.1)});expect(plans[0].radius).toBe(Math.fround(.2));
});

test('rotated object axes choose the approach side, and a tilted box is made upright',()=>{
 const plan=nativeObjectPickupPlan({x:13,y:20,z:3},{...object,heading:Math.PI/2},bounds);expect(plan.approach.x).toBeCloseTo(10.9,5);expect(plan.approach.y).toBeCloseTo(20,5);
 const upright=nativeObjectPickupPlan({x:13,y:20,z:3},{...object,matrix:{right:{x:1,y:0,z:0},forward:{x:0,y:1,z:0},up:{x:0,y:0,z:.5}}},bounds);expect(upright.axes.up).toEqual({x:0,y:0,z:1});
});

test('elongated COL boxes orient their short face toward the approaching ped',()=>{
 const wide=nativeObjectPickupPlan({x:13,y:20,z:3},object,{min:{x:-2,y:-.4,z:0},max:{x:2,y:.4,z:1}}),long=nativeObjectPickupPlan({x:13,y:20,z:3},object,{min:{x:-.4,y:-2,z:0},max:{x:.4,y:2,z:1}});
 expect(wide.heading).toBeCloseTo(-Math.PI/2,5);expect(long.heading).toBeCloseTo(0,5);expect(wide.approach.x).toBeCloseTo(10.8,5);expect(long.approach.x).toBeCloseTo(10.8,5);
});

test('lift height uses strict native comparisons and absolute association times for all three carry groups',()=>{
 expect(nativeObjectPickupLift(0,1)).toEqual({clip:'liftup105',attachAt:Math.fround(.2),group:83});expect(nativeObjectPickupLift(1,1)).toEqual({clip:'liftup05',attachAt:Math.fround(.26666668),group:82});expect(nativeObjectPickupLift(Math.fround(1.55),1)).toEqual({clip:'liftup',attachAt:Math.fround(.6),group:81});expect(nativeObjectPickupLift(2,1).clip).toBe('liftup');
});
