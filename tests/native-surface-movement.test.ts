import {expect,test} from 'vitest';
import {readSurfaceSprintRestrictions,surfaceBlocksSprint} from '../src/simulation/nativeSurfaceMovement';
import {nativeSurfaceId} from '../src/assets/surfaceIds';
const row=(name:string,sprint:number)=>{const flags=Array(29).fill('0');flags[15]=String(sprint);return [name,'ROAD',1,-.25,'DEFAULT','NONE',...flags,'NONE'].join(' ');};
test('surface sprint flags narrow signed integers to bool and retain native last-row precedence',()=>{
 const table=readSurfaceSprintRestrictions([row('CARPET',-1),row('TARMAC',1),row('TARMAC',0)].join('\n'));
 expect(surfaceBlocksSprint(table,nativeSurfaceId('CARPET'))).toBe(true);
 expect(surfaceBlocksSprint(table,nativeSurfaceId('TARMAC'))).toBe(false);
 expect(surfaceBlocksSprint(table,undefined)).toBe(false);expect(surfaceBlocksSprint(undefined,0)).toBe(false);
 expect(surfaceBlocksSprint(readSurfaceSprintRestrictions(row('unknown',1)),0)).toBe(true);
});

test('a steep-slope surface refuses the jump while the ped faces into it (CTaskSimpleJump::StartLaunchAnim)',async()=>{
 const {steepSlopeRefusesJump}=await import('../src/simulation/nativeSurfaceMovement');
 const steep=new Map([[5,true],[6,false]]);
 // The slope rises toward +z: its normal leans back toward -z.
 const normal={x:0,z:-.6};
 expect(steepSlopeRefusesJump(steep,5,{x:0,z:1},normal)).toBe(true);
 expect(steepSlopeRefusesJump(steep,5,{x:0,z:-1},normal)).toBe(false);
 expect(steepSlopeRefusesJump(steep,6,{x:0,z:1},normal)).toBe(false);
 expect(steepSlopeRefusesJump(steep,undefined,{x:0,z:1},normal)).toBe(false);
});
