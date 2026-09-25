import {describe,expect,test} from 'vitest';
import {ScmStuckCarCheck,ScmUpsideDownCarCheck,STUCK_CAR_CHECK_SIZE,type ScmCarCheckWorld} from '../src/engine/ScmCarChecks';
import {findNodeCoorsForScriptBetween} from '../src/simulation/nativeScriptCarNodes';
import type {PathNode} from '../src/assets/pathNodes';

/** One car, handle 5, that the test moves about. */
function world(extra:Partial<ScmCarCheckWorld>={}){
 const state={exists:true,position:{x:0,y:0,z:0},driver:true,upsideDown:false,inWater:false,onScreen:false,warps:[] as unknown[]};
 const w:ScmCarCheckWorld={
  vehicleExists:()=>state.exists,vehiclePosition:()=>({...state.position}),vehicleHasDriver:()=>state.driver,
  vehicleIsUpsideDownForCheck:()=>state.upsideDown,vehicleIsInWater:()=>state.inWater,vehicleIsOnScreen:()=>state.onScreen,
  isSphereVisible:()=>false,pointIsObscuredByMissionEntity:()=>false,
  carPlacementNode:(_point,nth)=>({x:100+nth,y:0,z:0,heading:90}),
  warpVehicle:(handle,point,heading)=>{state.warps.push([handle,point,heading]);},
  ...extra,
 };
 return {state,w};
}

describe('CStuckCarCheck',()=>{
 test('a driven car that has not gone the radius in the check time is stuck',()=>{
  const {state,w}=world(),check=new ScmStuckCarCheck();
  check.add(5,state.position,1000,2,3000);
  expect(check.has(5)).toBe(true);
  // Checked only once the time is past, not at it.
  state.position={x:1,y:0,z:0};check.process(4000,w);expect(check.isStuck(5)).toBe(false);
  check.process(4001,w);expect(check.isStuck(5)).toBe(true);
  // The next check measures from where it was last checked.
  state.position={x:4,y:0,z:0};check.process(7002,w);expect(check.isStuck(5)).toBe(false);
 });

 test('a car nobody drives starts its clock and place again, and a gone car frees its slot',()=>{
  const {state,w}=world(),check=new ScmStuckCarCheck();
  check.add(5,state.position,0,2,1000);
  state.driver=false;check.process(5000,w);
  state.driver=true;check.process(5500,w);expect(check.isStuck(5)).toBe(false);
  check.process(6001,w);expect(check.isStuck(5)).toBe(true);
  state.exists=false;check.process(6002,w);expect(check.has(5)).toBe(false);
 });

 test('sixteen slots, and a remove clears every slot the car holds',()=>{
  const {w}=world(),check=new ScmStuckCarCheck();
  for(let i=0;i<STUCK_CAR_CHECK_SIZE+1;i++)check.add(i+1,{x:0,y:0,z:0},0,1,1);
  expect(check.has(STUCK_CAR_CHECK_SIZE+1)).toBe(false);
  check.add(3,{x:0,y:0,z:0},0,1,1);check.remove(3);expect(check.has(3)).toBe(false);
  expect(()=>check.process(10,w)).not.toThrow();
 });

 test('a warp check puts a stuck car on the first node it may use, out of sight',()=>{
  const {state,w}=world({isSphereVisible:point=>point.x===100}),check=new ScmStuckCarCheck();
  check.add(5,state.position,0,2,1000,{stuck:true,flipped:false,inWater:false,nodesToCheck:3});
  // Seen by the camera, the car stays.
  state.onScreen=true;check.process(1001,w);expect(state.warps).toEqual([]);
  // Out of sight: node 0 is in view, so node 1 takes it.
  state.onScreen=false;check.process(1002,w);
  expect(state.warps).toEqual([[5,{x:101,y:0,z:0,heading:90},90]]);
 });

 test('a car flipped or under water warps as its switches say, and a minus count uses its own route',()=>{
  const route={x:7,y:8,z:9,heading:45};
  const {state,w}=world({vehicleRouteNodeForScript:()=>route}),check=new ScmStuckCarCheck();
  check.add(5,state.position,0,2,1000000,{stuck:false,flipped:true,inWater:false,nodesToCheck:-1});
  state.inWater=true;check.process(10,w);expect(state.warps).toEqual([]);
  state.upsideDown=true;check.process(20,w);expect(state.warps).toEqual([[5,route,45]]);
  // The count is an int8: 255 is -1.
  const other=new ScmStuckCarCheck();other.add(6,{x:0,y:0,z:0},0,1,1,{stuck:true,flipped:false,inWater:false,nodesToCheck:255});
  expect(other.cars[0].numberOfNodesToCheck).toBe(-1);
 });

 test('no warp onto a point a mission entity stands on',()=>{
  const {state,w}=world({pointIsObscuredByMissionEntity:x=>x<102}),check=new ScmStuckCarCheck();
  check.add(5,state.position,0,2,1000,{stuck:true,flipped:false,inWater:false,nodesToCheck:2});
  check.process(1001,w);expect(state.warps).toEqual([]);
 });
});

describe('CUpsideDownCarCheck',()=>{
 test('a car upside down for more than two seconds is stuck on its roof',()=>{
  const {state,w}=world(),check=new ScmUpsideDownCarCheck();
  check.add(5);state.upsideDown=true;
  for(let i=0;i<100;i++)check.updateTimers(20,w);
  expect(check.hasBeenUpsideDownForAWhile(5)).toBe(false);
  check.updateTimers(20,w);expect(check.hasBeenUpsideDownForAWhile(5)).toBe(true);
  // Righted, its clock starts again.
  state.upsideDown=false;check.updateTimers(20,w);expect(check.hasBeenUpsideDownForAWhile(5)).toBe(false);
 });

 test('one add takes one slot, and a gone car frees it for the next',()=>{
  const {state,w}=world(),check=new ScmUpsideDownCarCheck();
  check.add(5);expect(check.cars.filter(c=>c.handle===5)).toHaveLength(1);
  state.exists=false;check.updateTimers(20,w);expect(check.cars[0].handle).toBe(-1);
  check.add(6);expect(check.cars[0].handle).toBe(6);
  check.remove(6);expect(check.cars.every(c=>c.handle===-1)).toBe(true);
 });
});

test('FindNodeCoorsForScript for two nodes heads from the first to the second, beside the first',()=>{
 const node=(position:[number,number,number],width:number)=>({position,width} as PathNode);
 // East is a heading of -90 (atan2(-1, 0)); the left of east is north.
 const beside=findNodeCoorsForScriptBetween(node([0,0,0],1),node([10,0,0],0));
 expect(beside.heading).toBeCloseTo(-90,6);expect(beside.x).toBeCloseTo(0,6);expect(beside.y).toBeCloseTo(3.7,6);
 const north=findNodeCoorsForScriptBetween(node([0,0,5],0),node([0,10,5],0));
 expect(north).toMatchObject({x:0,y:0,z:5});expect(north.heading).toBeCloseTo(0,6);
});
