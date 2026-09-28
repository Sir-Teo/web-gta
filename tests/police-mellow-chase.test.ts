import {expect,test} from 'vitest';
import {mellowChaseSpeed} from '../src/simulation/WorldPolice';

// CCarAI::MellowOutChaseSpeed, run every frame of MISSION_APPROACHPLAYER_CLOSE (a suspect on foot): at one star 5
// within 20 units, 13 within 40, else 25; at two stars 5, 18, 34; and 10 when the suspect stands still within 30 with a
// speed of 10 or more asked; other levels keep the cruise speed.
test('the chase creeps up on a suspect on foot at one and two stars',()=>{
 expect(mellowChaseSpeed(1,15,false,.2,25)).toBe(5);
 expect(mellowChaseSpeed(1,30,false,.2,25)).toBe(13);
 expect(mellowChaseSpeed(1,50,false,.2,25)).toBe(25);
 expect(mellowChaseSpeed(2,30,false,.2,34)).toBe(18);
 expect(mellowChaseSpeed(2,45,false,.2,34)).toBe(34);
 // Standing still within 30: 13 or 18 become 10; 5 stays (under the 10 floor).
 expect(mellowChaseSpeed(1,25,false,.01,25)).toBe(10);
 expect(mellowChaseSpeed(2,25,false,.01,34)).toBe(10);
 expect(mellowChaseSpeed(1,15,false,.01,25)).toBe(5);
 // Above two stars the cruise stands, but the standing-still clamp to 10 within 30 still applies.
 expect(mellowChaseSpeed(3,15,false,.01,60)).toBe(10);expect(mellowChaseSpeed(3,40,false,.01,60)).toBe(60);expect(mellowChaseSpeed(3,15,false,.2,60)).toBe(60);
});
