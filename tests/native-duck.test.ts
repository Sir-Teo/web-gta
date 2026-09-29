import {expect,test} from 'vitest';
import {NativeDuckMove,playerDuckMove} from '../src/locomotion/nativeDuck';

test('ControlDuckMove eases the crouch walk and rolls on a sideways push', () => {
 const duck=new NativeDuckMove();
 // Forward on the stick: m_MoveCmd.y falls 0.07 a frame, the clip playing at no less than 0.6.
 duck.control(0,-1,1);expect(duck.y).toBeCloseTo(-.07);expect(duck.clip).toBe('fwd');expect(duck.speed).toBe(.6);
 for(let i=0;i<20;i++)duck.control(0,-1,1);
 expect(duck.y).toBe(-1);expect(duck.speed).toBe(1);
 // Back: the command crosses zero on its way.
 for(let i=0;i<15;i++)duck.control(0,1,1);
 expect(duck.y).toBeGreaterThan(0);expect(duck.clip).toBe('bwd');
 // Almost purely right starts CROUCH_ROLL_R and the pad is ignored until the clip ends.
 duck.control(.95,.05,1);expect(duck.clip).toBe('rollR');expect(duck.y).toBe(0);expect(duck.rolling).toBe(true);
 duck.control(-1,0,1);duck.control(0,-1,1);expect(duck.clip).toBe('rollR');expect(duck.y).toBe(0);
 duck.rollFinished();expect(duck.rolling).toBe(false);expect(duck.clip).toBe('stop');
 duck.control(-1,0,1);expect(duck.clip).toBe('rollL');
 // A diagonal push only walks.
 duck.reset();duck.control(.9,-.5,1);expect(duck.rolling).toBe(false);expect(duck.clip).toBe('fwd');
});

test('PlayerControlDucked walks forward unless a gun is aimed', () => {
 expect(playerDuckMove(1,0,false)).toEqual({x:0,y:-1});
 expect(playerDuckMove(.3,.4,false)).toEqual({x:0,y:-.5});
 expect(playerDuckMove(1,0,true)).toEqual({x:1,y:0});
});
test('ForceStopMove zeroes the crouch walk and it eases back in at 0.07 a frame',()=>{
 const d=new NativeDuckMove();d.control(0,-1,20);expect(d.y).toBe(-1);
 d.forceStopMove();expect(d.y).toBe(0);expect(d.clip).toBe('stop');
 d.control(0,-1,1);expect(d.y).toBeCloseTo(-.07);
});
