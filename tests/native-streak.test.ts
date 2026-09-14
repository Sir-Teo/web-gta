import {expect,test} from 'vitest';
import {Scene,PerspectiveCamera,Group} from 'three';
import {nativeStreak,nativeExtraSunny} from '../src/world/nativeStreak';
import {NativeStreak} from '../src/render/NativeStreak';
test('native streak follows exact visibility boundaries and repeat interval',()=>{
 expect(nativeStreak(299.99,799,true)).toBeDefined();
 for(const [minutes,timer,sunny] of [[300,0,true],[1439,0,true],[0,800,true],[0,8191,true],[0,0,false]] as const)expect(nativeStreak(minutes,timer,sunny)).toBeUndefined();
 expect(nativeStreak(1440,8192,true)).toBeDefined();expect(nativeStreak(0,2**32,true)).toEqual(nativeStreak(0,0,true));
 expect(()=>nativeStreak(0,NaN,true)).toThrow();
 for(let w=0;w<23;w++)expect(nativeExtraSunny(w)).toBe([0,2,6,11,13,17].includes(w));
});
test('streak uses normalized native vectors and a fifty-unit fading tail',()=>{
 const mid=nativeStreak(0,400,true)!;
 expect(mid.head.x).toBeCloseTo(-5/Math.hypot(5,5,.1)*1000);
 expect(mid.head.y).toBeCloseTo(.1/Math.hypot(5,5,.1)*1000);
 expect(mid.head.z).toBeCloseTo(5/Math.hypot(5,5,.1)*1000);
 expect(Math.hypot(mid.tail.x-mid.head.x,mid.tail.y-mid.head.y,mid.tail.z-mid.head.z)).toBeCloseTo(50);
 expect(nativeStreak(0,8192+400,true)!.head).not.toEqual(mid.head);
});
test('streak follows world camera translation, hides and disposes',()=>{
 const scene=new Scene(),streak=new NativeStreak(scene),parent=new Group(),camera=new PerspectiveCamera();parent.position.set(100,200,300);parent.add(camera);camera.position.set(1,2,3);parent.updateMatrixWorld(true);
 streak.update(camera,0,400,true);expect(streak.line.visible).toBe(true);expect(streak.line.position.toArray()).toEqual([101,202,303]);
 streak.update(camera,0,800,true);expect(streak.line.visible).toBe(false);
 streak.dispose();expect(scene.children).toHaveLength(0);
});
