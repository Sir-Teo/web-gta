import {describe,expect,test} from 'vitest';
import {DOOR,MODEL_FLAG,NativeDoor,createCarDoors,type CarAxes} from '../src/simulation/nativeDoor';
import {NativeBouncingPanel} from '../src/simulation/nativeBouncingPanel';
const upright:CarAxes={right:[1,0,0],forward:[0,1,0],up:[0,0,1]};
describe('CDoor',()=>{
 test('CAutomobile::SetupModelNodes opening angles follow the handling model flags',()=>{
  const car=createCarDoors(0);expect(car[DOOR.leftFront].openAngle).toBeCloseTo(-.4*Math.PI);expect(car[DOOR.rightFront].openAngle).toBeCloseTo(.4*Math.PI);
  expect(car[DOOR.bonnet]).toMatchObject({axis:0,dirn:0x21});expect(car[DOOR.boot].openAngle).toBeCloseTo(-.3*Math.PI);
  const bus=createCarDoors(MODEL_FLAG.bus);expect(bus[DOOR.leftFront].openAngle).toBeCloseTo(-Math.PI/2);
  const van=createCarDoors(MODEL_FLAG.van|MODEL_FLAG.tailgateBoot);expect(van[DOOR.leftRear]).toMatchObject({dirn:0x10,axis:2});expect(van[DOOR.rightRear].openAngle).toBeCloseTo(Math.PI/2);expect(van[DOOR.boot].openAngle).toBeCloseTo(Math.PI/2);
  expect(createCarDoors(MODEL_FLAG.hangingBoot)[DOOR.boot].dirn).toBe(0x15);expect(createCarDoors(MODEL_FLAG.reverseBonnet)[DOOR.bonnet].openAngle).toBeCloseTo(-.3*Math.PI);
 });
 test('Open, GetAngleOpenRatio, IsClosed and IsFullyOpen',()=>{
  const door=createCarDoors(0)[DOOR.leftFront];door.open(.5);expect(door.ratio).toBeCloseTo(.5);expect(door.closed).toBe(false);expect(door.fullyOpen).toBe(false);
  door.open(.61);expect(door.fullyOpen).toBe(true);door.angVel=.2;door.open(0);expect(door.closed).toBe(true);expect(door.angVel).toBe(0);door.open(3);expect(door.angle).toBeCloseTo(-.4*Math.PI);expect(door.hitOpenStop).toBe(true);
 });
 test('a side door on a resting car does not drift, and forward acceleration swings an open door shut',()=>{
  const still=createCarDoors(0)[DOOR.leftFront];still.open(.5);const angle=still.angle;for(let i=0;i<100;i++)still.process([0,0,0],upright,1);expect(still.angle).toBe(angle);
  const door=createCarDoors(0)[DOOR.leftFront];door.open(.8);let slammed=false,steps=0;
  for(;steps<200&&!slammed;steps++)slammed=door.process([0,.02,0],upright,1);
  expect(slammed).toBe(true);expect(door.closed).toBe(true);expect(door.angVel).toBe(0);
  // Braking hard flings it back open against the stop, which bounces at -0.8.
  const braking=createCarDoors(0)[DOOR.rightFront];braking.open(.2);for(let i=0;i<40;i++)braking.process([0,-.05,0],upright,1);expect(braking.angle).toBeGreaterThan(.2*.4*Math.PI);
 });
 test('an unlatched bonnet falls closed under low gravity and bounces rather than slamming',()=>{
  // Fully open, the 0.0016 gravity torque stays under DOOR_SPEED_MIN_LIMIT, so a resting bonnet stays up.
  const resting=createCarDoors(0)[DOOR.bonnet];resting.open(1);resting.process([0,0,0],upright,1);expect(resting.angle).toBeCloseTo(.3*Math.PI);
  const bonnet=createCarDoors(0)[DOOR.bonnet];bonnet.open(.5);let slammed=false,bounced=false;
  for(let i=0;i<200;i++){slammed||=bonnet.process([0,0,0],upright,1);if(bonnet.closed)bounced=true;}
  expect(slammed).toBe(false);expect(bounced).toBe(true);expect(bonnet.angle).toBeLessThan(.3*Math.PI);
 });
 test('rate-independent integration keeps the same outcome at 60 Hz steps',()=>{
  const a=new NativeDoor(-.4*Math.PI,0,0x14,2),b=new NativeDoor(-.4*Math.PI,0,0x14,2);a.open(.8);b.open(.8);
  for(let i=0;i<50;i++)a.process([0,.004,0],upright,1);for(let i=0;i<60;i++)b.process([0,.004*50/60,0],upright,50/60);
  expect(b.angle).toBeCloseTo(a.angle,1);
 });
 test('ProcessImpact pops a closed door open beyond 0.1 × U(0.75, 1.5) about its hinge',()=>{
  const door=createCarDoors(0)[DOOR.leftFront];
  expect(door.processImpact([.05,0,0],upright,()=>0)).toBe(false);expect(door.processImpact([-.2,0,0],upright,()=>1)).toBe(false);expect(door.processImpact([.2,0,0],upright,()=>1)).toBe(true);expect(door.processImpact([0,-.2,0],upright,()=>1)).toBe(false);
 });
});
test('CBouncingPanel sways with velocity changes and springs back',()=>{
 const panel=new NativeBouncingPanel('bump_front_dummy',0,-.35);const first=panel.process([0,.08,.05],1);
 expect(first).toEqual([[0,1,expect.any(Number)],[0,2,expect.any(Number)]]);expect(first[0][2]).not.toBe(0);
 let last=first;for(let i=0;i<400;i++)last=panel.process([0,0,0],1);expect(Math.abs(last[0][2])).toBeLessThan(1e-3);expect(Math.abs(last[1][2])).toBeLessThan(1e-3);
});
