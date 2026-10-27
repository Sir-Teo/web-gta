import {expect,test} from 'vitest';
import reference from './fixtures/bike-bumper-height-reference.json';
import {nativeBikeBumperCamera} from '../src/render/nativeBikeBumperCamera';

for(const [index,row] of reference.cases.entries())test(`native bike bumper neck/visibility capture ${index}`,()=>{
 const i=row.input,result=nativeBikeBumperCamera({source:row.baseSource!,position:i.matrix.position,neck:i.neck,velocity:i.velocity,timeStep:i.timeStep,front:i.front,up:i.up});
 expect(i.lineClear?result.source:result.blockedSource).toEqual(row.source);
 expect(result.lineFrom).toEqual(row.visibility!.from);expect(result.lineTo).toEqual(row.visibility!.to);
 expect(row.visibility!.flags).toEqual([1,0,0,0,0,0,0]);expect(row.boneCalls).toEqual([{bone:4,update:1}]);
});
