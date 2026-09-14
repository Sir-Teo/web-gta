import {test,expect} from 'vitest';
import {stepPlaneWheelRoll} from '../src/simulation/planeWheelRoll';
const stopped={angle:0,speed:0};
test('taxi rotation follows signed ground travel and wheel circumference',()=>{
 expect(stepPlaneWheelRoll(stopped,Math.PI,.5,true,1).angle).toBeCloseTo(-2*Math.PI);
 expect(stepPlaneWheelRoll(stopped,-Math.PI,.5,true,1).angle).toBeCloseTo(2*Math.PI);
 const stoppedAgain=stepPlaneWheelRoll({angle:2,speed:10},0,.5,true,1);
 expect(stoppedAgain.angle).toBe(2);expect(stoppedAgain.speed).toBeCloseTo(0);
});
test('airborne tires coast down instead of spinning at flight speed',()=>{
 const rolling=stepPlaneWheelRoll(stopped,10,.5,true,1/60);
 const airborne=stepPlaneWheelRoll(rolling,100,.5,false,1);
 expect(Math.abs(airborne.speed)).toBeLessThan(Math.abs(rolling.speed));
 let halves=rolling;for(let i=0;i<2;i++)halves=stepPlaneWheelRoll(halves,100,.5,false,.5);
 expect(halves.speed).toBeCloseTo(airborne.speed,10);
 expect(stepPlaneWheelRoll(stopped,100,.5,false,1)).toEqual(stopped);
});
