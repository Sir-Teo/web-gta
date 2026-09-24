import {expect,test} from 'vitest';
import {fireGlow,FIRE_CORONA_ID_BASE} from '../src/combat/nativeFireGlow';

const fire=(x:number,strength:number,active=true)=>({active,strength,position:{x,y:0,z:10}});
test('CFireManager::Update groups fires within 6 units around the strongest and lights the ground over a group stronger than 4',()=>{
 // 3 + 2 near each other make one group of 5; the lone fire at 50 (strength 3) stays dark.
 const {pools,coronas}=fireGlow([fire(0,2),fire(4,3),fire(50,3),fire(9,3,false)],[0,-30,12],{x:1,y:0},()=>.5);
 expect(pools).toHaveLength(1);
 const dir=Math.min(7,5-3);
 expect(pools[0]).toMatchObject({id:-2,position:[4,0,15],color:[32,25,16],maxHeight:10,front:[dir*-1.2,0],side:[0,dir*1.2],maxDistance:40});
 expect(coronas).toEqual([]);
});
test('a group stronger than 6 registers four headlight coronas in a ⊥ turned to the camera',()=>{
 const {pools,coronas}=fireGlow([fire(0,3),fire(1,3),fire(2,2)],[0,-30,12.6],{x:1,y:0},()=>0);
 expect(pools[0].front).toEqual([-5*1.2,0]);
 expect(coronas.map(c=>c.id)).toEqual([0,1,2,3].map(k=>FIRE_CORONA_ID_BASE+k));
 const [a,b,c,d]=coronas;
 expect(a.flareType).toBe(2);expect(a.position[1]).toBeCloseTo(-3.5,9);expect(a.position[2]).toBeCloseTo(12.6,9);
 expect(b.position[2]).toBeCloseTo(14.6,9);expect(c.position[0]).toBeCloseTo(2,9);expect(d.position[0]).toBeCloseTo(-2,9);
 expect(a).toMatchObject({color:[19,15,9],size:2.5,range:70,intensity:255,pullTowardsCamera:1.5,fadeSpeed:15});
});
