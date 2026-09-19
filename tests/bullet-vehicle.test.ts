import {expect,test} from 'vitest';
import {bulletTyreHit,pushShotVehicle} from '../src/weapons/bulletVehicle';
import type {WorldCar} from '../src/simulation/WorldCar';

const car=(x:number,spheres:{x:number;y:number;z:number;radius:number;wheel:number}[],o:{wrecked?:boolean;mass?:number}={})=>{
 const state={v:{x:0,y:0,z:0},w:{x:0,y:0,z:0}};
 return {state,car:{wrecked:!!o.wrecked,nativeBody:{mass:o.mass??1500,turnMass:3000},wheelSpheres:()=>spheres.map(s=>({center:{x:s.x,y:s.y,z:s.z},radius:s.radius,wheel:s.wheel})),
  car:{body:{isEnabled:()=>true,translation:()=>({x,y:0,z:0}),worldCom:()=>({x,y:0,z:0}),linvel:()=>state.v,angvel:()=>state.w,setLinvel:(v:typeof state.v)=>{state.v=v;},setAngvel:(w:typeof state.w)=>{state.w=w;}}}} as unknown as WorldCar};
};

test('a shot meets the nearest wheel sphere along its line, within reach',()=>{
 const near=car(10,[{x:10,y:0,z:0,radius:.35,wheel:0},{x:12,y:0,z:0,radius:.35,wheel:2}]),far=car(30,[{x:30,y:0,z:0,radius:.35,wheel:1}]);
 const hit=bulletTyreHit([far.car,near.car],{x:0,y:0,z:0},{x:1,y:0,z:0},100)!;
 expect(hit.car).toBe(near.car);expect(hit.wheel).toBe(0);expect(hit.t).toBeCloseTo(9.65,5);
 // A body hit before the wheel stops the round first; a line beside the wheel misses it.
 expect(bulletTyreHit([near.car],{x:0,y:0,z:0},{x:1,y:0,z:0},9)).toBeUndefined();
 expect(bulletTyreHit([near.car],{x:0,y:1,z:0},{x:1,y:0,z:0},100)).toBeUndefined();
 expect(bulletTyreHit([car(10,[{x:10,y:0,z:0,radius:.35,wheel:0}],{wrecked:true}).car],{x:0,y:0,z:0},{x:1,y:0,z:0},100)).toBeUndefined();
});
test('DoBulletImpact pushes a car along the hit normal, harder for the Desert Eagle and softer for the shotgun',()=>{
 const push=(weapon:number,mass=1500)=>{const c=car(0,[],{mass});pushShotVehicle(c.car,{x:-1,y:0,z:0},{x:0,y:0,z:0},weapon);return c.state.v.x;};
 // ApplyForce(normal x k): k -10 for most guns, per 1/50 s frame over the mass.
 expect(push(22)).toBeCloseTo(10*50/1500,6);
 expect(push(24)).toBeCloseTo(20*50/1500,6);
 expect(push(25)).toBeCloseTo(4*50/1500,6);
 // Light vehicles scale the force by mass / 1000.
 expect(push(22,500)).toBeCloseTo(10*.5*50/500,6);
});
