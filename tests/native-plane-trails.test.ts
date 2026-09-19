import {expect,test} from 'vitest';
import {NativePlaneTrails,PlaneTrail} from '../src/world/nativePlaneTrails';
import {NativeCoronas} from '../src/world/nativeCoronas';

test('CPlaneTrail keeps a point every 2 s for 30 s, fading over the last 10', () => {
 const t=new PlaneTrail();
 for(let now=1000;now<=9000;now+=500)t.registerPoint([now,0,0],now);
 // A new point every 2 s (at 1000, 3500, 6000, 8500); the newest keeps moving with its first timepoint.
 expect(t.timepoints.slice(0,5)).toEqual([8500,6000,3500,1000,0]);expect(t.positions[0]).toEqual([9000,0,0]);
 expect(t.render(1,9000).map(l=>[l.from.alpha,l.to.alpha])).toEqual([[110,110],[110,110],[110,110]]);
 // At 32 s the points are 6.5, 4 and 1.5 s from expiring, and the 1 s one is gone.
 expect(t.render(1,32000).map(l=>[l.from.alpha,l.to.alpha])).toEqual([[71,44],[44,16]]);
 expect(t.render(1,31001)[2]).toBeUndefined();
 expect(t.render(.001,9000)).toEqual([]);
});

test('CPlaneTrails circles its planes and blinks their lights at night only', () => {
 const p=new NativePlaneTrails(),c=new NativeCoronas();
 // Within the 2000-unit corona range of the plane.
 p.update(512,23,c,[0,2000,500]);
 const red=c.coronas.find(k=>k.id===101)!;expect(red.color).toEqual([255,0,0]);
 const t=512/20860;expect(red.position[0]).toBeCloseTo(2590*Math.sin(t));expect(red.position[1]).toBeCloseTo(2200*Math.cos(t));expect(red.position[2]).toBe(550);
 // The second plane's lights are 350 ms out of phase: dark at 512 ms.
 expect(c.coronas.some(k=>k.id===102)).toBe(false);
 const day=new NativeCoronas();p.update(512,12,day,[0,2000,500]);expect(day.count).toBe(0);
 // Cloud, fog or rain dims the trails to nothing.
 expect(p.render([200,150,100],{cloudCoverage:1,foggyness:0,rain:0},512)).toEqual([]);
});
