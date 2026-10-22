import {expect,test,vi} from 'vitest';
import {PlayerScriptTasks,type PlayerTaskBody} from '../src/simulation/playerScriptTasks';
import capture from './fixtures/native-player-shoot-task.json';
const body:PlayerTaskBody={position:{x:0,y:0,z:0},heading:0,speed:0,onFoot:true};
const point={x:8,y:12,z:3},world={animation:async()=>undefined,placeOnGround:()=>{}};
for(const row of capture.cases)test(`native shoot controller ${JSON.stringify(row.input)}`,()=>{
 const n=row.native,thrown=row.input.thrown&&row.input.handle!==-1;
 expect(n.controller).toBe(thrown?'throw':'gun');expect(n.allocation).toBe(thrown?48:80);expect(n.target).toBe(0);
 expect(n.point).toEqual(row.input.point.map(Math.fround));
 if(!thrown){expect(n.command).toBe(3);expect(n.burst).toBe(5);expect(n.duration).toBe(row.input.duration>>>0);expect(n.moveTarget).toBe(0);}
});
test('player shooting retries cooldowns, pauses between native bursts and stops on expiry',()=>{
 const random=vi.spyOn(Math,'random').mockReturnValue(0);let ready=false,shots=0,requests=0;const aims:unknown[]=[];
 try{
 const tasks=new PlayerScriptTasks({...world,gunInfo:()=>({clip:30,projectile:false,thrown:false,rate:40}),aimAt:p=>aims.push(p),fireAt:p=>{requests++;expect(p).toEqual({x:8,y:3,z:-12});if(!ready)return false;shots++;return true;}});
 tasks.give({kind:'gunAt',point,fire:true,seconds:3},body);
 tasks.step(.1,body);tasks.step(.1,body);expect([requests,shots]).toEqual([2,0]);ready=true;
 for(let i=0;i<5;i++)tasks.step(.1,body);expect(shots).toBe(5);
 const paused=requests;tasks.step(.4,body);expect(requests).toBe(paused);
 tasks.step(.6,body);tasks.step(.1,body);expect(shots).toBe(6);
 tasks.step(2,body);expect(tasks.active).toBe(false);expect(aims.at(-1)).toBeUndefined();
 tasks.step(1,body);expect(shots).toBe(6);
 }finally{random.mockRestore();}
});
test('shooting follows a moving ped and clear or replacement stops its shots',()=>{
 let p:{x:number;y:number;z:number}|undefined={x:1,y:2,z:3};const shots:unknown[]=[];
 const tasks=new PlayerScriptTasks({...world,pedPoint:()=>p,fireAt:point=>{shots.push({...point});return true;}});
 tasks.give({kind:'gunAt',target:7,fire:true,seconds:Infinity},body);tasks.step(.1,body);expect(shots[0]).toEqual(p);
 p={x:4,y:5,z:6};tasks.step(3,body);tasks.step(.1,body);expect(shots.at(-1)).toEqual(p);
 tasks.clear(body);const count=shots.length;tasks.step(10,body);expect(shots).toHaveLength(count);
 tasks.give({kind:'gunAt',target:7,fire:true,seconds:Infinity},body);p=undefined;tasks.step(.1,body);expect(tasks.active).toBe(false);expect(shots).toHaveLength(count);
 p={x:1,y:2,z:3};tasks.give({kind:'gunAt',target:7,fire:true,seconds:Infinity},body);tasks.give({kind:'standStill',seconds:1},body);tasks.step(.1,body);expect(shots).toHaveLength(count);
});
for(const seconds of[0,.1,Infinity])test(`a thrown weapon ignores duration ${seconds} and waits for one throw`,()=>{
 let throwing=false,shots=0;
 const tasks=new PlayerScriptTasks({...world,gunInfo:()=>({clip:1,projectile:true,thrown:true,rate:40}),throwing:()=>throwing,fireAt:()=>{throwing=true;shots++;return true;}});
 tasks.giveSequence([{kind:'gunAt',point,fire:true,seconds},{kind:'standStill',seconds:1}],false,body);
 tasks.step(.2,body);expect(shots).toBe(1);expect(tasks.progress).toBe(0);
 tasks.step(4,body);expect(shots).toBe(1);expect(tasks.progress).toBe(0);
 throwing=false;tasks.step(.1,body);expect(tasks.progress).toBe(1);expect(shots).toBe(1);
});
