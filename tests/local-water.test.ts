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
