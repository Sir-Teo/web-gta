import {expect,test} from 'vitest';
import {NativeMotionBlurStreaks} from '../src/weapons/nativeMotionBlurStreaks';

test('CMotionBlurStreaks trails a registered object over its last two frames and frees the slot once it stops', () => {
 const s=new NativeMotionBlurStreaks(),edge=(x:number)=>[{x,y:0,z:-.07},{x,y:0,z:.07}] as const;
 const grey=[100,100,100,255] as const;
 s.update();s.register(7,grey,...edge(0));
 // One frame: nothing to join yet.
 expect(s.geometry().positions).toHaveLength(0);
 s.update();s.register(7,grey,...edge(1));
 let g=s.geometry();expect(g.positions.length/3).toBe(6);
 // A third of 255 at the newest edge, 170/3 at the one before.
 expect(g.colors.filter((_,i)=>i%4===3)).toEqual([85,85,56,85,56,56]);
 s.update();s.register(7,grey,...edge(2));
 g=s.geometry();expect(g.positions.length/3).toBe(12);expect(g.colors.filter((_,i)=>i%4===3).slice(6)).toEqual([56,56,28,56,28,28]);
 // Not registered: no quads, and after two quiet frames the slot frees.
 s.update();expect(s.geometry().positions).toHaveLength(0);expect(s.streaks[0].id).toBe(7);
 s.update();s.update();expect(s.streaks[0].id).toBe(0);
 // Four slots at most.
 for(let id=1;id<=5;id++)s.register(id,grey,...edge(0));expect(s.streaks.map(k=>k.id)).toEqual([1,2,3,4]);
});
