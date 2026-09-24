import {expect,test} from 'vitest';
import {MAX_PERMANENT_SHADOWS,NativePermanentShadows,explosionScorch} from '../src/render/nativePermanentShadows';

test('an explosion scorch lasts 30 s, fades over its last quarter, and the table holds 48',()=>{
 const table=new NativePermanentShadows();
 expect(table.add(explosionScorch([1,2,3]),1000)).toBe(true);
 const [pool]=table.pools(1000);
 expect(pool).toMatchObject({position:[1,2,3],front:[8,0],side:[0,-8],intensity:200,color:[0,0,0],maxHeight:10});
 expect(table.pools(1000+22500)[0].intensity).toBe(200);
 expect(table.pools(1000+26250)[0].intensity).toBe(100);
 expect(table.pools(1000+30000)).toEqual([]);
 for(let i=0;i<MAX_PERMANENT_SHADOWS;i++)expect(table.add(explosionScorch([i,0,0]),0)).toBe(true);
 expect(table.add(explosionScorch([0,0,0]),0)).toBe(false);
});
