import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {readInitialStuntJumps} from '../src/assets/scmStuntJumps';
import {StuntJumps,type StuntJumpInput} from '../src/simulation/StuntJumps';

test('the INITIAL mission supplies all seventy unique stunt jumps as centre-and-radius boxes',()=>{
 const jumps=readInitialStuntJumps(new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')));
 expect(jumps).toHaveLength(70);
 expect(new Set(jumps.map(j=>j.id)).size).toBe(70);
 expect(jumps.every(j=>j.reward===500)).toBe(true);
 const first=jumps[0];
 expect(first.start.min.map(v=>+v.toFixed(3))).toEqual([1936.636,-1970.780,14.495]);
 expect(first.start.max.map(v=>+v.toFixed(3))).toEqual([1941.636,-1965.324,20.835]);
 expect(first.end.min.map(v=>+v.toFixed(3))).toEqual([1978.824,-1977.349,21.495]);
 expect(first.camera.map(v=>+v.toFixed(3))).toEqual([1960.545,-1963.571,25.323]);
 expect(jumps.every(j=>j.start.min.every((v,i)=>v<j.start.max[i])&&j.end.min.every((v,i)=>v<j.end.max[i]))).toBe(true);
});

const jump={id:'jump:1',offset:1,start:{min:[-2,-2,0] as [number,number,number],max:[2,2,4] as [number,number,number]},end:{min:[38,-5,0] as [number,number,number],max:[62,5,10] as [number,number,number]},camera:[20,20,10] as [number,number,number],reward:500};
const input=(over:Partial<StuntJumpInput>={}):StuntJumpInput=>({driving:true,position:{x:0,y:0,z:1},moveSpeed:{x:.5,y:0,z:.1},collided:0,lost:false,...over});

test('a fast airborne car entering a start box slows time, and reaching the landing box pays the reward once',()=>{
 const events:string[]=[];let paid=0;
 const manager=new StuntJumps([jump],{onStart:()=>events.push('start'),onEnd:()=>events.push('end'),onReward:(_j,reward,all)=>{paid=reward;events.push(all?'all':'reward');}});
 // Too slow (0.35 × 50 = 17.5 m/s), on the ground, or on foot: nothing starts.
 manager.update(33,input({moveSpeed:{x:.35,y:0,z:0}}));manager.update(33,input({collided:1}));manager.update(33,input({driving:false}));
 expect(manager.state).toBe('waiting');expect(manager.timeScale).toBe(1);
 manager.update(33,input());
 expect(manager.state).toBe('flight');expect(manager.timeScale).toBe(.3);expect([...manager.found]).toEqual(['jump:1']);
 // In flight until it lands in the box; the camera and time scale hold until 300 ms after that.
 for(let i=0;i<4;i++)manager.update(33,input({position:{x:20,y:0,z:8}}));expect(manager.snapshot().hitReward).toBe(false);
 manager.update(33,input({position:{x:50,y:0,z:5}}));expect(manager.snapshot().hitReward).toBe(true);
 // Only after 100 ms in the air does touching the ground end the jump.
 manager.update(33,input({position:{x:50,y:0,z:1},collided:1}));expect(manager.state).toBe('landed');
 manager.update(200,input({collided:1}));expect(events).toEqual(['start']);expect(manager.timeScale).toBe(.3);
 manager.update(200,input({collided:1}));
 expect(events).toEqual(['start','end','all']);expect(paid).toBe(10000);expect(manager.state).toBe('waiting');expect(manager.timeScale).toBe(1);
 // A repeat of a completed jump still slows time but pays nothing.
 manager.update(33,input());for(let i=0;i<4;i++)manager.update(33,input({position:{x:50,y:0,z:5}}));manager.update(400,input({collided:1}));manager.update(400,input({collided:1}));
 expect(events.filter(e=>e==='all'||e==='reward')).toHaveLength(1);expect(manager.done.size).toBe(1);
});

test('touching anything after the first 100 ms fails the jump, and only the completed set pays the all-jumps bonus',()=>{
 let paid=-1,allJumps=false;
 const manager=new StuntJumps([jump,{...jump,id:'jump:2',offset:2}],{onReward:(_j,reward,all)=>{paid=reward;allJumps=all;}});
 manager.update(33,input());expect(manager.state).toBe('flight');
 // A scrape inside the first 100 ms is tolerated, as the native timer allows.
 manager.update(120,input({collided:2}));expect(manager.state).toBe('flight');
 manager.update(60,input({collided:2,position:{x:50,y:0,z:5}}));
 expect(manager.state).toBe('landed');expect(manager.snapshot().hitReward).toBe(false);
 manager.update(400,input());expect(paid).toBe(-1);expect(manager.done.size).toBe(0);
 // Completing one of two jumps pays its own reward.
 manager.update(33,input());for(let i=0;i<4;i++)manager.update(33,input({position:{x:50,y:0,z:5}}));manager.update(400,input({collided:1}));manager.update(400,input({collided:1}));
 expect(paid).toBe(500);expect(allJumps).toBe(false);
});

test('losing the car ends the jump without a reward',()=>{
 const manager=new StuntJumps([jump]);
 manager.update(33,input());for(let i=0;i<4;i++)manager.update(33,input({position:{x:50,y:0,z:5}}));manager.update(33,input({position:{x:50,y:0,z:5},lost:true}));
 expect(manager.state).toBe('landed');expect(manager.snapshot().hitReward).toBe(true);
 manager.update(400,input({lost:true}));expect(manager.done.size).toBe(1);
 // A jump the player bails out of scores nothing.
 const second=new StuntJumps([jump]);second.update(33,input());second.update(120,input({driving:false}));second.update(400,input({driving:false}));
 expect(second.done.size).toBe(0);expect(second.found.size).toBe(1);
});

test('found and done each count once, and the last-jump bonus needs every jump done this session (m_iNumCompleted)',()=>{
 let found=0,done=0,allJumps=false;
 const second={...jump,id:'jump:2',offset:2,start:{min:[98,-2,0] as [number,number,number],max:[102,2,4] as [number,number,number]}};
 const manager=new StuntJumps([jump,second],{onFound:()=>found++,onDone:()=>done++,onReward:(_j,_r,all)=>{allJumps=all;}});
 // The first jump was done in an earlier session: its done flag came back from the save, but the count did not.
 manager.done.add(jump.id);
 const complete=(id:string)=>{const j=id===jump.id?jump:second;manager.update(33,input({position:{x:j.start.min[0]+2,y:j.start.min[1]+2,z:j.start.min[2]+1}}));for(let i=0;i<4;i++)manager.update(33,input({position:{x:50,y:0,z:5}}));manager.update(400,input({collided:1}));manager.update(400,input({collided:1}));};
 complete(second.id);
 expect([found,done]).toEqual([1,1]);expect(manager.numCompleted).toBe(1);expect(allJumps).toBe(false);
});
