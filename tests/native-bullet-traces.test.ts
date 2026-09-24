import {expect,test} from 'vitest';
import {NativeBulletTraces,bulletPass,BULLET_PASS} from '../src/weapons/nativeBulletTraces';

const camera={position:{x:0,y:0,z:0},right:{x:1,y:0,z:0},forward:{x:0,y:1,z:0},up:{x:0,y:0,z:1}};

test('CBulletTraces::AddTrace: slots after the fifth live half as long, after the tenth a quarter', () => {
 const t=new NativeBulletTraces();t.update(1000);
 for(let i=0;i<17;i++)t.addTrace({x:0,y:10,z:0},{x:1,y:10,z:0},.01,300,70);
 expect(t.traces.map(x=>x.lifetime)).toEqual([...Array(5).fill(300),...Array(5).fill(150),...Array(6).fill(75)]);
 t.update(1075);expect(t.traces.filter(x=>x.exists)).toHaveLength(10);
 t.update(1300);expect(t.traces.some(x=>x.exists)).toBe(false);
});

test('a weapon trace is a 2 to 5 unit streak at a random point of the line, fading and shrinking toward its end', () => {
 const t=new NativeBulletTraces();t.update(0);
 const values=[.5,.5];t.addWeaponTrace({x:0,y:0,z:0},{x:0,y:20,z:0},()=>values.shift()!);
 const trace=t.traces[0];expect(trace.start).toEqual({x:0,y:10,z:0});expect(trace.end).toEqual({x:0,y:13.5,z:0});
 expect(trace).toMatchObject({radius:.01,lifetime:300,alpha:70});
 // Near the end of the line the streak is cut short.
 const late=[.95,1];t.addWeaponTrace({x:0,y:0,z:0},{x:0,y:20,z:0},()=>late.shift()!);expect(t.traces[1].end.y).toBeCloseTo(20);
 // The player's still first-person shot leaves nothing.
 t.addWeaponTrace({x:0,y:0,z:0},{x:0,y:20,z:0},Math.random,true);expect(t.traces[2].exists).toBe(false);
 // Half-way through its life: 12 vertices, opaque only at the end at half the alpha, and 0.005 wide.
 t.update(150);const g=t.geometry({x:5,y:10,z:0});
 expect(g.positions.length/3).toBe(24);
 const alphas=g.colors.filter((_,i)=>i%4===3).slice(0,12);expect(alphas.filter(a=>a>0)).toEqual([35,35,35,35]);
 const xs=g.positions.filter((_,i)=>i%3===2).slice(0,12);expect(Math.max(...xs.map(Math.abs))).toBeCloseTo(.005);
});

test('PlayFrontEndSoundForTrace: a bullet crossing the camera plane within 2 units whizzes on its side and end', () => {
 expect(bulletPass({x:1,y:-10,z:0},{x:1,y:10,z:0},camera)).toEqual({event:BULLET_PASS.rightRear,volumeChange:Math.log10(.5)});
 expect(bulletPass({x:-.5,y:10,z:0},{x:-.5,y:-10,z:0},camera)?.event).toBe(BULLET_PASS.leftFront);
 expect(bulletPass({x:3,y:-10,z:0},{x:3,y:10,z:0},camera)).toBeUndefined();
 expect(bulletPass({x:1,y:5,z:0},{x:1,y:10,z:0},camera)).toBeUndefined();
 const passes:number[]=[];const t=new NativeBulletTraces(()=>camera,e=>passes.push(e));
 t.addTrace({x:0,y:-3,z:.5},{x:0,y:3,z:.5},.01,300,70);expect(passes).toEqual([BULLET_PASS.rightRear]);
});

test('AddTrace stamps the time of the shot, not the last update',()=>{
 const traces=new NativeBulletTraces();traces.update(1000);
 let now=1040;traces.clock=()=>now;
 traces.addTrace({x:0,y:0,z:0},{x:0,y:5,z:0},.01,300,70);
 expect(traces.traces[0].creation).toBe(1040);
 // It lives its whole 300 ms from the shot.
 traces.update(1339);expect(traces.traces[0].exists).toBe(true);traces.update(1340);expect(traces.traces[0].exists).toBe(false);
 now=0;
});
