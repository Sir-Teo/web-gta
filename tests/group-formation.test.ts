import {expect,test} from 'vitest';
import {GROUP_DISBAND_HOLD_MS,GROUP_MOVING_OFFSETS,GROUP_TELEPORT_OFFSETS,gangFollowerGait,gangFollowerOffset,stepGroupButtonHold,type GangFollowerState} from '../src/simulation/groupFormation';

// CTaskComplexFollowLeaderInFormation::ms_offsets as the iOS static initialiser (0x1004366d4) fills them.
test('the formation offsets ring the leader a unit apart, and the moving ones trail behind him',()=>{
 expect(GROUP_TELEPORT_OFFSETS).toEqual([[-1,1],[1,1],[0,1],[-1,0],[1,0],[-1,-1],[0,-1],[1,-1]]);
 // Every teleport offset is a different cell of the 3 × 3 grid, the leader's own left out.
 expect(new Set(GROUP_TELEPORT_OFFSETS.map(o=>o.join())).size).toBe(8);expect(GROUP_TELEPORT_OFFSETS.some(([x,y])=>!x&&!y)).toBe(false);
 expect(GROUP_MOVING_OFFSETS).toEqual([[-1,0],[1,0],[0,-1.25],[-1.25,-1.25],[1.25,-1.25],[0,-2.5],[-1,-2.5],[1,-2.5]]);
});

// CTaskComplexGangFollower::CalculateOffsetPosition (iOS 0x1003fb0d0).
test('a follower walks beside or behind a moving leader, and keeps a world-axis spot by a still one until he moves 3 units',()=>{
 const state:GangFollowerState={offset:{x:0,y:0},latched:false};
 // Heading east: his right is south, his forward east. Slot 0 walks a unit to his left (north), slot 2 1.25 behind.
 const east={position:{x:0,y:0,z:0},right:{x:0,y:-1},forward:{x:1,y:0},moving:true};
 expect(gangFollowerOffset(0,east,state)).toEqual({x:0,y:1});
 const behind=gangFollowerOffset(2,east,{offset:{x:0,y:0},latched:false});expect(behind.x).toBe(-1.25);expect(behind.y).toBeCloseTo(0,9);
 // Standing: Offsets[slot] in world axes, whatever his heading, latched where he stood.
 const still={...east,moving:false};
 expect(gangFollowerOffset(0,still,state)).toEqual({x:-1,y:1});expect(state.latched).toBe(true);
 state.offset={x:5,y:5};
 expect(gangFollowerOffset(0,{...still,position:{x:2,y:2,z:0}},state)).toEqual({x:5,y:5});
 expect(gangFollowerOffset(0,{...still,position:{x:3,y:0,z:1}},state)).toEqual({x:-1,y:1});
});

test('the follower walks under 5 units from its spot, runs under 10, sprints beyond, and is there within 0.5',()=>{
 expect([.5,.6,4.9,5,9.9,10].map(gangFollowerGait)).toEqual(['arrived','walk','walk','run','run','sprint']);
});

test('a group button held 1.2 s with a group to command disbands it once; letting go or targeting someone starts over',()=>{
 expect(GROUP_DISBAND_HOLD_MS).toBe(1200);
 // 30 fps: 33 whole milliseconds a frame, so the 37th frame reaches 1221.
 let count=0,disbands=0,frames=0;
 for(;frames<60;frames++){const r=stepGroupButtonHold(count,true,true,1000/30);count=r.count;if(r.disband){disbands++;if(disbands===1)expect(frames+1).toBe(37);}}
 expect(disbands).toBe(1);expect(count).toBe(60*33);
 expect(stepGroupButtonHold(1100,false,true,33)).toEqual({count:0,disband:false});
 expect(stepGroupButtonHold(1100,true,false,33)).toEqual({count:0,disband:false});
 expect(stepGroupButtonHold(1199,true,true,1)).toEqual({count:1200,disband:true});
});
