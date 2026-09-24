import {test,expect} from 'vitest';import {Scene} from 'three';import {LocalWater} from '../src/render/LocalWater';
const polygon=(z:number,flags:number)=>`0 0 ${z} 0 0 0 0 2 0 ${z} 0 0 0 0 0 2 ${z} 0 0 0 0 ${flags}`;
test('water swaps atomically and selects visible exterior/interior surfaces',()=>{
 const scene=new Scene(),owner=new LocalWater(scene);owner.load([polygon(0,1),polygon(1000,3),polygon(0,0)].join('\n'),'water.dat');expect(owner.counts).toEqual([1,1]);
 owner.update(0,{color:[.2,.3,.4],opacity:.5});expect(scene.children.map(m=>m.visible)).toEqual([true,false]);
 const original=scene.children[0];expect(()=>owner.load('broken','bad.dat')).toThrow();expect(scene.children[0]).toBe(original);expect(owner.name).toBe('water.dat');
 owner.update(1,{color:[1,1,1],opacity:1});expect(scene.children.map(m=>m.visible)).toEqual([false,true]);
 owner.update(0,undefined);expect(scene.children.every(m=>!m.visible)).toBe(true);
 owner.clear();expect(scene.children).toHaveLength(0);owner.dispose();expect(()=>owner.load(polygon(0,1),'new')).toThrow('disposed');
});
test('the detailed wave patch follows the camera range and SYNC_WATER restarts the wave clock',()=>{
 const scene=new Scene(),owner=new LocalWater(scene),v=(x:number,y:number)=>`${x} ${y} 0 0 0 1 .2`;owner.load(`${v(-500,-500)} ${v(500,-500)} ${v(-500,500)} ${v(500,500)} 1`,'water.dat');
 owner.update(0,{color:[1,1,1],opacity:1},undefined,1234,{x:10,z:-20});
 const detail=scene.children[0].children[0] as import('three').Mesh;expect(detail.visible).toBe(true);expect(detail.geometry.drawRange.count).toBe(48*48*6);
 const x=detail.geometry.getAttribute('position'),xs=Array.from({length:x.count},(_,i)=>x.getX(i)),ys=Array.from({length:x.count},(_,i)=>-x.getZ(i));
 expect([Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)]).toEqual([-38,58,-28,68]);expect(detail.geometry.getAttribute('aWaves').getX(0)).toBeCloseTo(1,6);
 owner.syncWater();expect(owner.waterTimeOffset).toBe(1234);
 owner.update(0,{color:[1,1,1],opacity:1},undefined,1300);expect(detail.visible).toBe(false);
 owner.update(0,{color:[1,1,1],opacity:1},undefined,1300,{x:900,z:0});expect(detail.visible).toBe(false);
 owner.dispose();
});
