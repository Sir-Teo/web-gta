import {expect,test} from 'vitest';
import {ScmCheckpoints} from '../src/engine/ScmCheckpoints';

test('a checkpoint handle goes stale when its slot is freed and reused (GetActualScriptThingIndex)',()=>{
 const table=new ScmCheckpoints(),p={x:0,y:0,z:0};
 const first=table.create(1,p,p,2);table.remove(first);
 const second=table.create(1,p,p,3);
 expect(ScmCheckpoints.indexOf(second)).toBe(ScmCheckpoints.indexOf(first));expect(second).not.toBe(first);
 // The old handle names nothing and deletes nothing.
 expect(table.at(first)).toBeUndefined();table.remove(first);
 expect(table.at(second)?.radius).toBe(3);expect(table.count).toBe(1);
});
