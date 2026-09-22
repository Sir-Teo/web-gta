import {test,expect} from 'vitest';
import {retainPrograms} from '../src/render/retainPrograms';

// A stand-in for WebGLPrograms.releaseProgram: a program is deleted when its use count reaches zero.
function renderer(){
 const programs:{usedTimes:number;key:string}[]=[];
 const acquire=(key:string)=>{let p=programs.find(q=>q.key===key);if(p)p.usedTimes++;else{p={usedTimes:1,key};programs.push(p);}return p;};
 const release=(p:{usedTimes:number})=>{if(--p.usedTimes===0)programs.splice(programs.indexOf(p as never),1);};
 return {info:{programs},acquire,release};
}

test('a retained program survives its last material being disposed and is reused',()=>{
 const r=renderer(),first=r.acquire('lambert');
 expect(retainPrograms(r)).toBe(1);
 r.release(first);
 expect(r.info.programs).toHaveLength(1);
 expect(r.acquire('lambert')).toBe(first);
});

test('each program is retained once, however often the frame runs',()=>{
 const r=renderer(),p=r.acquire('basic');
 retainPrograms(r);retainPrograms(r);retainPrograms(r);
 expect(p.usedTimes).toBe(2);
 r.release(p);expect(p.usedTimes).toBe(1);
});

test('past the limit, programs follow three\'s own release policy',()=>{
 const r=renderer(),a=r.acquire('a'),b=r.acquire('b');
 expect(retainPrograms(r,1)).toBe(1);
 r.release(a);r.release(b);
 expect(r.info.programs.map(p=>p.key)).toEqual(['a']);
});
