import {expect,test} from 'vitest';
import {mergeAlikeSpans} from '../src/assets/mergeSpans';

const span=(start:number,count:number,material:number,min:number,max:number)=>({start,count,material,min,max});
test('alike spans join at the first one’s place, their triangles kept and the rest in order',()=>{
 const indices=Uint32Array.from([0,1,2, 3,4,5, 6,7,8, 9,10,11]);
 const spans=[span(0,3,0,0,2),span(3,3,1,3,5),span(6,3,2,6,8),span(9,3,3,9,11)];
 // Materials 0 and 2 alike, 1 and 3 each their own; 3 translucent (no key).
 const keys=['a','b','a',undefined];
 const {spans:out,indices:idx}=mergeAlikeSpans(spans,indices,s=>keys[s.material]);
 expect(out).toEqual([span(0,6,0,0,8),span(6,3,1,3,5),span(9,3,3,9,11)]);
 expect([...idx]).toEqual([0,1,2,6,7,8,3,4,5,9,10,11]);
});
test('nothing to join leaves the model as it is',()=>{
 const indices=Uint32Array.from([0,1,2,3,4,5]),spans=[span(0,3,0,0,2),span(3,3,1,3,5)];
 const r=mergeAlikeSpans(spans,indices,s=>String(s.material));
 expect(r.indices).toBe(indices);expect(r.spans).toEqual(spans);
});
test('an empty span is not joined and every triangle survives',()=>{
 const indices=Uint32Array.from([0,1,2,3,4,5,6,7,8]),spans=[span(0,3,0,0,2),span(3,0,1,0,0),span(3,3,2,3,5),span(6,3,3,6,8)];
 const r=mergeAlikeSpans(spans,indices,s=>s.material===1?'x':s.material===3?'y':'z');
 expect(r.spans.reduce((n,s)=>n+s.count,0)).toBe(9);expect([...r.indices].sort((a,b)=>a-b)).toEqual([0,1,2,3,4,5,6,7,8]);
 expect(r.spans.map(s=>s.material)).toEqual([0,1,3]);
});
