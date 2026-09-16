import {expect,test} from 'vitest';
import {hoverFlight} from '../src/simulation/hoverFlight';
const zero={x:0,y:0,z:0},q={x:0,y:0,z:0,w:1},input={throttle:0,pitch:0,roll:0,rudder:0,brake:false};
test('collective lift can overcome gravity, and hover damps drift',()=>{expect(hoverFlight(zero,q,input).acceleration.y).toBe(-9.81);expect(hoverFlight(zero,q,{...input,throttle:1}).acceleration.y).toBeGreaterThan(9.81);const hover=hoverFlight({x:10,y:2,z:-4},q,{...input,brake:true});expect(hover.acceleration.x).toBeLessThan(0);expect(hover.acceleration.z).toBeGreaterThan(0);expect(hover.acceleration.y).toBeLessThan(0);});
test('rotorcraft attitude responds at zero airspeed and yaw remains controllable',()=>{const result=hoverFlight(zero,q,{...input,pitch:-1,roll:1,rudder:1});expect(result.angular.x).toBeLessThan(0);expect(result.angular.z).toBeLessThan(0);expect(result.angular.y).toBeLessThan(0);expect(result.stall).toBe(false);});
