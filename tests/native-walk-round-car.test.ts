import {describe,expect,test} from 'vitest';
import {WALK_ROUND_PAD,walkRoundCar,type CarFootprint} from '../src/ped/nativeWalkRoundCar';

/** A car at the origin facing +x: 2.5 half length, 1 half width. */
const car:CarFootprint={center:{x:0,z:0},forward:{x:1,z:0},halfLength:2.5,halfWidth:1};
const L=2.5+WALK_ROUND_PAD,W=1+WALK_ROUND_PAD;

describe('CTaskComplexWalkRoundCar’s way round',()=>{
 test('a clear way is walked straight',()=>{
  expect(walkRoundCar({x:-6,z:4},{x:6,z:4},car)).toBeUndefined();
 });
 test('across the car, the ped heads for the nearer corner on the shorter side',()=>{
  // From below the car to above it, a little right of centre: the right-hand corners are the shorter way.
  const via=walkRoundCar({x:1,z:-5},{x:1,z:5},car)!;
  expect(via.x).toBeCloseTo(L,6);expect(via.z).toBeCloseTo(-W,6);
  // At that corner the next is along the end, and from there the way is clear.
  const next=walkRoundCar(via,{x:1,z:5},car)!;
  expect(next.x).toBeCloseTo(L,6);expect(next.z).toBeCloseTo(W,6);
  expect(walkRoundCar(next,{x:1,z:5},car)).toBeUndefined();
 });
 test('the box turns with the car',()=>{
  const turned:CarFootprint={...car,forward:{x:0,z:1}};
  const via=walkRoundCar({x:-5,z:1},{x:5,z:1},turned)!;
  // Facing +z the car is long along z; round its +z end.
  expect(via.z).toBeCloseTo(L,6);expect(Math.abs(via.x)).toBeCloseTo(W,6);
 });
 test('a ped set down inside the padding steps out across the nearer side first',()=>{
  const out=walkRoundCar({x:.5,z:-1.2},{x:.5,z:6},car)!;
  expect(out.x).toBeCloseTo(.5,6);expect(out.z).toBeLessThan(-W);
  // Even along the car: walking on beside the body snags on it.
  const along=walkRoundCar({x:.5,z:-1.2},{x:8,z:-2},car)!;
  expect(along.z).toBeLessThan(-W);
 });
 test('a goal at the door, inside the padding, is walked at once the car itself is not in the way',()=>{
  expect(walkRoundCar({x:.5,z:-4},{x:.5,z:-1.3},car)).toBeUndefined();
  // From the far side the car is still gone round.
  expect(walkRoundCar({x:.5,z:4},{x:.5,z:-1.3},car)).toBeDefined();
 });
 test('a ped that has strayed inside the padding at the car’s end still goes round to a door on the far side',()=>{
  // Just off the front bumper, on the +z side, for the door on the -z side: straight on is through the body.
  const via=walkRoundCar({x:2.7,z:.4},{x:.5,z:-1.3},car)!;
  expect(via).toBeDefined();
  expect(via.x).toBeCloseTo(L,6);expect(via.z).toBeCloseTo(-W,6);
  // Inside the padding with the body not in the way, the door is walked at once.
  expect(walkRoundCar({x:.5,z:-1.6},{x:.5,z:-1.3},car)).toBeUndefined();
 });
});
