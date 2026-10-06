import {expect,test} from 'vitest';
import {GROUP_MOVING_OFFSETS,GROUP_TELEPORT_OFFSETS} from '../src/simulation/groupFormation';

// CTaskComplexFollowLeaderInFormation::ms_offsets as the iOS static initialiser (0x1004366d4) fills them.
test('the formation offsets ring the leader a unit apart, and the moving ones trail behind him',()=>{
 expect(GROUP_TELEPORT_OFFSETS).toEqual([[-1,1],[1,1],[0,1],[-1,0],[1,0],[-1,-1],[0,-1],[1,-1]]);
 // Every teleport offset is a different cell of the 3 × 3 grid, the leader's own left out.
 expect(new Set(GROUP_TELEPORT_OFFSETS.map(o=>o.join())).size).toBe(8);expect(GROUP_TELEPORT_OFFSETS.some(([x,y])=>!x&&!y)).toBe(false);
 expect(GROUP_MOVING_OFFSETS).toEqual([[-1,0],[1,0],[0,-1.25],[-1.25,-1.25],[1.25,-1.25],[0,-2.5],[-1,-2.5],[1,-2.5]]);
});
