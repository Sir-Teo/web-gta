import {expect,test} from 'vitest';
import {everyoneLeaveCarDelay} from '../src/simulation/ScmMission';

test('TASK_EVERYONE_LEAVE_CAR staggers the passengers: 250 + 500 a seat and up to 500 more (iOS 0x1001ef31c)',()=>{
 expect(everyoneLeaveCarDelay('driver',()=>0xffff)).toBe(0);
 expect(everyoneLeaveCarDelay(0,()=>0)).toBe(250);
 expect(everyoneLeaveCarDelay(1,()=>0x8000)).toBe(1000);
 expect(everyoneLeaveCarDelay(2,()=>0xffff)).toBe(250+1000+499);
});
