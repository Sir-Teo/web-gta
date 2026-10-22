import {expect,test} from 'vitest';
import {NativePedScanner,pedCanTargetPoint} from '../src/ped/nativePedScanner';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
type Entry={position:{x:number;y:number;z:number};dead:boolean};
const entry=(x:number,dead=false,y=0,z=0):Entry=>({position:{x,y,z},dead});

test('a scan retains sixteen nearest references, stable ties and a strict spherical sense boundary',()=>{
 const observer=entry(0),scanner=new NativePedScanner<Entry>(),peds=Array.from({length:25},(_,i)=>entry(25-i)),first=entry(1),second=entry(1),edge=entry(40),high=entry(0,false,0,41);
 scanner.tick(observer,true,false,40,[observer,first,second,...peds,edge,high],p=>p);expect(scanner.entities).toHaveLength(16);expect(scanner.entities.slice(0,3)).toEqual([first,second,peds[24]]);expect(scanner.entities).not.toContain(edge);expect(scanner.entities).not.toContain(high);expect(scanner.entities).not.toContain(observer);
});

test('queries retain candidates that die or move away until the seventeenth AI call refreshes',()=>{
 const observer=entry(0),ped=entry(2),scanner=new NativePedScanner<Entry>(),tick=()=>scanner.tick(observer,true,false,15,[observer,ped],p=>p);
 expect(tick()).toBe(true);ped.dead=true;ped.position.x=50;for(let i=0;i<16;i++)expect(tick()).toBe(false);expect(scanner.entities).toEqual([ped]);expect(tick()).toBe(true);expect(scanner.entities).toEqual([]);
});

test('NPC scans exclude fully dead bodies while player scans keep them and dead observers stop ticking',()=>{
 const observer=entry(0),dead=entry(2,true),dying=entry(3),npc=new NativePedScanner<Entry>(),player=new NativePedScanner<Entry>();
 npc.tick(observer,true,false,15,[dead,dying],p=>p);player.tick(observer,true,true,15,[dead,dying],p=>p);expect(npc.entities).toEqual([dying]);expect(player.entities).toEqual([dead,dying]);
 for(let i=0;i<30;i++)expect(npc.tick(observer,false,false,15,[],p=>p)).toBe(false);expect(npc.entities).toEqual([dying]);for(let i=0;i<16;i++)npc.tick(observer,true,false,15,[],p=>p);expect(npc.entities).toEqual([dying]);npc.tick(observer,true,false,15,[],p=>p);expect(npc.entities).toEqual([]);
});

test('deleting a referenced ped clears its slot without pulling another unscanned ped into the cache',()=>{
 const observer=entry(0),a=entry(1),b=entry(2),scanner=new NativePedScanner<Entry>();scanner.tick(observer,true,false,15,[a,b],p=>p);scanner.forget(a);expect(scanner.entities).toEqual([undefined,b]);
});

test('targeting uses the raised target point, inclusive 3D distance and a nonnegative forward dot',()=>{
 const from={x:0,y:0,z:0},forward={x:0,y:1,z:0};expect(pedCanTargetPoint(from,forward,{x:40,y:0,z:0})).toBe(true);expect(pedCanTargetPoint(from,forward,{x:40,y:0,z:.75})).toBe(false);expect(pedCanTargetPoint(from,forward,{x:0,y:-.001,z:0})).toBe(false);expect(pedCanTargetPoint(from,{x:0,y:0,z:1},{x:0,y:0,z:-.25})).toBe(false);
});

test('the world scan latches a finished death independently of removal age and corpse-hit animation restarts',()=>{
 const p=(x:number)=>({health:100,pedType:'CIVMALE',actor:{player:{position:{x,y:0,z:0},crouched:false}},view:{reactionPlayedOut:false}} as any),observer=p(0),target=p(2),player={health:100,position:{x:100,y:0,z:0}},world={people:[observer,target],sim:{player},playerPedScanner:new NativePedScanner()} as any;
 const step=()=> (WorldPedestrians.prototype as any).stepPedScanners.call(world),query=()=>WorldPedestrians.prototype.deadPedCandidates.call(world,observer);
 step();target.health=0;target.deadTime=100;step();expect(target.deathState).toBe('dying');expect(query()).toEqual([{position:{x:2,y:-0,z:1},ducking:false}]);
 target.view.reactionPlayedOut=true;step();expect(target.deathState).toBe('dead');target.view.reactionPlayedOut=false;target.deadTime=0;step();expect(target.deathState).toBe('dead');expect(query()).toHaveLength(1);
 for(let i=0;i<14;i++)step();expect(query()).toEqual([]);target.health=100;step();expect(target.deathState).toBeUndefined();expect(query()).toEqual([]);
});
