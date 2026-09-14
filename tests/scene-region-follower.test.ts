import {expect,test} from 'vitest';
import {SceneRegionFollower} from '../src/assets/sceneRegionFollower';
test('requests overlapping native XY windows only for eligible movement and commits matching replies',()=>{
 const initial={x:100,y:200,radius:100},follower=new SceneRegionFollower(initial);initial.x=999;
 expect(follower.request({x:139.9,z:-200},true)).toBeUndefined();expect(follower.request({x:140,z:-200},false)).toBeUndefined();
 const request=follower.request({x:140,z:-200},true)!;expect(request).toEqual({id:1,region:{x:140,y:200,radius:100,includeCollisionBounds:true}});
 request.region.x=999;expect(follower.request({x:190,z:-200},true)).toBeUndefined();expect(follower.finish(2,true)).toBe(false);
 expect(follower.finish(1,true)).toBe(true);expect(follower.snapshot().region.x).toBe(140);
 expect(follower.request({x:140,z:-239.9},true)).toBeUndefined();expect(follower.request({x:140,z:-240},true)?.id).toBe(2);
 const snapshot=follower.snapshot();snapshot.region.x=999;expect(follower.snapshot().region.x).toBe(140);
});
test('failures and explicit stop prevent retry storms and reject late responses',()=>{
 for(const stop of [false,true]){
  const follower=new SceneRegionFollower({x:0,y:0,radius:50});follower.request({x:30,z:0},true);
  if(stop)follower.stop();else follower.finish(1,false);
  expect(follower.finish(1,true)).toBe(false);expect(follower.request({x:100,z:0},true)).toBeUndefined();expect(follower.snapshot()).toMatchObject({enabled:false,pending:null,requests:1,region:{x:0,y:0}});
 }
});
test('invalid windows and nonfinite player positions fail explicitly',()=>{
 for(const radius of [0,31,1001,NaN])expect(()=>new SceneRegionFollower({x:0,y:0,radius})).toThrow('32–1000');
 const follower=new SceneRegionFollower({x:0,y:0,radius:50});expect(()=>follower.request({x:NaN,z:0},true)).toThrow('Invalid');expect(follower.snapshot().requests).toBe(0);
});

test('the safety boundary applies only to pending work and keeps the original center until commit',()=>{
 const follower=new SceneRegionFollower({x:100,y:200,radius:100});expect(follower.needsPause({x:180,z:-200})).toBe(false);
 follower.request({x:140,z:-200},true);expect(follower.needsPause({x:174.99,z:-200})).toBe(false);expect(follower.needsPause({x:175,z:-200})).toBe(true);
 expect(follower.needsPause({x:100,z:-275})).toBe(true);follower.finish(1,true);expect(follower.needsPause({x:175,z:-200})).toBe(false);
 follower.request({x:180,z:-200},true);expect(follower.needsPause({x:175,z:-200})).toBe(false);expect(follower.needsPause({x:215,z:-200})).toBe(true);
 follower.stop();expect(follower.needsPause({x:1000,z:0})).toBe(false);
});
