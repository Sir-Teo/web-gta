import {describe,expect,it} from 'vitest';
import {MAX_FIRE_GENERATIONS,MAX_NUM_FIRES,NativeFireManager,explosionFireCount,type FireWorld} from '../src/combat/nativeFire';

const clock=(nowMs:number,r=.5)=>({nowMs,random:()=>r});
const world=(nowMs:number,extra:Partial<FireWorld>={}):FireWorld=>({nowMs,timeStep:1,random:()=>.99,targetPosition:()=>undefined,cameraPosition:{x:0,y:0,z:0},...extra});

describe('CFireManager::StartFire',()=>{
 it('burns a world fire for 1 to 1.3 times its time and caps generations at a byte of 999999',()=>{
  const m=new NativeFireManager();
  const f=m.startFire({x:1,y:2,z:3},7000,100,clock(1000,.5))!;
  expect(f.timeToBurn).toBe(1000+Math.trunc(1.15*7000));expect(f.generations).toBe(Math.min(MAX_FIRE_GENERATIONS,100));expect(MAX_FIRE_GENERATIONS).toBe(63);
  expect(f.fxName).toBe('fire');
  expect(m.startFire({x:0,y:0,z:0},7000,1,{...clock(0),underwater:true})).toBeUndefined();
 });
 it('gives the player 2333 ms, vehicles 3 to 4 s and peds their lifetime plus up to a second',()=>{
  const m=new NativeFireManager();
  expect(m.startFireOn({kind:'player',key:'p'},{x:0,y:0,z:0},7000,100,clock(0))!.timeToBurn).toBe(2333);
  expect(m.startFireOn({kind:'vehicle',key:'car'},{x:0,y:0,z:0},7000,100,clock(0,.5))!.timeToBurn).toBe(3000+Math.trunc(999*.5));
  expect(m.startFireOn({kind:'ped',key:7},{x:0,y:0,z:0},7000,2,clock(0,0))!.timeToBurn).toBe(7000);
  // A target already burning, or fireproof, is not lit again.
  expect(m.startFireOn({kind:'ped',key:7},{x:0,y:0,z:0},7000,2,clock(0))).toBeUndefined();
  expect(m.startFireOn({kind:'ped',key:8},{x:0,y:0,z:0},7000,2,clock(0),undefined,{fireproof:true})).toBeUndefined();
 });
 it('holds at most 60 fires',()=>{
  const m=new NativeFireManager();for(let i=0;i<MAX_NUM_FIRES;i++)expect(m.startFire({x:i*10,y:0,z:0},7000,1,clock(0))).toBeDefined();
  expect(m.startFire({x:0,y:0,z:0},7000,1,clock(0))).toBeUndefined();
 });
});

describe('CFire::ProcessFire',()=>{
 it('goes out when its time runs out at strength 1, and steps down a strength with 7 s more above it',()=>{
  const m=new NativeFireManager(),f=m.startFire({x:0,y:0,z:0},1000,0,clock(0,0))!;
  m.update(world(500));expect(f.active).toBe(true);
  m.update(world(1001));expect(f.active).toBe(false);
  const g=m.startFire({x:0,y:0,z:0},1000,0,clock(0,0))!;g.strength=2;g.fxSerial=5;
  m.update(world(2000));expect(g).toMatchObject({active:true,strength:1,timeToBurn:9000,fxSerial:6});
 });
 it('burns out beyond 60 units of the camera',()=>{
  const m=new NativeFireManager(),f=m.startFire({x:100,y:0,z:0},7000,0,clock(0,0))!;
  m.update(world(10));expect(f.active).toBe(false);
 });
 it('sets the player alight within the square root of 1.2 units',()=>{
  const m=new NativeFireManager();m.startFire({x:0,y:0,z:0},7000,0,clock(0,0));
  const far=m.update(world(10,{ignitablePlayer:()=>({key:'cj',position:{x:1.2,y:0,z:0}})}));expect(far).toEqual([]);
  const near=m.update(world(20,{ignitablePlayer:()=>({key:'cj',position:{x:1,y:0,z:0}}),targetPosition:t=>t.kind==='player'?{x:1,y:0,z:0}:undefined}));
  expect(near).toEqual([{target:{kind:'player',key:'cj'},creator:undefined}]);expect(m.fireOn('cj')!.timeToBurn).toBe(20+2333);
 });
 it('spreads to vehicles within 2 units one frame in 32',()=>{
  const m=new NativeFireManager();m.startFire({x:0,y:0,z:0},7000,0,clock(0,0));
  const car={kind:'vehicle' as const,key:'car'},w={vehiclesNear:()=>[car],targetPosition:()=>({x:1,y:0,z:0})};
  expect(m.update(world(10,{...w,random:()=>.5}))).toEqual([]);
  expect(m.update(world(20,{...w,random:()=>0}))).toEqual([{target:car,creator:undefined}]);
 });
 it('follows a burning target, damages burning vehicles 1.2 per frame and goes out with the target',()=>{
  const m=new NativeFireManager(),hurt:number[]=[];
  const f=m.startFireOn({kind:'vehicle',key:'car'},{x:0,y:0,z:0},7000,100,clock(0))!;
  m.update(world(10,{targetPosition:()=>({x:5,y:0,z:0}),damageVehicle:(_,a)=>hurt.push(a),cameraPosition:{x:5,y:0,z:0}}));
  expect(f.position.x).toBe(5);expect(hurt).toEqual([1.2]);
  m.update(world(20));expect(f.active).toBe(false);
 });
 it('merges a weak neighbour within 3.5 units into a stronger fire',()=>{
  const m=new NativeFireManager();
  const a=m.startFire({x:0,y:0,z:0},7000,5,clock(0,0))!,b=m.startFire({x:2,y:0,z:0},7000,5,clock(0,0))!;
  // random() 0: every roll passes and GetRandomFire picks slot 0, so the second fire absorbs the first.
  m.update(world(10,{random:()=>0}));
  expect(a.active).toBe(false);expect(b.strength).toBe(2);expect(b.fxName).toBe('fire_med');expect(b.timeToBurn).toBe(7010);
  // The absorbed fire first moves 70 percent of the way to the stronger one.
  expect(a.position.x).toBeCloseTo(1.4,9);
 });
});

describe('CFireManager extinguishing and counts',()=>{
 it('removes 2 strength per second of water and puts a fire out below zero',()=>{
  const m=new NativeFireManager(),f=m.startFire({x:0,y:0,z:0},7000,0,clock(0))!;
  expect(m.extinguishPointWithWater({x:.3,y:0,z:0},.5,2,.25)).toBe(true);expect(f.strength).toBeCloseTo(.5,9);expect(f.fxSerial).toBe(2);
  m.extinguishPointWithWater({x:0,y:0,z:0},.5,2,.3);expect(f.active).toBe(false);
  expect(m.extinguishPointWithWater({x:0,y:0,z:0},.5,2,.3)).toBe(false);
 });
 it('gives off two puffs of steam each time water hits a fire, rising at 0.8 and 1.4',()=>{
  const m=new NativeFireManager(),f=m.startFire({x:10,y:20,z:5},7000,0,clock(0))!,puffs:{x:number;y:number;z:number;rise:number}[]=[];
  m.random=()=>1;m.onSteam=(p,rise)=>puffs.push({...p,rise});
  m.extinguishPointWithWater(f.position,1,2,.02);
  expect(puffs.map(p=>p.rise)).toEqual([.8,1.4]);
  expect(puffs[0].x).toBeCloseTo(11.28,6);expect(puffs[0].y).toBeCloseTo(21.28,6);expect(puffs[0].z).toBeCloseTo(f.position.z+.64,6);
 });
 it('counts non-script fires within a 2D radius',()=>{
  const m=new NativeFireManager();m.startFire({x:0,y:0,z:10},7000,0,clock(0));m.startFire({x:3,y:0,z:0},7000,0,clock(0));
  expect(m.numFiresInRange({x:0,y:0,z:0},2)).toBe(1);
 });
 it('lights 0 to 3 fires around a blast',()=>{
  expect(explosionFireCount('molotov',0)).toBe(0);expect(explosionFireCount('molotov',5)).toBe(3);
  expect(explosionFireCount('other',3)).toBe(0);expect(explosionFireCount('other',2)).toBe(3);
 });
});
