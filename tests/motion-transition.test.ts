import { expect, test } from 'vitest';
import { MotionTransition } from '../src/animation/MotionTransition';
test('integrates acceleration and completion identically across tick subdivisions', () => {
  const total=(dt:number,count:number)=>{const m=new MotionTransition(.18);m.begin();let x=0;for(let i=0;i<count;i++)x+=m.advance({x:4*dt,z:0},dt).x;return x;};
  expect(total(.3,1)).toBeCloseTo(.84);expect(total(.01,30)).toBeCloseTo(.84);expect(total(1/60,18)).toBeCloseTo(.84);
});
test('decelerates to idle and interrupted transitions capture the current velocity', () => {
  const m=new MotionTransition(.2);m.advance({x:0,z:.4},.1);m.begin();
  expect(m.advance({x:0,z:0},.1).z).toBeCloseTo(.3);
  m.begin();expect(m.advance({x:0,z:.4},.1).z).toBeCloseTo(.25);
  expect(m.advance({x:0,z:.4},.1).z).toBeCloseTo(.35);
  m.begin();expect(m.advance({x:0,z:0},.2).z).toBeCloseTo(.4);expect(m.advance({x:0,z:0},.1).z).toBe(0);
});
test('reset cancels residual travel and invalid input fails', () => {
  const m=new MotionTransition(.2);m.advance({x:1,z:0},.1);m.begin();m.reset();expect(m.advance({x:0,z:0},.1)).toEqual({x:0,z:0});
  expect(()=>m.advance({x:NaN,z:0},.1)).toThrow('finite');expect(()=>m.advance({x:0,z:0},0)).toThrow('positive');
});
