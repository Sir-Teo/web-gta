import {expect,test} from 'vitest';
import {ScriptCarMissions,scriptTempActionPedals} from '../src/simulation/ScriptCarMissions';
import type {WorldCar} from '../src/simulation/WorldCar';

/** A car at a renderer point facing native north (-z), at rest. */
function car(x:number,z:number){
 const at={x,y:0,z};
 const c={disposed:false,wrecked:false,occupied:false,autopilot:undefined as unknown,
  car:{body:{translation:()=>at,rotation:()=>({x:0,y:0,z:0,w:1}),linvel:()=>({x:0,y:0,z:-5})}}};
 return {car:c as unknown as WorldCar,at,raw:c};
}

test('with no road route the car drives straight at the point and stops inside 3 units',()=>{
 const missions=new ScriptCarMissions(()=>undefined),{car:c,at,raw}=car(0,0);
 missions.gotoCoords(c,{x:0,y:0,z:-50},{cruise:20,style:0});
 expect(missions.mission(c)).toBe('gotoCoordsStraight');expect(missions.driving(c)).toBe(true);
 missions.step(1/50);
 const drive=raw.autopilot as {native:{gas:number;steerAngle:number}};
 expect(drive.native.gas).toBeGreaterThan(0);expect(Math.abs(drive.native.steerAngle)).toBeLessThan(.01);
 at.z=-47.5;missions.step(1/50);
 expect(missions.mission(c)).toBe('none');expect(missions.driving(c)).toBe(false);
 expect(raw.autopilot).toEqual({steering:0,throttle:0,brake:0,handbrake:false,native:{steerAngle:0,gas:0,brake:.5,handbrake:true}});
});

test('the accurate mission only clears inside 1 unit',()=>{
 const missions=new ScriptCarMissions(()=>undefined),{car:c,at}=car(0,0);
 missions.gotoCoords(c,{x:0,y:0,z:-50},{cruise:20,style:0,accurate:true});
 expect(missions.mission(c)).toBe('gotoCoordsStraightAccurate');
 at.z=-47.5;missions.step(1/50);expect(missions.mission(c)).toBe('gotoCoordsStraightAccurate');
 at.z=-49.5;missions.step(1/50);expect(missions.mission(c)).toBe('none');
});

test('a wrecked, taken or removed car drops its mission',()=>{
 const missions=new ScriptCarMissions(()=>undefined),{car:c,raw}=car(0,0);
 missions.gotoCoords(c,{x:0,y:0,z:-50},{cruise:20,style:0});
 raw.occupied=true;missions.step(1/50);expect(missions.driving(c)).toBe(false);
 missions.gotoCoords(c,{x:0,y:0,z:-50},{cruise:20,style:0});raw.occupied=false;raw.disposed=true;missions.step(1/50);
 expect(missions.mission(c)).toBeUndefined();
});

test('a temporary action runs for its time over the mission, then the mission (or the brakes) comes back',()=>{
 const missions=new ScriptCarMissions(()=>undefined),{car:c,raw}=car(0,0);
 missions.tempAction(c,6,.1);
 expect(missions.inTempAction(c)).toBe(true);
 missions.step(.05);
 expect(raw.autopilot).toMatchObject({native:{steerAngle:0,gas:0,brake:0,handbrake:true}});
 missions.step(.06);expect(missions.inTempAction(c)).toBe(false);
 missions.step(.02);expect(raw.autopilot).toEqual({steering:0,throttle:0,brake:0,handbrake:false,native:{steerAngle:0,gas:0,brake:.5,handbrake:true}});
});

test('the temporary actions the scripts use',()=>{
 expect(scriptTempActionPedals(9,0,{forwardSpeed:0})).toEqual({swerve:0,accel:.5,brake:0,handbrake:false});
 expect(scriptTempActionPedals(7,0,{forwardSpeed:0})).toEqual({swerve:1,accel:1,brake:0,handbrake:false});
 expect(scriptTempActionPedals(4,0,{forwardSpeed:0})).toEqual({swerve:1,accel:0,brake:0,handbrake:true});
 // Reversing brakes first while the car still rolls forward.
 expect(scriptTempActionPedals(22,0,{forwardSpeed:.1})).toEqual({swerve:0,accel:0,brake:.5,handbrake:false});
 expect(scriptTempActionPedals(14,0,{forwardSpeed:0})).toEqual({swerve:-1,accel:-.5,brake:0,handbrake:false});
 expect(scriptTempActionPedals(99,0,{forwardSpeed:0})).toBeUndefined();
});

/** A car with a body's bounds, for the missions that read its size. */
function sized(x:number,z:number,velocity={x:0,y:0,z:0}){
 const made=car(x,z);
 Object.assign(made.raw,{nativeBody:{boundsMax:{x:1,y:2.5,z:1},boundsMin:{x:-1,y:-2.5,z:-1}}});
 made.raw.car.body.linvel=()=>velocity;
 return made;
}

test('TASK_CAR_MISSION’s numbers name the eCarMission kinds, and the escorts their sides',async()=>{
 const {CAR_MISSION,escortSide}=await import('../src/simulation/ScriptCarMissions');
 expect([CAR_MISSION[2],CAR_MISSION[4],CAR_MISSION[17],CAR_MISSION[29],CAR_MISSION[11]]).toEqual(['ramPlayerFar','blockPlayerFar','blockCarFar','escort','stopForever']);
 expect([29,30,31,32].map(escortSide)).toEqual(['left','right','rear','front']);
 expect(CAR_MISSION[20]).toBeUndefined();
});

test('the block aims where the target will be, its speed counted up to 0.13 a frame',async()=>{
 const {blockTargetPoint}=await import('../src/simulation/ScriptCarMissions');
 expect(blockTargetPoint({x:0,y:0},{x:.1,y:0})).toEqual({x:6,y:0});
 const fast=blockTargetPoint({x:0,y:0},{x:.26,y:0});expect(fast.x).toBeCloseTo(7.8,6);
});

test('the escort stations beside, behind or ahead of the car it escorts',async()=>{
 const {escortStation}=await import('../src/simulation/ScriptCarMissions');
 const target={position:{x:0,y:0},forward:{x:0,y:1},halfWidth:1,halfLength:2.5},own={halfWidth:1,halfLength:2.5};
 const at=(side:'left'|'right'|'rear'|'front')=>{const p=escortStation(side,target,own);return {x:p.x+0,y:p.y+0};};
 expect(at('left')).toEqual({x:-4,y:0});expect(at('right')).toEqual({x:4,y:0});
 expect(at('rear')).toEqual({x:0,y:-9});expect(at('front')).toEqual({x:0,y:9});
});

test('a ram on the player closes in within the straight-line distance, and a block stops in front of a target car',()=>{
 const missions=new ScriptCarMissions(()=>undefined),{car:c}=sized(0,0);
 missions.player=()=>({position:{x:0,y:0,z:-100},velocity:{x:0,y:0,z:0}});
 expect(missions.carMission(c,{mission:2,cruise:30,style:2})).toBe(true);
 missions.step(1/50);expect(missions.mission(c)).toBe('ramPlayerFar');
 missions.player=()=>({position:{x:0,y:0,z:-15},velocity:{x:0,y:0,z:0}});
 missions.step(1/50);expect(missions.mission(c)).toBe('ramPlayerClose');
 // A car mission needs its target car.
 const other=sized(0,-8),blocker=sized(0,0);
 expect(missions.carMission(blocker.car,{mission:17,cruise:30,style:2})).toBe(false);
 expect(missions.carMission(blocker.car,{mission:17,target:other.car,cruise:30,style:2})).toBe(true);
 missions.step(1/50);expect(missions.mission(blocker.car)).toBe('blockCarClose');
 // Inside 5 units of where the target will be it holds the handbrake; past 10 it blocks again.
 other.at.z=-4;missions.step(1/50);expect(missions.mission(blocker.car)).toBe('blockCarStop');
 other.at.z=-12;missions.step(1/50);expect(missions.mission(blocker.car)).toBe('blockCarClose');
 // The target gone, the mission ends.
 other.raw.disposed=true;missions.step(1/50);expect(missions.mission(blocker.car)).toBe('none');
});

test('an escort holds the escorted car’s speed and closes the gap to its station',()=>{
 const missions=new ScriptCarMissions(()=>undefined);
 const leader=sized(0,-20,{x:0,y:0,z:-10}),escort=sized(0,0);
 missions.player=()=>({position:{x:0,y:0,z:-20},velocity:{x:0,y:0,z:0}});
 expect(missions.carMission(escort.car,{mission:31,target:leader.car,cruise:40,style:2})).toBe(true);
 missions.step(1/50);
 expect(missions.mission(escort.car)).toBe('escort');
 // Behind its station (9 units behind the leader, at z=-11), it drives on.
 const drive=escort.raw.autopilot as {native:{gas:number;brake:number}};
 expect(drive.native.gas).toBeGreaterThan(0);
 // Eight units past the station (the leader's 12 less twice the gap) it lets the leader draw ahead.
 escort.at.z=-19;missions.step(1/50);
 expect((escort.raw.autopilot as {native:{gas:number;brake:number}}).native.gas).toBe(0);
});

test('a car that makes no headway through every recovery is set down on its route, out of the player\'s sight',()=>{
 const player={position:{x:0,y:0,z:200},velocity:{x:0,y:0,z:0}};
 const missions=new ScriptCarMissions(()=>undefined),{car:c,raw}=car(0,0);missions.player=()=>player as never;
 let at={x:0,y:0,z:0},rotation={x:0,y:0,z:0,w:1};
 raw.car.body={translation:()=>at,rotation:()=>rotation,linvel:()=>({x:0,y:0,z:0}),setTranslation:(p:any)=>{at={...p};},setRotation:(q:any)=>{rotation={...q};},setLinvel(){},setAngvel(){}} as never;
 missions.gotoCoords(c,{x:0,y:0,z:-500},{cruise:20,style:0});
 const m=(missions as any).missions.get(c);
 // A route link running native north from (0,20) to (0,40).
 const link={from:{position:[0,20,5]},to:{position:[0,40,5]},navigation:{position:[0,30],direction:[0,1],sameLanes:1,oppositeLanes:1},start:{x:0,z:-20},end:{x:0,z:-40},length:20,dx:0,dz:-20};
 m.kind='gotoCoords';m.link=link;m.route=[];
 for(let i=0;i<50*7;i++)missions.step(1/50);
 expect(at).toEqual({x:0,y:0,z:0});
 for(let i=0;i<50*2;i++)missions.step(1/50);
 // On the link's lane point, a unit over the road, facing along it.
 expect(at.y).toBe(6);expect(Math.abs(at.z+30)).toBeLessThan(.01);
 expect((missions as any).unstuck).toBe(1);
 // Within sight of the player it waits.
 player.position={x:0,y:0,z:-5};at={x:0,y:0,z:0};
 for(let i=0;i<50*10;i++)missions.step(1/50);
 expect((missions as any).unstuck).toBe(1);
 // Out of sight but with no collision streamed in under the lane point, it waits too; with some, it is set on it.
 player.position={x:0,y:0,z:200};at={x:0,y:0,z:0};m.link=link;m.route=[];
 const asked:number[]=[];missions.ground=(_x,_z,from)=>{asked.push(from);return undefined;};
 for(let i=0;i<50*10;i++)missions.step(1/50);
 expect((missions as any).unstuck).toBe(1);expect(asked[0]).toBe(9);
 missions.ground=()=>7.5;
 for(let i=0;i<50*10;i++)missions.step(1/50);
 expect((missions as any).unstuck).toBe(2);expect(at.y).toBe(8.5);
});

test('under the stop-for-cars styles a script car slows for a car stopped ahead; avoiding cars it does not',()=>{
 const missions=new ScriptCarMissions(()=>undefined),{car:c}=car(0,0),rect={front:2.4,back:2.4,halfWidth:1,forward:{x:0,y:1,z:0},moveSpeed:{x:0,y:0}};
 const at=(x:number,y:number)=>({position:{x,y,z:0},centre:{x,y,z:0},...rect});
 const stopped={vehicle:{},...at(0,8)};
 missions.traffic=()=>[{vehicle:c,...at(0,0)},stopped];
 const speed=(missions as unknown as {trafficSpeed(car:unknown,cruise:number,slowDown:boolean):number}).trafficSpeed.bind(missions);
 expect(speed(c,20,false)).toBeLessThan(20);
 // SLOW_DOWN_FOR_CARS averages the limit with the cruise speed.
 expect(speed(c,20,true)).toBeCloseTo((speed(c,20,false)+20)/2);
 // Behind it, or with no traffic list, the cruise speed stands.
 missions.traffic=()=>[{vehicle:c,...at(0,0)},{...stopped,...at(0,-8)}];
 expect(speed(c,20,false)).toBe(20);
 missions.traffic=undefined;expect(speed(c,20,false)).toBe(20);
});
