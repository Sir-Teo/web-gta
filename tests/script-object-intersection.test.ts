import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
import {ScmEntityPending} from '../src/engine/ScmThread';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));

test('IS_OBJECT_INTERSECTING_WORLD waits for COL and queries without a collision-record or own-collision gate',()=>{
 const query=vi.fn<()=>boolean|undefined>(()=>undefined);
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{scriptObjectIntersectingWorld:query} as any),w=m.runtime.world!;
 const o=m.runtime.game.objects.create('kmb_woodenbox',{x:10,y:20,z:30},{external:false,missionCleanup:false});
 o.usesCollision=false;o.recordsCollisions=false;expect(o.recordsCollisions).toBe(false);
 expect(()=>w.isObjectIntersectingWorld!(o.handle)).toThrow(ScmEntityPending);
 query.mockReturnValue(true);expect(w.isObjectIntersectingWorld!(o.handle)).toBe(true);
 query.mockReturnValue(false);expect(w.isObjectIntersectingWorld!(o.handle)).toBe(false);
 expect(o.position).toEqual({x:10,y:20,z:30});expect(o.usesCollision).toBe(false);expect(o.recordsCollisions).toBe(false);
 expect(query).toHaveBeenLastCalledWith(o.handle);
});

test('REMOVE_OIL_PUDDLES_IN_AREA normalizes reversed script corners before the native pool call',()=>{
 const remove=vi.fn(),m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{removeScriptOilPuddles:remove} as any);
 m.runtime.world!.removeOilPuddlesInArea!(10,-5,-20,30);
 expect(remove).toHaveBeenCalledExactlyOnceWith(-20,10,-5,30);
});
