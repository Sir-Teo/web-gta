import {expect,test} from 'vitest';
import {stickSteering} from '../src/input/stickSteering';
import {Input} from '../src/input/Input';
import {parseTouchSettings} from '../src/input/touchSettings';
test('the touch stick steers on the iOS port\'s curve: gentle near the centre, full lock at full deflection',()=>{
 // Below Low Range Max % (35) the gain climbs to Low Range Max Value (70): a tenth of the stick steers 2%.
 expect(stickSteering(.1)).toBeCloseTo(.02,6);expect(stickSteering(.35)).toBeCloseTo(.245,6);
 // Beyond it the gain runs on to one.
 expect(stickSteering(.5)).toBeCloseTo(.5*(.5*.3/.65+1-.3/.65),6);expect(stickSteering(1)).toBe(1);
 // Left as right, and past full deflection held at full lock.
 expect(stickSteering(-.35)).toBeCloseTo(-.245,6);expect(stickSteering(-1.4)).toBe(-1);expect(stickSteering(0)).toBe(0);
 // It only ever rises: every push steers more than a smaller one.
 let last=-Infinity;for(let x=0;x<=1.0001;x+=.01){const y=stickSteering(x);expect(y).toBeGreaterThanOrEqual(last);last=y;}
});
test('only the touch stick is marked for the curve: a played pad\'s stick reads straight, as the port\'s does',()=>{
 const target={addEventListener(){}};(globalThis as any).window??=target;
 const input=new Input(target as unknown as HTMLCanvasElement,()=>{});
 input.stick={x:.5,y:0};expect(input.axes()).toMatchObject({x:.5,touchStick:true});
 input.stickFromPad=true;expect(input.axes()).toMatchObject({x:.5,touchStick:false});
});
test('Auto climb is kept, on by default as the port\'s is',()=>{
 expect(parseTouchSettings({}).autoClimb).toBe(true);expect(parseTouchSettings({autoClimb:false}).autoClimb).toBe(false);
 expect(parseTouchSettings({autoClimb:'no'}).autoClimb).toBe(true);
});
test('Steering sensitivity is the port\'s Analog Sensitivity, 20 to 45 and 27 by default',()=>{
 expect(parseTouchSettings({}).analogSensitivity).toBe(27);
 expect(parseTouchSettings({analogSensitivity:40}).analogSensitivity).toBe(40);
 expect(parseTouchSettings({analogSensitivity:5}).analogSensitivity).toBe(20);expect(parseTouchSettings({analogSensitivity:99}).analogSensitivity).toBe(45);
});
