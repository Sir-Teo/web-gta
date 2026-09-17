import {expect,test} from 'vitest';
import {ScmThread} from '../src/engine/ScmThread';
import {ScmStrings} from '../src/engine/ScmStrings';

const op=(n:number,...args:number[][])=>[n&255,n>>8,...args.flat()];
const variable=(type:number,n:number)=>[type,n&255,n>>8];
const literal=(bytes:number[],width=8)=>[width===8?9:15,...bytes,...Array(width-bytes.length).fill(0)];

test('text label execution shares global bytes, preserves Windows-1252 and pads shorter replacements',()=>{
 const bytes=new Uint8Array(300);
 bytes.set([
  ...op(1449,variable(10,16),literal([0x43,0x80,0xe9])),
  ...op(1450,variable(11,2),variable(10,16)),
  ...op(1454,variable(11,2),literal([0x43,0x80,0xe9])),...op(1,[4,0]),
  ...op(1450,variable(11,2),literal([65])),...op(1454|0x8000,variable(11,2),variable(10,16)),...op(0x4e)
 ],128);
 const thread=new ScmThread(bytes,128);
 expect(thread.run(0)).toBe('waiting');expect(thread.condition).toBe(true);
 expect([...bytes.slice(16,24)]).toEqual([0x43,0x80,0xe9,0,0,0,0,0]);
 expect(thread.run(0)).toBe('terminated');expect(thread.condition).toBe(true);
 expect([...new Uint8Array(thread.locals.buffer).slice(8,16)]).toEqual([65,0,0,0,0,0,0,0]);
});

test('long text arrays stride sixteen bytes and read global or local index variables',()=>{
 const globals=new DataView(new ArrayBuffer(128)),locals=new DataView(new ArrayBuffer(136)),strings=new ScmStrings(globals,locals);
 globals.setInt32(0,2,true);locals.setInt32(0,1,true);
 const localArray={type:19,value:[2,0,0,0,4,128]},globalArray={type:18,value:[16,0,0,0,4,0]};
 strings.assign(localArray,{type:15,value:'INTRO_LABEL'},16);
 strings.assign(globalArray,localArray,16);
 expect(strings.text({type:17,value:10})).toBe('INTRO_LABEL');
 expect(strings.text({type:16,value:32})).toBe('INTRO_LABEL');
 expect([...new Uint8Array(globals.buffer).slice(43,48)]).toEqual([0,0,0,0,0]);
 globals.setInt32(0,100,true);expect(()=>strings.text(localArray)).toThrow('address out of bounds');
});

test('bounded labels, Pascal lengths and predicate commands preserve their distinct semantics',()=>{
 const globals=new DataView(new ArrayBuffer(64)),locals=new DataView(new ArrayBuffer(136)),strings=new ScmStrings(globals,locals);
 strings.assign({type:10,value:8},{type:9,value:'12345678'},8);
 expect([...new Uint8Array(globals.buffer).slice(8,16)]).toEqual([49,50,51,52,53,54,55,56]);
 expect(strings.text({type:14,value:'A\0B'})).toBe('A\0B');
 expect(()=>strings.assign({type:11,value:33},{type:9,value:'A'},8)).toThrow('address out of bounds');
 const bytes=new Uint8Array(200);bytes.set([...op(2117,variable(11,0)),...op(1,[4,0]),...op(198|0x8000),...op(1,[4,0]),...op(197),...op(0x4e)],128);
 const thread=new ScmThread(bytes,128);thread.run(0);expect(thread.condition).toBe(true);
 thread.run(0);expect(thread.condition).toBe(true);thread.run(0);expect(thread.condition).toBe(true);
});
