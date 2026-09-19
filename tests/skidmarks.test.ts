import {test,expect} from 'vitest';
import {PerspectiveCamera,Scene} from 'three';
import {Skidmarks} from '../src/render/Skidmarks';
import {NativeSkidmarks,SKIDMARK_STATE,SKIDMARK_TYPE,SKIDMARKS_COUNT,skidmarkColour,skidmarkPartAlpha,wheelLaysSkidmark} from '../src/render/nativeSkidmarks';
import type {WorldCar} from '../src/simulation/WorldCar';

const onScreen=()=>true,offScreen=()=>false;
const lay=(marks:NativeSkidmarks,now:number,x:number,o:{id?:number;bloody?:boolean;type?:0|1|2|3;visible?:()=>boolean}={})=>
 marks.registerOne({id:o.id??1,position:{x,y:0,z:0},dirX:1,dirY:0,type:o.type??SKIDMARK_TYPE.DEFAULT,bloody:o.bloody??false,now,visible:o.visible??onScreen});

test('RegisterNewPart adds a point every 100 ms and moves the newest point in between',()=>{
 const marks=new NativeSkidmarks();lay(marks,1000,0);
 const mark=marks.marks[0];expect(mark.state).toBe(SKIDMARK_STATE.JUST_UPDATED);expect(mark.parts).toBe(0);
 // Init backdates the last update by a second, so the next call adds a part at once.
 lay(marks,1016,1);expect(mark.parts).toBe(1);
 lay(marks,1050,1.5);expect(mark.parts).toBe(1);expect(mark.positions[3]).toBe(1.5);
 lay(marks,1117,2);expect(mark.parts).toBe(2);expect(mark.positions[6]).toBe(2);
 // Travel along +x with the car facing +x: the side vector is (0, −1) × (1 + |0|) × 0.25 / 2.
 expect(mark.dirX[2]).toBeCloseTo(0);expect(mark.dirY[2]).toBeCloseTo(-.125);
 // The first point copies the first segment's side vector.
 expect(mark.dirY[0]).toBeCloseTo(-.125);
});

test('a turning wheel widens its mark by the sideways share of the heading',()=>{
 const marks=new NativeSkidmarks();
 marks.registerOne({id:1,position:{x:0,y:0,z:0},dirX:0,dirY:1,type:0,bloody:false,now:0,visible:onScreen});
 marks.registerOne({id:1,position:{x:1,y:0,z:0},dirX:0,dirY:1,type:0,bloody:false,now:200,visible:onScreen});
 // Sliding sideways (+x) while facing +y: |side · forward| is 1, so the half-width doubles to 0.25.
 expect(Math.hypot(marks.marks[0].dirX[1],marks.marks[0].dirY[1])).toBeCloseTo(.25);
});

test('Update fades uncontinued marks over times set by their length',()=>{
 const marks=new NativeSkidmarks();
 lay(marks,0,0,{id:1});for(let i=1;i<=3;i++)lay(marks,i*200,i,{id:1});
 lay(marks,0,0,{id:2});for(let i=1;i<=9;i++)lay(marks,i*200,i,{id:2});
 marks.update(2000);
 // Both were continued this frame.
 expect(marks.marks.slice(0,2).map(m=>m.state)).toEqual([SKIDMARK_STATE.JUST_UPDATED,SKIDMARK_STATE.JUST_UPDATED]);
 marks.update(2016);
 const [short,long]=marks.marks;
 expect(short.state).toBe(SKIDMARK_STATE.DISAPPEARING);expect([short.fadeBegin,short.disappearAt]).toEqual([2016+2500,2016+5000]);
 expect([long.fadeBegin,long.disappearAt]).toEqual([2016+10000,2016+20000]);
 marks.update(2016+5001);expect(short.state).toBe(SKIDMARK_STATE.INACTIVE);expect(long.state).toBe(SKIDMARK_STATE.DISAPPEARING);
});

test('GetColor dims with the day-night balance and fades, and Render hides the ends',()=>{
 const marks=new NativeSkidmarks();lay(marks,0,0,{type:SKIDMARK_TYPE.SANDY});lay(marks,200,1,{type:SKIDMARK_TYPE.SANDY});
 const mark=marks.marks[0];
 // SANDY (45, 31, 4) at night: × 0.4.
 expect(skidmarkColour(mark,200,1)).toEqual([18,12,1,255]);expect(skidmarkColour(mark,200,0)).toEqual([45,31,4,255]);
 marks.update(216);marks.update(232);
 expect(skidmarkColour(mark,232+2500+1250,0)[3]).toBe(127);
 expect([0,1].map(i=>skidmarkPartAlpha(mark,i,255))).toEqual([0,0]);
 lay(marks,300,0,{id:3});lay(marks,500,1,{id:3});lay(marks,700,2,{id:3});
 const live=marks.marks.find(m=>m.id===3)!;expect([0,1,2].map(i=>skidmarkPartAlpha(live,i,255))).toEqual([0,127,127]);
});

test('blood trails stop after eight segments and a change of blood ends the mark',()=>{
 const marks=new NativeSkidmarks();let bloody=lay(marks,0,0,{bloody:true});
 expect(marks.marks[0].type).toBe(SKIDMARK_TYPE.BLOODY);
 for(let i=1;i<=8;i++)bloody=lay(marks,i*200,i,{bloody});
 expect(bloody).toBe(true);
 bloody=lay(marks,9*200,9,{bloody});expect(bloody).toBe(false);expect(marks.marks[0].parts).toBe(9);
 // The next clean registration ends the bloody mark instead of continuing it.
 lay(marks,10*200,10,{bloody});expect(marks.marks[0].state).toBe(SKIDMARK_STATE.DISAPPEARING);
 expect(marks.marks[0].disappearAt).toBe(2000+20000);
});

test('with all 32 marks in use, a new wheel takes the oldest mark off screen',()=>{
 const marks=new NativeSkidmarks();
 for(let id=0;id<SKIDMARKS_COUNT;id++){lay(marks,id,0,{id});lay(marks,id+200,1,{id});}
 marks.update(1000);
 lay(marks,1000,5,{id:99});expect(marks.marks.some(m=>m.id===99)).toBe(false);
 lay(marks,1000,5,{id:99,visible:offScreen});
 expect(marks.marks[0].id).toBe(99);expect(marks.marks[0].parts).toBe(0);
});

test('PreRender lays marks for spinning and locked wheels, skidding rear wheels, and mud or blood',()=>{
 expect(wheelLaysSkidmark({state:'spinning',rear:false,rearSkidding:false,muddy:false,bloody:false})).toBe(true);
 expect(wheelLaysSkidmark({state:'fixed',rear:false,rearSkidding:false,muddy:false,bloody:false})).toBe(true);
 expect(wheelLaysSkidmark({state:'skidding',rear:false,rearSkidding:false,muddy:false,bloody:false})).toBe(false);
 expect(wheelLaysSkidmark({state:'skidding',rear:false,rearSkidding:true,muddy:false,bloody:false})).toBe(true);
 expect(wheelLaysSkidmark({state:'skidding',rear:true,rearSkidding:true,muddy:false,bloody:false})).toBe(true);
 expect(wheelLaysSkidmark({state:'normal',rear:true,rearSkidding:false,muddy:false,bloody:false})).toBe(false);
 expect(wheelLaysSkidmark({state:'normal',rear:true,rearSkidding:false,muddy:true,bloody:false})).toBe(true);
 expect(wheelLaysSkidmark({state:'normal',rear:true,rearSkidding:false,muddy:false,bloody:true})).toBe(true);
});

const car=(states:WorldCar['audio']['states'],x:number)=>({
 car:{body:{handle:11,rotation:()=>({x:0,y:-Math.SQRT1_2,z:0,w:Math.SQRT1_2})}},
 audio:{states,counts:[1,1,1,1]},
 // Native contact points one unit either side of the car's centre line, moving along +x.
 wheelGround:[{x:x+1,y:1,z:0,material:1},{x:x-1,y:1,z:0,material:1},{x:x+1,y:-1,z:0,material:2},{x:x-1,y:-1,z:0,material:1}],
 wheelBlood:[false,false,false,false],
} as unknown as WorldCar);

test('cars lay strips at their wheel contacts, drawn 0.1 above the ground in browser axes',()=>{
 const scene=new Scene(),skids=new Skidmarks(scene),camera=new PerspectiveCamera();
 const surfaces={skidMark:(material:number)=>material===1?'DEFAULT':'MUDDY',water:(material:number)=>material===3};
 try{
  skids.update(0);skids.lay(car(['normal','spinning','normal','normal'],0),0,surfaces,camera);
  // The spinning rear left wheel and the front right wheel on mud.
  expect(skids.snapshot().marks).toBe(2);
  skids.update(200);skids.lay(car(['normal','spinning','normal','normal'],1),200,surfaces,camera);skids.render(200,0);
  expect(skids.mesh.visible).toBe(true);expect(skids.mesh.geometry.drawRange.count).toBe(12);
  const p=(skids.mesh.geometry.getAttribute('position') as unknown as {array:Float32Array}).array;
  // First vertex: the rear left contact (x −1, y 1, z 0) plus its side vector (0, −0.125), lifted 0.1.
  expect([p[0],p[1],p[2]].map(v=>+v.toFixed(3))).toEqual([-1,.1,-(1-.125)]);
  const muddy=skids.marks.marks.find(m=>m.id===11*8+2)!;expect(muddy.type).toBe(SKIDMARK_TYPE.MUDDY);
  // Nothing continues the marks: they fade and disappear.
  skids.update(216);skids.update(232);skids.update(232+5000+1);skids.render(232+5001,0);
  expect(skids.snapshot().marks).toBe(0);expect(skids.mesh.visible).toBe(false);
 }finally{skids.dispose();}
});
