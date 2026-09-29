import {expect,test} from 'vitest';
import {MOUSE_ACCEL_DEFAULT,MOUSE_ACCEL_MAX,MOUSE_ACCEL_MIN,mouseYawScale,parseMouseSettings} from '../src/input/mouseSettings';
test('mouse settings default to the frontend defaults and stay within the slider range',()=>{
 expect(parseMouseSettings(null)).toEqual({accel:MOUSE_ACCEL_DEFAULT,invertY:false});
 expect(parseMouseSettings({accel:1,invertY:true})).toEqual({accel:MOUSE_ACCEL_MAX,invertY:true});
 expect(parseMouseSettings({accel:0})).toEqual({accel:MOUSE_ACCEL_MIN,invertY:false});
 expect(parseMouseSettings({accel:'x',invertY:'yes'})).toEqual({accel:MOUSE_ACCEL_DEFAULT,invertY:false});
 expect(mouseYawScale({accel:MOUSE_ACCEL_DEFAULT,invertY:false})).toBe(1);expect(mouseYawScale({accel:MOUSE_ACCEL_MAX,invertY:false})).toBe(2);
});
