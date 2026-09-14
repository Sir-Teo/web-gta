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
