import {expect,test} from 'vitest';
import {REGION_FAILURE_LIMIT,REGION_RETRY_MS,SceneRegionFollower} from '../src/assets/sceneRegionFollower';
test('requests overlapping native XY windows only for eligible movement and commits matching replies',()=>{
 const initial={x:100,y:200,radius:100},follower=new SceneRegionFollower(initial);initial.x=999;
 expect(follower.request({x:129.9,z:-200},true)).toBeUndefined();expect(follower.request({x:130,z:-200},false)).toBeUndefined();
 const request=follower.request({x:130,z:-200},true)!;expect(request).toEqual({id:1,region:{x:130,y:200,radius:100,includeCollisionBounds:true}});
 request.region.x=999;expect(follower.request({x:190,z:-200},true)).toBeUndefined();expect(follower.finish(2,true)).toBe(false);
 expect(follower.finish(1,true)).toBe(true);expect(follower.snapshot().region.x).toBe(130);
 expect(follower.request({x:130,z:-229.9},true)).toBeUndefined();expect(follower.request({x:130,z:-230},true)?.id).toBe(2);
 const snapshot=follower.snapshot();snapshot.region.x=999;expect(follower.snapshot().region.x).toBe(130);
});
test('an explicit stop rejects late responses and further requests',()=>{
 const follower=new SceneRegionFollower({x:0,y:0,radius:50});follower.request({x:30,z:0},true);follower.stop();
 expect(follower.finish(1,true)).toBe(false);expect(follower.request({x:100,z:0},true)).toBeUndefined();expect(follower.snapshot()).toMatchObject({enabled:false,pending:null,requests:1,region:{x:0,y:0}});
});
test('a failed window retries after its backoff and following stops only after repeated failures',()=>{
 const follower=new SceneRegionFollower({x:0,y:0,radius:50});
 expect(follower.request({x:30,z:0},true,undefined,1000)?.id).toBe(1);
 expect(follower.finish(1,false,1000)).toBe(true);expect(follower.finish(1,true)).toBe(false);
 // Still following, but no retry storm: the same window waits REGION_RETRY_MS[0] before it is asked for again.
 expect(follower.snapshot()).toMatchObject({enabled:true,pending:null,failures:1,retryAt:1000+REGION_RETRY_MS[0],region:{x:0,y:0}});
 expect(follower.request({x:30,z:0},true,undefined,1000+REGION_RETRY_MS[0]-1)).toBeUndefined();
 // Past the safety boundary the failed window still holds the player until its retry lands.
 expect(follower.needsPause({x:45,z:0})).toBe(true);
 expect(follower.request({x:30,z:0},true,undefined,1000+REGION_RETRY_MS[0])?.id).toBe(2);
 expect(follower.finish(2,false,2000)).toBe(true);expect(follower.snapshot()).toMatchObject({enabled:true,failures:2,retryAt:2000+REGION_RETRY_MS[1]});
 expect(follower.request({x:30,z:0},true,undefined,2000+REGION_RETRY_MS[1])?.id).toBe(3);
 // A success clears the failure count; a run of REGION_FAILURE_LIMIT failures stops following.
 expect(follower.finish(3,true)).toBe(true);expect(follower.snapshot()).toMatchObject({enabled:true,failures:0,retryAt:0,region:{x:30}});
 expect(follower.needsPause({x:75,z:0})).toBe(false);
 let id=follower.request({x:60,z:0},true,undefined,3000)!.id,now=3000;
 for(let i=0;i<REGION_FAILURE_LIMIT;i++){expect(follower.finish(id,false,now)).toBe(true);if(i<REGION_FAILURE_LIMIT-1){now+=REGION_RETRY_MS[i];id=follower.request({x:60,z:0},true,undefined,now)!.id;}}
 expect(follower.snapshot()).toMatchObject({enabled:false,pending:null,failures:REGION_FAILURE_LIMIT});
 expect(follower.request({x:100,z:0},true,undefined,1e9)).toBeUndefined();
});
test('directional lookahead centers the next window ahead of motion',()=>{
 const follower=new SceneRegionFollower({x:0,y:0,radius:100});
 const still=follower.request({x:40,z:0},true,{x:0,z:0})!;expect(still.region.x).toBe(40);
 follower.finish(still.id,true);
 // 30 units/s east with the default two-second lead wants +60 ahead: (-60)+60=0.
 const fast=follower.request({x:-60,z:0},true,{x:30,z:0})!;
 expect(fast.region.x).toBe(0);expect(fast.region.y).toBeCloseTo(0,10);
 follower.finish(fast.id,true);
 // A longer lead (the worker's measured latency) reaches further, clamped at 0.8 radius: (-140)+80=-60.
 follower.leadSeconds=4;
 const far=follower.request({x:-140,z:0},true,{x:30,z:0})!;
 expect(far.region.x).toBe(-60);follower.finish(far.id,true);follower.leadSeconds=2;
 // Below 0.5 units/s the window stays on the player.
 const slow=follower.request({x:60,z:0},true,{x:0.2,z:0})!;
 expect(slow.region.x).toBe(60);follower.finish(slow.id,true);
 expect(()=>follower.request({x:60,z:0},true,{x:NaN,z:0})).toThrow('Invalid');
});
test('invalid windows and nonfinite player positions fail explicitly',()=>{
 for(const radius of [0,31,1001,NaN])expect(()=>new SceneRegionFollower({x:0,y:0,radius})).toThrow('32–1000');
 const follower=new SceneRegionFollower({x:0,y:0,radius:50});expect(()=>follower.request({x:NaN,z:0},true)).toThrow('Invalid');expect(follower.snapshot().requests).toBe(0);
});

test('the safety boundary applies only to pending work and keeps the original center until commit',()=>{
 const follower=new SceneRegionFollower({x:100,y:200,radius:100});expect(follower.needsPause({x:180,z:-200})).toBe(false);
 follower.request({x:130,z:-200},true);expect(follower.needsPause({x:184.99,z:-200})).toBe(false);expect(follower.needsPause({x:185,z:-200})).toBe(true);
 expect(follower.needsPause({x:100,z:-285})).toBe(true);follower.finish(1,true);expect(follower.needsPause({x:185,z:-200})).toBe(false);
 follower.request({x:180,z:-200},true);expect(follower.needsPause({x:175,z:-200})).toBe(false);expect(follower.needsPause({x:215,z:-265})).toBe(true);
 follower.stop();expect(follower.needsPause({x:1000,z:0})).toBe(false);
});

test('aircraft window expansion waits for a matching terrain commit before changing the safety boundary',()=>{
 const follower=new SceneRegionFollower({x:0,y:0,radius:180});follower.setRadius(400);
 const request=follower.request({x:0,z:0},true)!;expect(request.region.radius).toBe(400);expect(follower.snapshot().region.radius).toBe(180);
 expect(follower.needsPause({x:160,z:0})).toBe(true);follower.finish(request.id,true);expect(follower.snapshot().region.radius).toBe(400);
 expect(follower.request({x:100,z:0},true)).toBeUndefined();follower.setRadius(180);expect(follower.request({x:140,z:0},true)?.region.radius).toBe(180);
 expect(()=>follower.setRadius(Infinity)).toThrow('Invalid');
});
test('distant scenery radius changes independently without widening the collision safety boundary',()=>{
 const follower=new SceneRegionFollower({x:0,y:0,radius:400});follower.setRadius(400,1000);
 const expanded=follower.request({x:0,z:0},true)!;expect(expanded.region.lodRadius).toBe(1000);
 expect(follower.snapshot().region.lodRadius).toBeUndefined();expect(follower.needsPause({x:341,z:0})).toBe(true);
 follower.finish(expanded.id,true);expect(follower.snapshot().region.lodRadius).toBe(1000);
 expect(follower.request({x:0,z:0},true)).toBeUndefined();follower.setRadius(400);
 const reduced=follower.request({x:0,z:0},true)!;expect(reduced.region.lodRadius).toBeUndefined();
 follower.finish(reduced.id,true);expect(follower.snapshot().region.lodRadius).toBeUndefined();
 expect(()=>follower.setRadius(400,399)).toThrow('distant');
});

test('a primed follower asks for the window it stands in once, ignoring the prefetch distance',()=>{
 const follower=new SceneRegionFollower({x:0,y:0,radius:100});
 expect(follower.request({x:5,z:0},true,{x:0,z:0})).toBeUndefined();
 follower.primeNext=true;
 const primed=follower.request({x:5,z:0},true,{x:0,z:0})!;expect(primed.region.x).toBe(5);
 follower.finish(primed.id,true);
 expect(follower.primeNext).toBe(false);expect(follower.request({x:6,z:0},true,{x:0,z:0})).toBeUndefined();
});
