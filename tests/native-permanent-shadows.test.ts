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

test('oil removal selects only types 4 and 8 strictly inside XY bounds, preserving burning oil and scorch marks',()=>{
 const table=new NativePermanentShadows();
 for(const type of [1,4,5,6,7,8])table.add({...explosionScorch([5,5,1000]),type},0);
 table.removeOilInArea(0,10,0,10);
 expect(table.pools(0)).toHaveLength(4);
 // Scorches and other stages use their original ids; oil's z never exempts it from removal.
 expect(table.pools(0).map(p=>p.id)).toEqual([0,2,3,4]);
});

test('native oil removal preserves exact edges and degenerate rectangles, and releases pool capacity',()=>{
 const table=new NativePermanentShadows();
 for(const p of [[0,5,0],[10,5,0],[5,0,0],[5,10,0],[5,5,0]] as [number,number,number][])table.add({...explosionScorch(p),type:4},0);
 table.removeOilInArea(5,5,0,10);expect(table.count).toBe(5);
 table.removeOilInArea(0,10,0,10);expect(table.pools(0).map(p=>p.position)).toEqual([[0,5,0],[10,5,0],[5,0,0],[5,10,0]]);
 for(let i=4;i<MAX_PERMANENT_SHADOWS;i++)expect(table.add(explosionScorch([20,20,0]),0)).toBe(true);
 expect(table.count).toBe(MAX_PERMANENT_SHADOWS);
});

test('oil boundaries use the shadow table float32 coordinates',()=>{
 const table=new NativePermanentShadows();table.add({...explosionScorch([10-1e-8,5,0]),type:8},0);
 table.removeOilInArea(0,10,0,10);expect(table.count).toBe(1);
});
