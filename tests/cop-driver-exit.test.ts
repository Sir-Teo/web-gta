import {expect,test} from 'vitest';
import {copDriverExitDelay,hasCopInCarTask,suspectCarCrawling} from '../src/simulation/WorldPolice';

// CTaskComplexCopInCar (TASK_SIMPLE_CAR_DRIVE with the leave flag): the driver's timer is 3000–5000 ms while
// m_flag0x4 holds (no chase resumed yet) and 250–1500 ms after; a crew without the task is told to leave through
// CTaskComplexLeaveCar at once. CCarAI::AddPoliceCarOccupants hands the task only to city cop car and Barracks crews
// made above one star.
test('the driver waits the long time first, the short time after a resumed chase, and not at all without the task',()=>{
 expect(copDriverExitDelay({copInCar:true,firstStop:true,random:()=>0})).toBe(3);
 expect(copDriverExitDelay({copInCar:true,firstStop:true,random:()=>1})).toBe(5);
 expect(copDriverExitDelay({copInCar:true,firstStop:false,random:()=>0})).toBe(.25);
 expect(copDriverExitDelay({copInCar:true,firstStop:false,random:()=>1})).toBe(1.5);
 expect(copDriverExitDelay({copInCar:false,firstStop:true,random:()=>1})).toBe(0);
 expect(hasCopInCarTask(596,2)).toBe(true);expect(hasCopInCarTask(433,3)).toBe(true);
 expect(hasCopInCarTask(596,1)).toBe(false);expect(hasCopInCarTask(427,4)).toBe(false);expect(hasCopInCarTask(432,4)).toBe(false);
});
test('the waiting driver stays for a suspect car crawling within 10 units and resumes for one driving off',()=>{
 // 5.48 m/s is |moveSpeed|² × TimeStep × 50 = 1 at 30 fps.
 expect(suspectCarCrawling(5/50,6)).toBe(true);
 expect(suspectCarCrawling(10/50,6)).toBe(false);
 expect(suspectCarCrawling(5/50,11)).toBe(false);
});
