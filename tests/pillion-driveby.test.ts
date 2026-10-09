import {expect,test} from 'vitest';
import {pillionDriveByClip} from '../src/simulation/scriptDriveBy';

// CTaskSimpleGangDriveBy (iOS 0x1003b7830): headings are atan2(-x, y), so a positive turn is to the left.
test('the pillion leans to the quarter the target is in',()=>{
 expect(pillionDriveByClip(0,0)).toBe('pass_driveby_fwd');
 expect(pillionDriveByClip(0,Math.PI/2)).toBe('pass_driveby_lhs');
 expect(pillionDriveByClip(0,Math.PI)).toBe('pass_driveby_bwd');
 expect(pillionDriveByClip(0,-Math.PI/2)).toBe('pass_driveby_rhs');
 // The quarters meet an eighth either side of ahead, wrapping round.
 expect(pillionDriveByClip(3,3+Math.PI/4-.01)).toBe('pass_driveby_fwd');
 expect(pillionDriveByClip(3,3+Math.PI/4+.01)).toBe('pass_driveby_lhs');
 expect(pillionDriveByClip(-3,3)).toBe('pass_driveby_fwd');
 expect(pillionDriveByClip(3,3-Math.PI/2)).toBe('pass_driveby_rhs');
});
