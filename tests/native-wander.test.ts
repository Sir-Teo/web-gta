import {expect,test} from 'vitest';
import {findNextNodeWandering,wanderSector,wanderStep,wanderUpdateDir} from '../src/ped/nativeWander';

// A crossroads: north (0), east (2), south (4, where the ped came from) and west (6).
const cross=[{node:'n',x:0,y:10,back:false},{node:'e',x:10,y:0,back:false},{node:'s',x:0,y:-10,back:true},{node:'w',x:-10,y:0,back:false}];
test('directions are eighths of a turn from +y toward +x',()=>{
 expect(wanderSector(0,1)).toBe(0);expect(wanderSector(1,1)).toBe(1);expect(wanderSector(1,0)).toBe(2);expect(wanderSector(0,-1)).toBe(4);expect(wanderSector(-1,0)).toBe(6);
});
test('UpdateDir turns only at junctions: a quarter one way for draws 81 to 90, the other way above 90',()=>{
 // (3 x frame + seed) % 100.
 expect(wanderUpdateDir(0,4,0,50)).toBe(0);
 expect(wanderUpdateDir(0,4,0,85)).toBe(2);
 expect(wanderUpdateDir(0,4,0,95)).toBe(6);
 expect(wanderUpdateDir(0,4,10,55)).toBe(2);
 expect(wanderUpdateDir(0,2,0,95)).toBe(0);
});
test('the next node is the link closest to the direction, never back unless it is the only way on',()=>{
 expect(findNextNodeWandering(cross,0)?.node).toBe('n');
 expect(findNextNodeWandering(cross,1)?.node).toBe('n');
 expect(findNextNodeWandering(cross,4)?.node).not.toBe('s');
 expect(findNextNodeWandering([{node:'s',x:0,y:-10,back:true}],0)).toEqual({node:'s',dir:4});
});
test('a wander goes straight on at most junctions and takes the road\'s bend on the way',()=>{
 expect(wanderStep(0,4,0,10,cross)).toEqual({node:'n',dir:0});
 // A bend to the north-east: the direction follows the link.
 expect(wanderStep(0,2,0,95,[{node:'ne',x:7,y:7,back:false},{node:'s',x:0,y:-10,back:true}])).toEqual({node:'ne',dir:1});
 // Turning east at a crossroads keeps the new direction (east lies two eighths from north).
 expect(wanderStep(0,4,0,85,cross)).toEqual({node:'e',dir:2});
 // Turning west from north: 6 - 0 is more than three eighths without wrapping, so the direction stays north.
 expect(wanderStep(0,4,0,95,cross)).toEqual({node:'w',dir:0});
});
