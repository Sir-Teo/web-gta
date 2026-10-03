import {expect,test} from 'vitest';
import {GYRO_DEAD_ZONE,gyroLook} from '../src/input/gyroAim';
import {DEFAULT_TOUCH,parseTouchSettings} from '../src/input/touchSettings';

const deg=(r:number)=>r*180/Math.PI;
test('a phone held sideways turns the view as it turns, and looks up as its top edge comes toward the player',()=>{
 // Screen at 90 (the phone's top to the left): its up is the device's x, its right the device's -y.
 // Turned to the left about the up axis (counter-clockwise from above, +beta): the view turns left, degree for degree.
 let turn=gyroLook({beta:30,gamma:0,alpha:0},90,.1);expect(deg(turn.yaw)).toBeCloseTo(3);expect(turn.pitch).toBe(0);
 // Its top edge toward the player (about the screen's right, -gamma here): the back looks up.
 turn=gyroLook({beta:0,gamma:-20,alpha:0},90,.05);expect(turn.yaw).toBe(0);expect(deg(turn.pitch)).toBeCloseTo(1);
 // The other way round (270), the same turns are the device's other axes.
 turn=gyroLook({beta:-30,gamma:0},270,.1);expect(deg(turn.yaw)).toBeCloseTo(3);
 turn=gyroLook({beta:0,gamma:20},270,.05);expect(deg(turn.pitch)).toBeCloseTo(1);
 // Upright (0), up is the device's y.
 turn=gyroLook({beta:0,gamma:30},0,.1);expect(deg(turn.yaw)).toBeCloseTo(3);
 // Rolled like a wheel (alpha) it aims nothing.
 expect(gyroLook({alpha:90,beta:0,gamma:0},90,.5)).toEqual({yaw:0,pitch:0});
});

test('a steady hand turns nothing, a stalled sensor no more than a tenth of a second, and a missing rate nothing',()=>{
 expect(gyroLook({beta:GYRO_DEAD_ZONE*.9,gamma:-GYRO_DEAD_ZONE*.9},90,.016)).toEqual({yaw:0,pitch:0});
 expect(deg(gyroLook({beta:100},90,5).yaw)).toBeCloseTo(10);
 expect(gyroLook(null,90,.1)).toEqual({yaw:0,pitch:0});expect(gyroLook({beta:null,gamma:NaN},90,.1)).toEqual({yaw:0,pitch:0});
});

test('gyro aiming is off unless chosen, and kept',()=>{
 expect(DEFAULT_TOUCH.gyroAim).toBe(false);expect(parseTouchSettings({}).gyroAim).toBe(false);
 expect(parseTouchSettings({gyroAim:true}).gyroAim).toBe(true);expect(parseTouchSettings({gyroAim:'yes'}).gyroAim).toBe(false);
});
