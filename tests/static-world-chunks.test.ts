import {test,expect} from 'vitest';
import {planStaticWorldChunks} from '../src/assets/staticWorldChunks';

test('chunks follow archive order and fill up to the limit',()=>{
 const entries=[{name:'b.txd',offset:4096,length:2048},{name:'a.dff',offset:0,length:2048},{name:'c.col',offset:2048,length:2048},{name:'d.ifp',offset:6144,length:4096}];
 expect(planStaticWorldChunks(entries,6144).map(c=>c.map(e=>e.name))).toEqual([['a.dff','c.col','b.txd'],['d.ifp']]);
});

test('an entry larger than the limit is a chunk of its own, and no entry is lost',()=>{
 const entries=[{offset:0,length:100},{offset:100,length:5000},{offset:5100,length:100},{offset:5200,length:100}];
 const chunks=planStaticWorldChunks(entries,1000);
 expect(chunks.map(c=>c.map(e=>e.offset))).toEqual([[0],[100],[5100,5200]]);
 expect(chunks.flat()).toHaveLength(entries.length);
});

test('the limit must be a positive integer',()=>{
 expect(()=>planStaticWorldChunks([],0)).toThrow();expect(()=>planStaticWorldChunks([],1.5)).toThrow();
});
