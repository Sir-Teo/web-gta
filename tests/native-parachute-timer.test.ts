import {expect,test} from 'vitest';
import {NativeParachuteTimer} from '../src/simulation/nativeParachuteTimer';
test('StreamParachuteWeapon arms the parachute over 50 units up, checks every 5 s and holds it out of the aircraft',()=>{
 const t=new NativeParachuteTimer();
 t.step(20,{heightOverGround:40});expect(t.wantsParachute).toBe(false);
 t.step(20,{heightOverGround:60});expect(t.timer).toBe(5000);expect(t.wantsParachute).toBe(true);
 // Low again, but the timer runs out first.
 for(let i=0;i<249;i++)t.step(20,{heightOverGround:10});expect(t.timer).toBe(20);
 t.step(20,{heightOverGround:10});expect(t.timer).toBe(0);
 t.step(20,{heightOverGround:80});t.step(20);expect(t.timer).toBe(5000);
});
