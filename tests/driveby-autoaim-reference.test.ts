import {expect,test} from 'vitest';
import reference from './fixtures/driveby-autoaim-reference.json';
import {driveByAutoAim} from '../src/weapons/nativeDriveByAim';
for(const [index,row] of reference.cases.entries())test(`native drive-by auto-aim selection ${index}`,()=>{
 const result=driveByAutoAim(row.input);
 expect(result.end).toEqual(row.end);expect(result.index!==undefined).toBe(row.choice.accepted);
 if('score' in row.choice){expect(result.score).toBe(row.choice.score);expect(result.threshold).toBe(row.choice.threshold);}
 if(row.choice.accepted)expect(result.index).toBe(row.choice.index);
});
