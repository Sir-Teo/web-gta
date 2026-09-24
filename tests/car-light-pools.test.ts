import {expect,test} from 'vitest';
import {carLightPools,CAR_LIGHT_POOL_MAX_DISTANCE} from '../src/render/carLightPools';
const car=(lamps:[boolean,boolean])=>({id:7,position:{x:100,y:200,z:10},forward:{x:0,y:1},right:{x:1,y:0},dummy:{x:0.6,y:2,z:0.5},lamps});
test('both lamps lit store one twin pool ahead of the car; one lamp a single pool offset to its side; none when the lamps are out',()=>{
 const twin=carLightPools(car([true,true]),{x:100,y:200});
 expect(twin.single).toHaveLength(0);expect(twin.twin).toHaveLength(1);
 const t=twin.twin[0],lightSize=2.4,offset=lightSize*2+1+2;
 expect(t.position).toEqual([100,200+offset,12]);expect(t.front).toEqual([0,lightSize*2]);expect(t.side).toEqual([lightSize,-0]);
 expect(t.color).toEqual([45,45,45]);expect(t.intensity).toBe(128);expect(t.maxHeight).toBe(6);expect(t.maxDistance).toBe(27);
 const right=carLightPools(car([false,true]),{x:100,y:200});
 expect(right.twin).toHaveLength(0);expect(right.single).toHaveLength(1);expect(right.single[0].position[0]).toBeCloseTo(100.6,5);
 const left=carLightPools(car([true,false]),{x:100,y:200});expect(left.single[0].position[0]).toBeCloseTo(99.4,5);
 expect(carLightPools(car([false,false]),{x:100,y:200}).twin).toHaveLength(0);
});
test('the pool fades from 18 units and drops at 27 from the camera; a bike uses lightSize 1.25',()=>{
 const c=car([true,true]);
 const near=carLightPools(c,{x:100,y:200+7.8}),mid=carLightPools(c,{x:100,y:200+7.8-22.5}),far=carLightPools(c,{x:100,y:200+7.8-CAR_LIGHT_POOL_MAX_DISTANCE});
 expect(near.twin[0].color[0]).toBe(45);expect(mid.twin[0].color[0]).toBe(Math.trunc(45*(1-(22.5-18)/9)));expect(far.twin).toHaveLength(0);
 const bike=carLightPools({...car([false,true]),bike:true},{x:100,y:200});expect(bike.single[0].front).toEqual([0,2.5]);
});

test('StoreCarLightShadow drops a pool more than 7 units behind the camera, along its 2D front',()=>{
 const car={id:1,position:{x:0,y:0,z:0},forward:{x:0,y:1},right:{x:1,y:0},dummy:{x:.7,y:2,z:0},lamps:[true,true] as [boolean,boolean]};
 // The twin pool is centred 2.8·2+1+2 = 8.6 ahead, at y 8.6.
 expect(carLightPools(car,{x:0,y:20,front:{x:0,y:1}}).twin).toHaveLength(0);
 expect(carLightPools(car,{x:0,y:15,front:{x:0,y:1}}).twin).toHaveLength(1);
 expect(carLightPools(car,{x:0,y:20,front:{x:0,y:-1}}).twin).toHaveLength(1);
});
test('a bike lamp pool is 1.25 whatever its dummy',()=>{
 const got=carLightPools({id:1,position:{x:0,y:0,z:0},forward:{x:0,y:1},right:{x:1,y:0},dummy:{x:0,y:.9,z:.5},lamps:[false,true],bike:true},{x:0,y:0});
 expect(got.single[0].size).toBe(2.5);expect(got.single[0].position[1]).toBeCloseTo(1.25*2+1+.9,6);
});
