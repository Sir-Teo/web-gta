import {expect,test} from 'vitest';
import {sunReflection,type SunReflectionInput} from '../src/world/nativeSunReflection';

const input=(over:Partial<SunReflectionInput>={}):SunReflectionInput=>({toSun:[0,Math.cos(Math.asin(.25)),.25],camera:[0,-2500,20],cloudCoverage:0,foggyness:0,wind:0,
 sunCore:[255,255,200],sunCorona:[255,140,40],timeMs:0,...over});

test('CCoronas::RenderSunReflection lays a strip toward a low sun, a quarter of the sun colours at best', () => {
 const strip=sunReflection(input())!;
 // (0.3 − |0.25 − 0.25|) / 0.3 × 0.25 of core + corona.
 expect(strip.color).toEqual([127,98,60]);
 expect(strip.positions).toHaveLength(44*3);expect(strip.indices).toHaveLength(126);
 // The first quad starts 40 units toward the sun, 30 either side, on the plane 0.1 above the sea.
 const d=Math.cos(Math.asin(.25))*40;
 expect([...strip.positions.slice(0,3)].map(v=>+v.toFixed(3))).toEqual([30,+(-2500+d).toFixed(3),.1]);
 expect([...strip.positions.slice(3,6)].map(v=>+v.toFixed(3))).toEqual([-30,+(-2500+d).toFixed(3),.1]);
 expect([...strip.indices.slice(0,12)]).toEqual([2,1,0,2,3,1,4,3,2,4,5,3]);
 // The last pair lies 60 + 19 × 72 units on, as wide as sin(phase) × 10 + 951.
 const last=strip.positions.slice(42*3,43*3),phase=Math.sin(((0+900*19)%2048)/2048*2*Math.PI)*10+951;
 expect(last[0]).toBeCloseTo(phase,3);expect(last[1]).toBeCloseTo(-2500+d+1428,2);
 // Wind lifts it; weather and a high or set sun take it away.
 expect(sunReflection(input({wind:.5}))!.positions[2]).toBeCloseTo(.35);
 expect(sunReflection(input({cloudCoverage:1}))).toBeUndefined();
 expect(sunReflection(input({toSun:[0,.5,.9]}))).toBeUndefined();
 expect(sunReflection(input({toSun:[0,1,-.06]}))).toBeUndefined();
});

test('the reflection fades out within 350 units of the five sea-level shores', () => {
 expect(sunReflection(input({camera:[2372,-1854+200,20]}))!.color).toEqual([0,0,0]);
 expect(sunReflection(input({camera:[2372,-1854+300,20]}))!.color).toEqual([63,49,30]);
});
