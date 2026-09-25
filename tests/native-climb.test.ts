import {describe,expect,test} from 'vitest';
import {CLIMB,CLIMB_OFFSETS,NativeClimbTask,climbOffset3D,initialClimbHeight,scanToGrab,testForClimb,type ClimbClip,type ClimbEntity,type ClimbWorld,type V3} from '../src/ped/nativeClimb';

/** Axis-aligned boxes as buildings: ProcessSphereBox's closest point, a centre inside a box counting as a hit. */
interface Box extends ClimbEntity{min:V3;max:V3;surface:number}
const box=(min:V3,max:V3,surface=0,kind:ClimbEntity['kind']='building'):Box=>({kind,min,max,surface});
function boxWorld(boxes:Box[],climbable=(s:number|undefined)=>s!==99):ClimbWorld<Box>{
 return {
  entities:()=>boxes,
  contact(entity,spheres){
   for(const [piece,s] of spheres.entries()){
    const c=s.center,p={x:Math.min(Math.max(c.x,entity.min.x),entity.max.x),y:Math.min(Math.max(c.y,entity.min.y),entity.max.y),z:Math.min(Math.max(c.z,entity.min.z),entity.max.z)};
    const d={x:c.x-p.x,y:c.y-p.y,z:c.z-p.z},length=Math.hypot(d.x,d.y,d.z);
    if(length>=s.radius)continue;
    return {piece,point:p,normal:length>0?{x:d.x/length,y:d.y/length,z:d.z/length}:{x:0,y:-1,z:0},surface:entity.surface};
   }
   return undefined;
  },
  canClimb:climbable,
 };
}
// CJ stands with his feet at z 0 facing +y; the ped position is one unit above the feet.
const ped={position:{x:0,y:0,z:1},heading:0};
const DURATIONS:Record<ClimbClip,number>={CLIMB_jump:.567,CLIMB_idle:.8,CLIMB_Pull:.867,CLIMB_Stand:.8,CLIMB_Stand_finish:.2,CLIMB_jump_B:.967,CLIMB_jump2fall:.033};

describe('CTaskSimpleClimb::TestForClimb',()=>{
 test('a two-metre wall is taken at its top edge, facing the wall',()=>{
  const wall=box({x:-3,y:.6,z:0},{x:3,y:1.6,z:2});
  const found=testForClimb(boxWorld([wall]),ped,true);
  expect(found).not.toBe('invalid');
  if(!found||found==='invalid')throw new Error('no hold');
  expect(found.entity).toBe(wall);
  // The find-edge spheres move the face hit to the top corner.
  expect(found.hold.position.y).toBeCloseTo(.6);expect(found.hold.position.z).toBeCloseTo(2);
  expect(found.hold.heading).toBeCloseTo(0);
  // Less than ms_fMinForStretchGrab above the ped: pull straight up.
  expect(initialClimbHeight(found.hold.position,ped.position,false)).toBe(CLIMB.PULLUP);
 });
 test('a wall reaching the head-height spheres blocks the climb',()=>{
  expect(testForClimb(boxWorld([box({x:-3,y:.6,z:0},{x:3,y:1.6,z:5})]),ped,true)).toBeUndefined();
 });
 test('an edge without room to stand marks the climb invalid',()=>{
  // A non-climbable bar over the top: the grab passes it by, the stand-up spheres meet it.
  const wall=box({x:-3,y:.6,z:0},{x:3,y:1.6,z:2}),bar=box({x:-3,y:.8,z:2.8},{x:3,y:1,z:2.9},99);
  expect(testForClimb(boxWorld([wall,bar]),ped,true)).toBe('invalid');
 });
 test('SURFINFO climbable gates the hold',()=>{
  expect(testForClimb(boxWorld([box({x:-3,y:.6,z:0},{x:3,y:1.6,z:2},99)]),ped,true)).toBeUndefined();
 });
 test('the launch reaches the 5/11/17 spheres that the in-air test skips',()=>{
  // A top 2.0–2.5 units above the ped position meets sphere 5 first.
  const wall=box({x:-3,y:.6,z:0},{x:3,y:1.6,z:3.3});
  const hold={position:ped.position,heading:0};
  expect(scanToGrab(boxWorld([wall]),ped,'grab',true,hold)).toBe(wall);
  expect(scanToGrab(boxWorld([wall]),ped,'grab',false,{position:ped.position,heading:0})).toBeUndefined();
 });
 test('vehicles only take part in the stand-up and vault tests',()=>{
  const car=box({x:-3,y:.6,z:0},{x:3,y:1.6,z:2},0,'vehicle');
  expect(testForClimb(boxWorld([car]),ped,true)).toBeUndefined();
  expect(scanToGrab(boxWorld([car]),ped,'standUp',false,{position:ped.position,heading:0},{x:0,y:.2,z:1})).toBe(car);
 });
 test('GetClimbOffset3D runs along the heading',()=>{
  const o=climbOffset3D(CLIMB_OFFSETS.hanging,Math.PI/2);
  expect(o.x).toBeCloseTo(.4);expect(o.y).toBeCloseTo(0);expect(o.z).toBeCloseTo(-1.1);
 });
});

/** CWorld::Process order at the browser's 60 Hz: animation, ProcessPed, then the move speed. */
function run(world:ClimbWorld<Box>,task:NativeClimbTask<Box>,state:{position:V3;heading:number},jump:(t:number)=>boolean,seconds:number){
 const dt=1/60,clips:ClimbClip[]=[];let t=0;
 const moved={...state,moveSpeed:{x:0,y:0,z:0},isPlayer:true};
 for(;t<seconds&&!task.finished;t+=dt){
  task.updateAnim(dt);
  const done=task.process(moved,{jump:jump(t),jumpJustDown:false,exitVehicle:false},world,dt*50);
  if(task.anim&&clips[clips.length-1]!==task.anim.clip)clips.push(task.anim.clip);
  moved.position={x:moved.position.x+moved.moveSpeed.x*dt*50,y:moved.position.y+moved.moveSpeed.y*dt*50,z:moved.position.z+moved.moveSpeed.z*dt*50};
  if(done)break;
 }
 return {clips,t,ped:moved};
}
describe('CTaskSimpleClimb::ProcessPed',()=>{
 test('holding jump grabs, pulls up and stands on a three-unit wall',()=>{
  const wall=box({x:-3,y:.6,z:0},{x:3,y:1.6,z:3}),world=boxWorld([wall]);
  const found=testForClimb(world,ped,true);if(!found||found==='invalid')throw new Error('no hold');
  const height=initialClimbHeight(found.hold.position,ped.position,false);
  expect(height).toBe(CLIMB.GRAB);
  const task=new NativeClimbTask(found.entity,found.hold,height,false,DURATIONS);
  const result=run(world,task,ped,()=>true,5);
  expect(result.clips).toEqual(['CLIMB_jump','CLIMB_Pull','CLIMB_Stand','CLIMB_Stand_finish']);
  expect(task.finished&&task.standing).toBe(true);
  // CLIMB_FINISHED puts the feet on the top, 0.15 past the edge.
  expect(result.ped.position.z).toBeCloseTo(4,1);expect(result.ped.position.y).toBeGreaterThan(.7);
  expect(result.t).toBeGreaterThan(DURATIONS.CLIMB_jump+DURATIONS.CLIMB_Pull+DURATIONS.CLIMB_Stand-.1);
 });
 test('without jump held the ped hangs on CLIMB_idle',()=>{
  const wall=box({x:-3,y:.6,z:0},{x:3,y:1.6,z:3}),world=boxWorld([wall]);
  const found=testForClimb(world,ped,true);if(!found||found==='invalid')throw new Error('no hold');
  const task=new NativeClimbTask(found.entity,found.hold,CLIMB.GRAB,false,DURATIONS);
  const result=run(world,task,ped,t=>t<.3,3);
  expect(task.finished).toBe(false);expect(result.clips).toEqual(['CLIMB_jump','CLIMB_idle']);
  // Hanging: 0.4 back from the edge and 1.1 below it.
  expect(result.ped.position.z).toBeCloseTo(1.9,2);expect(result.ped.position.y).toBeCloseTo(.2,2);
  const resumed=run(world,task,result.ped,()=>true,4);
  expect(resumed.clips).toEqual(['CLIMB_idle','CLIMB_Pull','CLIMB_Stand','CLIMB_Stand_finish']);
 });
 test('a thin fence is vaulted and the ped drops on the far side',()=>{
  const fence=box({x:-3,y:.6,z:0},{x:3,y:.7,z:1.5}),world=boxWorld([fence]);
  const found=testForClimb(world,ped,true);if(!found||found==='invalid')throw new Error('no hold');
  const task=new NativeClimbTask(found.entity,found.hold,initialClimbHeight(found.hold.position,ped.position,false),false,DURATIONS);
  const result=run(world,task,ped,()=>true,4);
  expect(result.clips).toEqual(['CLIMB_Stand','CLIMB_jump_B','CLIMB_jump2fall']);
  expect(task.heightForPos).toBe(CLIMB.FINISHED_V);expect(task.standing).toBe(false);
  // CLIMB_FINISHED_V: 0.5 past the edge, falling at 0.05 units per frame.
  expect(result.ped.position.y).toBeGreaterThan(1.1);expect(result.ped.moveSpeed.z).toBeCloseTo(-.05);
 });
 test('the settle speed is bounded at 0.2, which the original 30 fps step never reaches, so a 60 Hz step lands no harder',()=>{
  const wall=box({x:-3,y:.6,z:0},{x:3,y:1.6,z:3}),world=boxWorld([wall]);
  const found=testForClimb(world,ped,true);if(!found||found==='invalid')throw new Error('no hold');
  // Hanging, 0.3 short of the hold offset: inside the settle branch (under 0.317).
  const task=new NativeClimbTask(found.entity,found.hold,CLIMB.GRAB,false,DURATIONS);
  const hang={x:found.hold.position.x+climbOffset3D(CLIMB_OFFSETS.hanging,0).x,y:found.hold.position.y+climbOffset3D(CLIMB_OFFSETS.hanging,0).y,z:found.hold.position.z+climbOffset3D(CLIMB_OFFSETS.hanging,0).z};
  const at60={position:{x:hang.x,y:hang.y,z:hang.z-.3},heading:0,moveSpeed:{x:0,y:0,z:0},isPlayer:true};
  task.updateAnim(1/60);task.process(at60,{jump:true,jumpJustDown:false,exitVehicle:false},world,50/60);
  expect(Math.hypot(at60.moveSpeed.x,at60.moveSpeed.y,at60.moveSpeed.z)).toBeCloseTo(.2,6);
  const at30task=new NativeClimbTask(found.entity,found.hold,CLIMB.GRAB,false,DURATIONS);
  const at30={position:{x:hang.x,y:hang.y,z:hang.z-.3},heading:0,moveSpeed:{x:0,y:0,z:0},isPlayer:true};
  at30task.updateAnim(1/30);at30task.process(at30,{jump:true,jumpJustDown:false,exitVehicle:false},world,50/30);
  expect(at30.moveSpeed.z).toBeCloseTo(.3/(50/30),6);
 });
 test('exit-vehicle drops the ped',()=>{
  const wall=box({x:-3,y:.6,z:0},{x:3,y:1.6,z:3}),world=boxWorld([wall]);
  const found=testForClimb(world,ped,true);if(!found||found==='invalid')throw new Error('no hold');
  const task=new NativeClimbTask(found.entity,found.hold,CLIMB.GRAB,false,DURATIONS);
  const state={position:{...ped.position},heading:0,moveSpeed:{x:0,y:0,z:0},isPlayer:true};
  task.updateAnim(1/60);task.process(state,{jump:false,jumpJustDown:false,exitVehicle:true},world,50/60);
  expect(task.finished).toBe(true);expect(task.invalid).toBe(false);expect(state.moveSpeed).toEqual({x:0,y:0,z:-.05});
 });
 test('camera target follows the pull from the hanging to the edge offset',()=>{
  const hold={position:{x:0,y:.6,z:3},heading:0};
  const task=new NativeClimbTask(box({x:0,y:0,z:0},{x:0,y:0,z:0}),hold,CLIMB.GRAB,false,DURATIONS);
  task.anim={clip:'CLIMB_Pull',time:DURATIONS.CLIMB_Pull/2,step:0,blend:1,delta:0,playing:true,speed:1};
  const target=task.cameraTarget({x:0,y:0,z:0});
  expect(target.y).toBeCloseTo(.2);expect(target.z).toBeCloseTo(3-.55);
 });
});
