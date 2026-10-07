import {test,expect} from 'vitest';
import {LANE_WIDTH,PATH_DIRECTION,findMaxSteerAngle,findPathDirection,findSpeedMultiplier,lanePoint,nextLaneOnLink,oneWayLaneOffset,pickNextNodeRandomly,
 shouldPickNextNode,slowCarDownForCars,slowCarDownForOtherCar,slowCarDownForPeds,standoffApplies,steerFollowPath,testFrontBumperCrossing,testFrontCornersEnterRect,carAIJam,tempActionPedals,makeWayForCarWithSiren,type NextCandidate,type TravelLink} from '../src/vehicle/nativeCarCtrl';

// A road running north (+y) with its link at the origin.
const north=(y=0,laneOffset=.5):TravelLink=>({position:{x:0,y},forward:{x:0,y:1},laneOffset});
const car=(x:number,y:number,speed=0,heading={x:0,y:1})=>({position:{x,y},forward:heading,moveSpeed:{x:heading.x*speed,y:heading.y*speed,z:0},forward3:{x:heading.x,y:heading.y,z:0}});

test('lanes sit to the right of travel: half a lane on two-way roads, spread about the line on one-way roads',()=>{
 expect(oneWayLaneOffset({sameLanes:1,oppositeLanes:1})).toBe(.5);
 // A two-way link's width (sixteenths) pushes its first lane out by the width over a 5.4 lane, read unsigned.
 expect(oneWayLaneOffset({sameLanes:1,oppositeLanes:1,width:4})).toBeCloseTo(.5+64/86.4,5);
 expect(oneWayLaneOffset({sameLanes:1,oppositeLanes:1,width:-1})).toBeCloseTo(.5+240/86.4,5);
 expect(oneWayLaneOffset({sameLanes:2,oppositeLanes:0})).toBe(-.5);
 expect(oneWayLaneOffset({sameLanes:0,oppositeLanes:3})).toBe(-1);
 expect(lanePoint(north(),0)).toEqual({x:LANE_WIDTH/2,y:0});
 expect(lanePoint(north(),1)).toEqual({x:LANE_WIDTH*1.5,y:0});
 // Travelling south, right is west.
 expect(lanePoint({position:{x:0,y:0},forward:{x:0,y:-1},laneOffset:.5},0).x).toBeCloseTo(-LANE_WIDTH/2);
});

test('FindMaxSteerAngle, FindSpeedMultiplier and FindPathDirection',()=>{
 expect([0,.3,.8].map(findMaxSteerAngle)).toEqual([.7,.6000000000000001,.2]);
 expect(findSpeedMultiplier(.3,.4,1.2,.4)).toBe(1);
 expect(findSpeedMultiplier(.8,.4,1.2,.4)).toBeCloseTo(.7);
 expect(findSpeedMultiplier(2,.4,1.2,.4)).toBe(.4);
 const prev={x:0,y:-10},cur={x:0,y:0};
 expect(findPathDirection(prev,cur,{x:0,y:10})).toBe(PATH_DIRECTION.STRAIGHT);
 expect(findPathDirection(prev,cur,{x:-10,y:0})).toBe(PATH_DIRECTION.LEFT);
 expect(findPathDirection(prev,cur,{x:10,y:0})).toBe(PATH_DIRECTION.RIGHT);
});

test('a car picks its next node near the lane point, or once past it',()=>{
 const current=north(0),next=north(30);
 expect(shouldPickNextNode(car(2.7,-20),current,0,next,0)).toBe(false);
 expect(shouldPickNextNode(car(2.7,-4),current,0,next,0)).toBe(true);
 expect(shouldPickNextNode(car(2.7,6),current,0,next,0)).toBe(true);
});

test('FollowPath steers towards the lane and cruises at the cruise speed on a straight road',()=>{
 const current=north(30),next=north(60);
 // Left of its lane: steer right (negative), capped at 0.7 while slow.
 const slow=steerFollowPath(car(-3,0),current,0,next,{cruiseSpeed:12,trafficSpeed:12,stop:false});
 expect(slow.swerve).toBeLessThan(0);expect(slow.accel).toBeCloseTo(1);expect(slow.brake).toBe(0);
 // At 0.2 units per frame (12 CarAI) in its lane: no correction and no pedal.
 const cruising=steerFollowPath(car(LANE_WIDTH/2,0,.2),current,0,next,{cruiseSpeed:12,trafficSpeed:12,stop:false});
 expect(Math.abs(cruising.swerve)).toBeLessThan(1e-9);expect(cruising.accel).toBeCloseTo(0);expect(cruising.brake).toBeCloseTo(0);
 // FindMaxSteerAngle alone limits it: 0.9 − 0.5 at 0.5 units per frame (iOS has no further 0.2 cap above 0.45).
 const fast=steerFollowPath(car(-8,0,.5),current,0,next,{cruiseSpeed:30,trafficSpeed:30,stop:false});
 expect(fast.swerve).toBeCloseTo(-.4);
 // Over speed, the brake is min(0.5, −difference / 12) (iOS 0x10019a584; Vice City's −difference × 0.05).
 const over=steerFollowPath(car(LANE_WIDTH/2,0,.3),current,0,next,{cruiseSpeed:12,trafficSpeed:6,stop:false});
 expect(over.accel).toBe(0);expect(over.brake).toBeCloseTo(Math.min(.5,(.3*60-6)/12),6);
 // A red light stops the car: a target of zero brakes fully.
 const red=steerFollowPath(car(LANE_WIDTH/2,0,.2),current,0,next,{cruiseSpeed:12,trafficSpeed:12,stop:true});
 expect(red.accel).toBe(0);expect(red.brake).toBe(1);
});

test('a turn onto the next link lowers the speed near the corner',()=>{
 const current=north(20),east:TravelLink={position:{x:20,y:30},forward:{x:1,y:0},laneOffset:.5};
 const far=steerFollowPath(car(LANE_WIDTH/2,-30,.2),current,0,east,{cruiseSpeed:12,trafficSpeed:12,stop:false});
 const near=steerFollowPath(car(LANE_WIDTH/2,15,.2),current,0,east,{cruiseSpeed:12,trafficSpeed:12,stop:false});
 expect(far.brake).toBeCloseTo(0);expect(near.brake).toBeGreaterThan(0);
});

const candidate=(x:number,y:number,o:Partial<NextCandidate<string>>={}):NextCandidate<string>=>({value:`${x},${y}`,node:{x,y},uTurn:false,deadEnd:false,switchedOff:false,lanes:1,oppositeLanes:1,...o});
test('PickNextNodeRandomly avoids U-turns, dead ends and wrong-way roads, and falls back to turning round',()=>{
 const base={previous:{x:0,y:-10},current:{x:0,y:0},lanesOnCurrent:1,onOneWayRoad:false,nextLane:0,previousDeadEnd:false,previousSwitchedOff:false};
 let draws=0;const cycle=(count:number)=>draws++%count;
 const back=candidate(0,-10,{uTurn:true}),dead=candidate(-10,0,{deadEnd:true}),wrongWay=candidate(10,0,{lanes:0}),ahead=candidate(0,10);
 expect(pickNextNodeRandomly({...base,candidates:[back,dead,wrongWay,ahead],random:cycle}).choice).toBe(ahead);
 draws=0;expect(pickNextNodeRandomly({...base,candidates:[back,dead],random:cycle}).choice).toBe(dead);
 const turned=pickNextNodeRandomly({...base,candidates:[back,wrongWay],random:cycle});
 expect(turned).toEqual({choice:back,uTurn:true});
 expect(nextLaneOnLink(0,2,20,true,true)).toBe(1);expect(nextLaneOnLink(0,2,10,true,true)).toBe(0);expect(nextLaneOnLink(1,1,20,false,false)).toBe(0);
 // bStayInSlowLane: the outermost lane whatever the draw; a link with no lanes keeps the lane.
 expect(nextLaneOnLink(0,3,20,true,false,true)).toBe(2);expect(nextLaneOnLink(2,2,5,false,false,true)).toBe(1);expect(nextLaneOnLink(1,0,20,false,false,true)).toBe(1);
});

test('the iOS moving-rect tests: corners across the front bumper, and the front corners into the other box',()=>{
 const rect=(x:number,y:number)=>({position:{x,y},front:2.4,back:2.4,halfWidth:1}),north={x:0,y:1};
 // A stopped car 8 ahead, half a unit over: its rear-left corner crosses the bumper 3.2 into the 12-unit closing.
 expect(testFrontBumperCrossing(rect(.5,8),rect(0,0),{x:0,y:-12},north,north)).toBeCloseTo(3.2/12);
 // Squarely ahead its corners run along the bumper's ends, which do not count; nor does a corner beside the car.
 expect(testFrontBumperCrossing(rect(0,8),rect(0,0),{x:0,y:-12},north,north)).toBe(1);
 expect(testFrontBumperCrossing(rect(3,0),rect(0,0),{x:-3,y:0},north,north)).toBe(1);
 // The front corners' slab test: the nose reaches the stopped car's tail 3.2 into the closing.
 expect(testFrontCornersEnterRect(rect(0,0),rect(0,8),{x:0,y:12},north,north)).toBeCloseTo(3.2/12);
 // Only the front corners are tested: backing onto a car behind, they reach its box 8 into the move, where Vice
 // City's rear corners would at 3.2.
 expect(testFrontCornersEnterRect(rect(0,0),rect(0,-8),{x:0,y:-12},north,north)).toBeCloseTo(8/12);
});

test('SlowCarDownForOtherCar crawls within 3 units of contact and stops within 1',()=>{
 const rect=(x:number,y:number)=>({position:{x,y},front:2.4,back:2.4,halfWidth:1});
 const car={...rect(0,0),forward:{x:0,y:1}},stopped=(x:number,y:number)=>({...rect(x,y),forward:{x:0,y:1},moveSpeed:{x:0,y:0}});
 const at8=slowCarDownForOtherCar(car,stopped(0,8),12,12)!;
 expect(at8.speed).toBeCloseTo((3.2/12-.2)*.7692308*12);expect(at8.proximity).toBeCloseTo((3.2/12-.2)*.7692308);
 expect(slowCarDownForOtherCar(car,stopped(0,6.5),12,12)!.speed).toBe(1);
 expect(slowCarDownForOtherCar(car,stopped(0,6.5),.5,12)!.speed).toBe(.5);
 expect(slowCarDownForOtherCar(car,stopped(0,5.5),12,12)!.speed).toBe(0);
 // With no contact projected any vehicle ahead still caps the speed at (1 − 0.2) / 1.3 of curSpeed; one behind is
 // no concern.
 expect(slowCarDownForOtherCar(car,stopped(6,8),12,12)!.speed).toBeCloseTo(.8/1.3*12);
 expect(slowCarDownForOtherCar(car,stopped(0,-8),12,12)).toBeUndefined();
});

test('SlowCarDownForCarsSectorList takes vehicles by their bound centre in the box and off the slope',()=>{
 const view=(x:number,y:number,z=0,cz=z)=>({position:{x,y,z},forward:{x:0,y:1,z:0},centre:{x,y,z:cz},moveSpeed:{x:0,y:0},front:2.4,back:2.4,halfWidth:1});
 const car=view(0,0);
 expect(slowCarDownForCars(car,[car,view(6,8)],12,12)).toEqual({speed:expect.closeTo(.8/1.3*12),honk:true});
 // Strictly inside ±14, under 10 above and 3 off the road's slope.
 expect(slowCarDownForCars(car,[view(0,14)],12,12)).toEqual({speed:12,honk:false});
 expect(slowCarDownForCars(car,[view(0,8,4)],12,12)).toEqual({speed:12,honk:false});
 const climbing={...car,forward:{x:0,y:.8,z:.6}};
 expect(slowCarDownForCars(climbing,[view(6,8,4)],12,12).honk).toBe(true);
 // The standoff hook sees each vehicle ahead.
 const seen:number[]=[];slowCarDownForCars(car,[view(6,8),view(0,-8)],12,12,(other,_p,speed)=>{seen.push(other.position.y);return speed;});
 expect(seen).toEqual([8]);
 expect(standoffApplies(.3,{now:20000,stillSince:4000,otherStillSince:0,forward:{x:0,y:1,z:0},otherForward:{x:0,y:-1,z:0}})).toBe(true);
 expect(standoffApplies(.3,{now:20000,stillSince:5000,otherStillSince:0,forward:{x:0,y:1,z:0},otherForward:{x:0,y:-1,z:0}})).toBe(false);
 expect(standoffApplies(.3,{now:20000,stillSince:0,otherStillSince:0,forward:{x:0,y:1,z:0},otherForward:{x:1,y:0,z:0}})).toBe(false);
 expect(standoffApplies(.5,{now:20000,stillSince:0,otherStillSince:0,forward:{x:0,y:1,z:0},otherForward:{x:0,y:-1,z:0}})).toBe(false);
});

test('a pedestrian ahead slows the car to no less than 1, makes it wait within 4 and brake within 2.5',()=>{
 const c={position:{x:0,y:0,z:0},forward:{x:0,y:1,z:0},right:{x:1,y:0,z:0},moveSpeed:{x:0,y:.2,z:0},front:2.4,halfWidth:1};
 const ped=(x:number,y:number,z=0)=>({x,y,z});
 expect(slowCarDownForPeds(c,[ped(0,8)],12,12)).toEqual({speed:expect.closeTo((8-2.4-1)/13*12),honk:true,action:undefined});
 expect(slowCarDownForPeds(c,[ped(0,6)],12,12)).toEqual({speed:expect.closeTo(2.6/13*12),honk:true,action:'wait'});
 expect(slowCarDownForPeds(c,[ped(0,4.5)],12,12)).toEqual({speed:expect.closeTo(1.1/13*12),honk:true,action:'brake'});
 expect(slowCarDownForPeds(c,[ped(0,3)],12,12)).toEqual({speed:1,honk:true,action:'brake'});
 // The last ped in range sets the action.
 expect(slowCarDownForPeds(c,[ped(0,4.5),ped(.5,6)],12,12).action).toBe('wait');
 // Off to the side, beyond 13, off the slope, passed over, or with the car stopped dead: no concern.
 for(const p of [ped(3,8),ped(0,30),ped(0,8,5),{...ped(0,8),ignored:true}])expect(slowCarDownForPeds(c,[p],12,12)).toEqual({speed:12,honk:false,action:undefined});
 expect(slowCarDownForPeds({...c,moveSpeed:{x:0,y:0,z:0}},[ped(0,4)],12,12).honk).toBe(false);
 expect(slowCarDownForPeds(c,[ped(0,8,2)],12,12).honk).toBe(true);
 // A bike's width grows 1.6 times for each ped due within 4 s, over the list.
 const bike={...c,bike:true};
 expect(slowCarDownForPeds(bike,[ped(3,8)],12,12).honk).toBe(false);
 expect(slowCarDownForPeds(bike,[ped(3,8),ped(3,9)],12,12).honk).toBe(true);
});

test('UpdateCarAI reverses a car jammed against something and turns it to AVOID_CARS',()=>{
 const base={moveSpeed2D:0,collisionAgeMs:0,seed:3,tempAction:false,timeToStartMission:0,timeSwitchedToRealPhysics:0};
 // 500 × (3 mod 16) + 40 = 1540 ms stuck while touching something.
 expect(carAIJam({...base,now:1500,previousNow:1480}).action).toBeUndefined();
 expect(carAIJam({...base,now:1600,previousNow:1580}).action).toEqual({ms:750,horn:true});
 // Waiting at a light touches nothing: the timer keeps restarting.
 expect(carAIJam({...base,now:5000,previousNow:4980,collisionAgeMs:2000}).action).toBeUndefined();
 // Moving faster than 0.05 units per frame restarts both timers.
 expect(carAIJam({...base,now:5000,previousNow:4980,moveSpeed2D:.06})).toMatchObject({timeToStartMission:5000,timeSwitchedToRealPhysics:5000,action:undefined});
 // One car in eight gives up after 30 s without moving.
 expect(carAIJam({...base,seed:8,collisionAgeMs:2000,now:30010,previousNow:29990}).action).toEqual({ms:400,horn:false});
 expect(carAIJam({...base,seed:9,collisionAgeMs:2000,now:30010,previousNow:29990}).action).toBeUndefined();
 // TEMPACT_REVERSE mirrors the steer and backs at half gas, braking first while rolling forward.
 expect(tempActionPedals('reverse',500,{follow:{swerve:.3,accel:1,brake:0,handbrake:false},forwardSpeed:0})).toEqual({swerve:-.3,accel:-.5,brake:0,handbrake:false});
 expect(tempActionPedals('reverse',500,{follow:{swerve:.3,accel:1,brake:0,handbrake:false},forwardSpeed:.1})).toMatchObject({accel:0,brake:.5});
});

test('MakeWayForCarWithSiren: fast cars ahead in its line swerve and stop, cars facing it or coming towards it wait',()=>{
 const siren={position:{x:0,y:0,z:0},moveSpeed:{x:0,y:.5}};
 const car=(x:number,y:number,forward:{x:number;y:number},speed:number)=>({position:{x,y,z:0},moveSpeed:{x:forward.x*speed,y:forward.y*speed},forward});
 expect(makeWayForCarWithSiren(car(0,20,{x:0,y:1},.3),siren)).toEqual({action:'swerveStop',ms:2500});
 // Too slow (0.2 units per frame is under √0.05), or too far (45 × 0.5 + 40 units).
 expect(makeWayForCarWithSiren(car(0,20,{x:0,y:1},.2),siren)).toBeUndefined();
 expect(makeWayForCarWithSiren(car(0,70,{x:0,y:1},.3),siren)).toBeUndefined();
 // Oncoming in its line: the flipped swerve becomes a wait.
 expect(makeWayForCarWithSiren(car(0,20,{x:0,y:-1},.3),siren)).toEqual({action:'wait',ms:2500});
 // Off its line and heading towards it.
 expect(makeWayForCarWithSiren(car(20,10,{x:-1,y:0},.3),siren)).toEqual({action:'wait',ms:2000});
 expect(makeWayForCarWithSiren({...car(0,20,{x:0,y:1},.3),current:'swerveStop'},siren)).toBeUndefined();
});

test('the 30 s rule\'s 400 ms reverse replaces the jam\'s 750 on the frame both fire, keeping its horn; a dying driver pulls the handbrake straight',()=>{
 const both=carAIJam({now:40000,previousNow:39990,moveSpeed2D:0,collisionAgeMs:0,seed:8,tempAction:false,timeToStartMission:0,timeSwitchedToRealPhysics:9995});
 expect(both.action).toEqual({ms:400,horn:true});
 expect(tempActionPedals('handbrakeStraight',1500)).toEqual({swerve:0,accel:0,brake:0,handbrake:true});
});
