import {expect,test} from 'vitest';
import {PlayerIdles} from '../src/assets/playerIdles';

const seq=(...v:number[])=>{let i=0;return ()=>v[i++%v.length];};
test('PlayIdleAnimations starts an idle 20 s untouched, then every 20 s, never the same twice running',()=>{
 const idles=new PlayerIdles();
 expect(idles.step(15000,false,seq(0))).toBeUndefined();
 expect(idles.step(20000,false,seq(0))).toBeUndefined();
 expect(idles.step(20001,false,seq(.1))).toBe('stretch');
 // Nothing new while one plays, or before 20 s more.
 expect(idles.step(30000,true,seq(.3))).toBeUndefined();
 expect(idles.step(40000,false,seq(.3))).toBeUndefined();
 // The draw repeats `stretch`, so it draws again.
 expect(idles.step(40002,false,seq(.1,.1,.6))).toBe('shldr');
});
test('a touch within 10 s blends the idle out and restarts the count',()=>{
 const idles=new PlayerIdles();
 expect(idles.step(25000,false,seq(.9))).toBe('strleg');
 expect(idles.step(9000,true,seq(0))).toBe('stop');
 expect(idles.step(9500,false,seq(0))).toBeUndefined();
 expect(idles.step(20001,false,seq(.3))).toBe('time');
});
