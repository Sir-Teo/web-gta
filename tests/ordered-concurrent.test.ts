import {expect,test} from 'vitest';
import {orderedConcurrent} from '../src/assets/orderedConcurrent';

test('bounded loading overlaps I/O but publishes in input order', async () => {
  let active=0,peak=0;
  const completed:number[]=[],published:number[]=[];
  for await (const value of orderedConcurrent([0,1,2,3,4,5],async value=>{
    peak=Math.max(peak,++active);
    await new Promise(resolve=>setTimeout(resolve,value===0?20:1));
    active--;completed.push(value);return value;
  },3)) published.push(value);
  expect(peak).toBe(3);expect(completed[0]).not.toBe(0);expect(published).toEqual([0,1,2,3,4,5]);
});

test('failure settles the bounded window without starting the rest',async()=>{
  const started:number[]=[];let finished=0;
  const read=async()=>{for await(const value of orderedConcurrent([0,1,2,3,4],async n=>{
    started.push(n);await new Promise(r=>setTimeout(r,n===0?10:1));finished++;
    if(n<2)throw Error(`bad ${n}`);return n;
  },3))void value;};
  await expect(read()).rejects.toThrow('bad 0');expect(started).toEqual([0,1,2]);expect(finished).toBe(3);
});
