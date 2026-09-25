import {expect,test} from 'vitest';
import {ScmEntityPool} from '../src/simulation/ScmEntityPool';

test('whenSettled waits for an entity still being made, and answers nothing for one that failed',async()=>{
 const pool=new ScmEntityPool<{id:number}>({aliveOf:()=>true,remove(){}});
 let finish!:(v:{id:number}|undefined)=>void;
 const handle=pool.create(()=>new Promise(resolve=>{finish=resolve;}));
 const waiting=pool.whenSettled(handle);
 finish({id:7});
 expect(await waiting).toEqual({id:7});
 expect(await pool.whenSettled(handle)).toEqual({id:7});
 const failed=pool.create(async()=>undefined);
 expect(await pool.whenSettled(failed)).toBeUndefined();
 expect(await pool.whenSettled(9999)).toBeUndefined();
});
