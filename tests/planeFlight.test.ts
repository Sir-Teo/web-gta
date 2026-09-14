import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {readHandling} from '../src/assets/handling';
import {indexFlyingHandling} from '../src/assets/flyingHandling';
import {planeFlight} from '../src/simulation/planeFlight';
const flight=indexFlyingHandling(readHandling(readFileSync('public/play/world/files/vehicles/handling.cfg','utf8')).supplements).get('DODO')!;
const q={x:0,y:0,z:0,w:1},idle={throttle:0,pitch:0,roll:0,rudder:0,brake:false};
test('unpowered stalled aircraft falls; throttle supplies forward thrust, braking opposes taxi motion',()=>{
 const rest=planeFlight({x:0,y:0,z:0},q,idle,flight,false,false);expect(rest.acceleration.y).toBeLessThan(-9);expect(rest.stall).toBe(true);
 expect(planeFlight({x:0,y:0,z:0},q,{...idle,throttle:1},flight,false,true).acceleration.z).toBeLessThan(0);
 const v={x:0,y:0,z:-12};expect(planeFlight(v,q,{...idle,brake:true},flight,false,true).acceleration.z).toBeGreaterThan(planeFlight(v,q,idle,flight,false,true).acceleration.z);
});
test('flight controls have no aerodynamic authority at rest and bank right with the right wing down',()=>{
 expect(planeFlight({x:0,y:0,z:0},q,{...idle,pitch:1,roll:1},flight,false,true).angular.length()).toBe(0);
 const air=planeFlight({x:0,y:0,z:-35},q,{...idle,pitch:1,roll:1},flight,true,false);expect(air.angular.x).toBeGreaterThan(0);expect(air.angular.z).toBeLessThan(0);expect(air.stall).toBe(false);
});
