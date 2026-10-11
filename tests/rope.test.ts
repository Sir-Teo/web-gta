import {expect,test} from 'vitest';
import {CRANE_LAS_VEGAS,CRANE_MAGNO,CRANE_NONE} from '../src/engine/ScmPlayerInfo';
import {ROPE_CRANE_MAGNO,ROPE_CRANE_TROLLEY,ROPE_HEIGHT_MAX,ROPE_HEIGHT_MIN,ROPE_QUARRY_CRANE_ARM,ROPE_WRECKING_BALL,
 blendLoadMatrix,craneArmRope,findRopePickup,heightAfterPickup,registerRope,ropeHookModel,ropeLength,ropeLoadFactor,
 stepRopeNodes,tautRopeSpeeds,turnContainer,updateWeightInRope,windRope,type Rope,type RopeCandidate} from '../src/simulation/nativeRope';

const close=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number},digits=4)=>{expect(a.x).toBeCloseTo(b.x,digits);expect(a.y).toBeCloseTo(b.y,digits);expect(a.z).toBeCloseTo(b.z,digits);};
const dist=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const identity={right:{x:1,y:0,z:0},forward:{x:0,y:1,z:0},up:{x:0,y:0,z:1}};
const crane=(wound=16)=>{
 const ropes:(Rope<string>|undefined)[]=[];
 const rope=registerRope(ropes,7,ROPE_CRANE_MAGNO,{x:0,y:0,z:50},false,wound,true,'arm',false,20000,0)!;
 return {ropes,rope};
};

test('RegisterRope makes a crane rope 50 long hanging straight down, half wound, and moves an existing one\'s top',()=>{
 expect(ropeLength(ROPE_CRANE_MAGNO)).toBe(50);expect(ropeLength(ROPE_WRECKING_BALL)).toBe(68);expect(ropeLength(1)).toBe(20);
 expect(ropeHookModel(ROPE_CRANE_MAGNO)).toBe('INDUS_MAGNET');expect(ropeHookModel(ROPE_WRECKING_BALL)).toBe('DYN_WREKING_BALL');
 const {ropes,rope}=crane();
 expect(rope.height).toBe(.5);expect(rope.spacing).toBeCloseTo(50/31,6);
 close(rope.segments[31],{x:0,y:0,z:50-31*50/31});
 // A vehicle's winch starts nearly all wound up.
 expect(registerRope(ropes,8,1,{x:0,y:0,z:0},false,0,false,'heli',true,0,0)!.height).toBe(.9);
 // The same id again: the top and the wound nodes go to the new point.
 const again=registerRope(ropes,7,ROPE_CRANE_MAGNO,{x:5,y:0,z:50},false,3,true,'arm',false,20000,0)!;
 expect(again).toBe(rope);
 for(let i=0;i<=3;i++)close(rope.segments[i],{x:5,y:0,z:50});
 close(rope.segments[4],{x:0,y:0,z:50-4*rope.spacing});
 // Eight at most.
 for(let id=100;id<106;id++)registerRope(ropes,id,ROPE_CRANE_MAGNO,{x:0,y:0,z:0},false,0,false,'x',false,0,0);
 expect(registerRope(ropes,200,ROPE_CRANE_MAGNO,{x:0,y:0,z:0},false,0,false,'x',false,0,0)).toBeUndefined();
});

test('a crane arm\'s rope: the dock crane\'s point on its arm, the trolley\'s type by side, the top lifted by the wound remainder',()=>{
 const p={x:10,y:20,z:30};
 const dock=craneArmRope('MAGNOCRANE_03',p,identity,undefined)!;
 expect(dock.type).toBe(ROPE_CRANE_MAGNO);close(dock.top,{x:10,y:56.64,z:28.31});expect(dock.wound).toBe(0);
 expect(craneArmRope('TWRCRANE_M_02',{x:-2080,y:296,z:102},identity,undefined)!.type).toBe(ROPE_WRECKING_BALL);
 expect(craneArmRope('TWRCRANE_M_02',{x:2399,y:1899,z:73},identity,undefined)!.type).toBe(ROPE_CRANE_TROLLEY);
 close(craneArmRope('QUARRY_CRANEARM',p,identity,undefined)!.top,{x:10,y:20,z:89});
 expect(craneArmRope('LODNOCRANE_03',p,identity,undefined)).toBeUndefined();
 // Height 0.7 of a 50 rope: 22 nodes wound (22.4 of 32), the top lifted by 35 - 22 x 50/31.
 const wound=craneArmRope('MAGNOCRANE_03',p,identity,{height:.7,length:50,spacing:50/31})!;
 expect(wound.wound).toBe(22);expect(wound.top.z).toBeCloseTo(28.31+35-22*50/31,4);
});

test('the hanging nodes keep a spacing apart and above the ground under the top',()=>{
 const {rope}=crane();
 rope.segments[31]={x:3,y:0,z:0};
 stepRopeNodes(rope,1,0,2,{below:()=>10});
 expect(rope.groundZ).toBe(10);
 for(let i=rope.wound+1;i<32;i++){
  expect(dist(rope.segments[i],rope.segments[i-1])).toBeCloseTo(rope.spacing,4);
  expect(rope.segments[i].z).toBeGreaterThanOrEqual(10.3-1e-4-rope.spacing);
 }
});

test('UpdateWeightInRope: out of reach the body is held at the end of the straight rope; within it the slack is solved',()=>{
 const {rope}=crane(16);
 const top=rope.segments[16],reach=15*rope.spacing;
 const out=updateWeightInRope(rope,{x:0,y:0,z:top.z-reach-5},1)!;
 close(out,{x:0,y:0,z:top.z-reach});
 for(let i=17;i<32;i++)close(rope.segments[i],{x:0,y:0,z:top.z-(i-16)*rope.spacing});
 const {rope:slack}=crane(16);
 const end={x:4,y:0,z:slack.segments[16].z-10};
 expect(updateWeightInRope(slack,end,1)).toBeUndefined();
 close(slack.segments[31],end);
 for(let i=18;i<32;i++)expect(dist(slack.segments[i],slack.segments[i-1])).toBeLessThanOrEqual(slack.spacing+1e-4);
});

test('the crane\'s buttons wind the rope only while the player works that crane and the script allows it',()=>{
 const {rope}=crane();
 const enable=[true,true,true] as const;
 expect(windRope(rope,1,{playerControlsCrane:CRANE_NONE,enable,raise:255,lower:0})).toBe(false);
 expect(rope.height).toBe(.5);
 expect(windRope(rope,1,{playerControlsCrane:CRANE_MAGNO,enable,raise:255,lower:0})).toBe(true);
 expect(rope.height).toBeCloseTo(.50255,6);
 windRope(rope,1,{playerControlsCrane:CRANE_MAGNO,enable:[false,true,true],raise:255,lower:0});
 expect(rope.height).toBeCloseTo(.50255,6);
 windRope(rope,1000,{playerControlsCrane:CRANE_MAGNO,enable,raise:0,lower:255});
 expect(rope.height).toBe(ROPE_HEIGHT_MIN);
 // The Las Venturas crane's controls do not move the dock crane's rope.
 rope.height=2;windRope(rope,1,{playerControlsCrane:CRANE_LAS_VEGAS,enable,raise:255,lower:0});
 expect(rope.height).toBe(ROPE_HEIGHT_MAX);
});

test('a taut rope takes off the speed away from the top, the holder giving up its share',()=>{
 const r=tautRopeSpeeds({x:1,y:0,z:-2},{x:0,y:0,z:0},{x:0,y:0,z:-1},.06);
 close(r.body,{x:1,y:0,z:-2+2*.94});close(r.holder,{x:0,y:0,z:-2*.06});
 // Toward the top it is left alone.
 close(tautRopeSpeeds({x:0,y:0,z:1},{x:0,y:0,z:0},{x:0,y:0,z:-1},.06).body,{x:0,y:0,z:1});
 expect(ropeLoadFactor(undefined)).toBe(.06);
 expect(ropeLoadFactor({mass:1000,model:'X'})).toBeCloseTo(.168333,5);
 expect(ropeLoadFactor({mass:10000,model:'X'})).toBe(.5);
 expect(ropeLoadFactor({mass:7000,model:428})).toBe(.14125);
 // A tenth of the way to hanging along the rope.
 const m=blendLoadMatrix(identity,{x:1,y:0,z:0});
 expect(m.up.x).toBeCloseTo(.1,5);expect(m.up.z).toBeCloseTo(.9,5);
});

const object=(o:Partial<RopeCandidate<string>>):RopeCandidate<string>=>({entity:'o',kind:'object',model:'KMB_CONTAINER_RED',position:{x:0,y:0,z:0},matrix:identity,top:1.5,magnetic:true,...o});
test('the hook takes what it may within 2.5 of the top of its bounds; a container by its uppermost face',()=>{
 const hook={x:0,y:0,z:3};
 expect(findRopePickup(ROPE_CRANE_MAGNO,hook,[object({})])?.candidate.entity).toBe('o');
 expect(findRopePickup(ROPE_CRANE_MAGNO,{x:0,y:0,z:4.1},[object({})])).toBeUndefined();
 expect(findRopePickup(ROPE_CRANE_MAGNO,hook,[object({magnetic:false})])).toBeUndefined();
 expect(findRopePickup(ROPE_CRANE_TROLLEY,hook,[object({})])).toBeUndefined();
 expect(findRopePickup(ROPE_CRANE_TROLLEY,hook,[object({model:'blockpallet'})])).toBeDefined();
 // On its side (right pointing up): taken by that face, turned three quarters.
 const side={right:{x:0,y:0,z:1},forward:{x:0,y:1,z:0},up:{x:-1,y:0,z:0}};
 const taken=findRopePickup(ROPE_CRANE_MAGNO,hook,[object({matrix:side})])!;
 expect(taken.turns).toBe(3);close(taken.point,{x:0,y:0,z:1.5});
 close(turnContainer(side,3).up,{x:0,y:0,z:1});
 // A vehicle only once a script lets the winch take it; the quarry's rocks need their own crane.
 const car:RopeCandidate<string>={entity:'car',kind:'vehicle',model:400,position:{x:0,y:0,z:0},matrix:identity,top:1,vehicleType:0};
 expect(findRopePickup(ROPE_CRANE_MAGNO,hook,[car])).toBeUndefined();
 expect(findRopePickup(ROPE_CRANE_MAGNO,hook,[{...car,winchCanPickUp:true}])?.candidate.entity).toBe('car');
 expect(findRopePickup(ROPE_QUARRY_CRANE_ARM,hook,[object({model:'DYN_QUARRYROCK02'})])).toBeDefined();
 // A hook above the load lets out what reaches it and a spacing more.
 expect(heightAfterPickup(.5,10,5,50,50/31)).toBeCloseTo(.5-5/50-1/31,6);
 expect(heightAfterPickup(.5,4,5,50,50/31)).toBe(.5);
});

test('a helicopter\'s winch winds by its stick, down with the first flag and up with the second, no further than 0.84',()=>{
 const ropes:(Rope<string>|undefined)[]=[];
 const rope=registerRope(ropes,1,1,{x:0,y:0,z:50},false,0,true,'heli',true,20000,0)!;
 const enable=[true,true,true] as const;
 // Any crane worked or none, the winch takes its stick.
 windRope(rope,1,{playerControlsCrane:CRANE_NONE,enable,raise:0,lower:0,stick:0});
 expect(rope.height).toBeCloseTo(.84,6);
 windRope(rope,10,{playerControlsCrane:CRANE_NONE,enable,raise:0,lower:0,stick:128});
 expect(rope.height).toBeCloseTo(.84-.0128,6);
 windRope(rope,10,{playerControlsCrane:CRANE_NONE,enable:[true,false,true],raise:0,lower:0,stick:128});
 expect(rope.height).toBeCloseTo(.84-.0128,6);
 windRope(rope,10,{playerControlsCrane:CRANE_NONE,enable,raise:0,lower:0,stick:-128});
 expect(rope.height).toBeCloseTo(.84,6);
});
