import {expect,test} from 'vitest';
import {waitingCopSpot,waitingCoppers} from '../src/police/waitingCoppers';

// CPopulation::CreateWaitingCoppers' tables and spots.
test('cops and cars waiting outside a door by wanted level',()=>{
 expect([0,1,2,3,4,5,6].map(waitingCoppers)).toEqual([{cops:0,cars:0},{cops:1,cars:0},{cops:2,cars:0},{cops:4,cars:1},{cops:5,cars:1},{cops:6,cars:2},{cops:7,cars:2}]);
 expect(waitingCoppers(9)).toEqual({cops:7,cars:2});
});
test('the first try is straight out along the exit heading, later tries spread 0.2 i either way, 8 to 10 units out',()=>{
 const first=waitingCopSpot({x:100,y:200},Math.PI/2,0,()=>0);
 expect(first.x).toBeCloseTo(108,6);expect(first.y).toBeCloseTo(200,6);
 const far=waitingCopSpot({x:0,y:0},0,0,()=>1);expect(far.y).toBeCloseTo(10,6);
 // Try 5 with the random at 0 is 1 rad to the left, at 1 a rad to the right.
 const left=waitingCopSpot({x:0,y:0},0,5,()=>0),right=waitingCopSpot({x:0,y:0},0,5,()=>1);
 expect(Math.atan2(left.x,left.y)).toBeCloseTo(-1,6);expect(Math.atan2(right.x,right.y)).toBeCloseTo(1,6);
});
