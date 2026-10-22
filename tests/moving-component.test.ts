import {expect,test} from 'vitest';
import {NativeMovingComponent,movingComponentCollision,stepCementDrum} from '../src/simulation/nativeMovingComponent';
import type {ColModel} from '../src/assets/col';
const script=(angle:number)=>({angle,player:false,mission:true,pad:0,timeStep:1});
const pad=(value:number)=>({angle:-1,player:true,mission:false,pad:value,timeStep:1});

test('script angles use uint16 fractions of 2500, with mission and player-state gates',()=>{
 const s=new NativeMovingComponent(486);expect(s.update({...script(.5),mission:false})).toBe(false);expect(s.angle).toBe(0);
 expect(s.update(script(.5))).toBe(true);expect(s.angle).toBe(1250);expect(s.offset()).toBe(Math.fround(1250*Math.fround(.0002)));
 s.update(script(2));expect(s.angle).toBe(5000);s.update(script(65536/2500));expect(s.angle).toBe(0);
 s.update({...script(.5),player:true,playing:false});expect(s.angle).toBe(0);
 expect(new NativeMovingComponent(492).update(script(.5))).toBe(false);
});

test('pad increments clamp signed values, and forklift lowering uses twice the rate',()=>{
 const s=new NativeMovingComponent(530);s.update(script(.5));s.update(pad(128));expect(s.angle).toBe(1260);expect(s.previous).toBe(1250);
 s.update(pad(-128));expect(s.angle).toBe(1240);s.update(pad(10));expect(s.angle).toBe(1240);expect(s.previous).toBe(1240);
 s.update(script(0));s.update(pad(-128));expect(s.angle).toBe(0);
 s.update(script(1));s.update(pad(128));expect(s.angle).toBe(2500);
 const dozer=new NativeMovingComponent(486);dozer.update(script(.5));dozer.update(pad(-128));expect(dozer.angle).toBe(1240);
});

test('cement and ladder trucks keep their special angle control and report no moving collision offset',()=>{
 for(const id of [524,544]){const s=new NativeMovingComponent(id);expect(s.update(script(.5))).toBe(false);expect(s.angle).toBe(1250);
  s.update(pad(-128));expect(s.angle).toBe(1270);s.update(pad(0));expect(s.angle).toBe(1263);expect(s.offset()).toBe(0);}
 expect(new NativeMovingComponent(443).offset(false)).toBe(0);
 const dozer=new NativeMovingComponent(486);dozer.update(script(1));expect(dozer.offset(false)).toBe(0);
});

function collision():ColModel{
 const surface=(material:number)=>({material,flags:0,brightness:0,light:0});
 return {name:'moving',id:530,version:3,flags:0,bounds:{min:[-2,-2,-1],max:[2,2,1],center:[0,0,0],radius:3},
  spheres:[{center:[1,1,1],radius:.2,surface:surface(65)},{center:[-1,-1,-1],radius:.2,surface:surface(0)}],
  boxes:[{min:[-1,-1,-1],max:[1,1,1],surface:surface(65)}],
  mesh:{positions:new Float32Array([0,0,0,1,0,0,0,1,0,0,0,-1,1,0,-1,0,1,-1]),indices:new Uint32Array([0,1,2,3,4,5]),materials:new Uint8Array([65,0]),lights:new Uint8Array(2)},shadow:null,faceGroups:[],warnings:[]};
}

test('forklift geometry translates marked spheres and triangles, preserving boxes and the shared original',()=>{
 const original=collision(),before=structuredClone(original),moved=movingComponentCollision(original,530,1.5,[0,0,99]);
 expect([...moved.mesh.positions.slice(0,9)]).toEqual([0,0,1.5,1,0,1.5,0,1,1.5]);expect(moved.mesh.positions.slice(9)).toEqual(original.mesh.positions.slice(9));
 expect(moved.spheres[0].center).toEqual([1,1,2.5]);expect(moved.spheres[1]).toEqual(original.spheres[1]);expect(moved.boxes).toEqual(original.boxes);
 expect(moved.bounds.max[2]).toBeCloseTo(2.7);expect(original).toEqual(before);
 expect(movingComponentCollision(original,530,0,[0,0,0]).mesh.positions).toEqual(original.mesh.positions);
});

test('dozer rotation is about the native component pivot and starts from the original COL on every call',()=>{
 const original=collision(),moved=movingComponentCollision(original,486,Math.PI/2,[0,1,1]);
 expect(moved.mesh.positions[0]).toBe(0);expect(moved.mesh.positions[1]).toBeCloseTo(2);expect(moved.mesh.positions[2]).toBeCloseTo(0);
 expect(moved.mesh.positions.slice(9)).toEqual(original.mesh.positions.slice(9));expect(moved.spheres[0].center).toEqual([1,1,1]);
 expect(movingComponentCollision(original,486,0,[0,1,1]).mesh.positions).toEqual(original.mesh.positions);
});

test('cement drum speed is proportional to the stored fraction with a half-speed baseline',()=>{
 const idle=stepCementDrum(0,0,1),half=stepCementDrum(0,1250,1),full=stepCementDrum(0,2500,1);
 expect(idle).toBe(Math.fround(.01));expect(half).toBe(Math.fround(.02));expect(full).toBe(Math.fround(1.5*Math.fround(.02)));
 expect(stepCementDrum(1,2500,2)).toBe(Math.fround(1+Math.fround(3*Math.fround(.02))));
});
