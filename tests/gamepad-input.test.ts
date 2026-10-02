import {expect,test} from 'vitest';
import {GamepadInput,LOOK_PIXELS_PER_SECOND,PAD,padCodes} from '../src/input/GamepadInput';
import {Input} from '../src/input/Input';
/** A standard-mapping pad whose buttons and sticks the test sets. */
function fakePad(){
 const pad={connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
 const press=(name:keyof typeof PAD,on:boolean)=>{pad.buttons[PAD[name]]={pressed:on,value:on?1:0};};
 return {pad,press};
}
function setup(){
 // Input only listens on the window and the canvas it is given.
 const target={addEventListener(){}};(globalThis as any).window??=target;
 const input=new Input(target as unknown as HTMLCanvasElement,()=>{}),{pad,press}=fakePad();
 return {input,pad,press,gamepad:new GamepadInput(input,()=>[null,pad])};
}
test('the PS2 layout holds the keys the PC binds to the same actions, on foot and at the wheel',()=>{
 const pressed=(...names:(keyof typeof PAD)[])=>{const p:boolean[]=[];for(const n of names)p[PAD[n]]=true;return p;};
 expect([...padCodes(pressed('cross','square','triangle','circle','r1'),false)].sort()).toEqual(['ControlLeft','KeyF','MouseAim','ShiftLeft','Space']);
 expect([...padCodes(pressed('cross','square','r1','l2','r2'),true)].sort()).toEqual(['KeyE','KeyQ','KeyS','KeyW','Space']);
 expect([...padCodes(pressed('left','right'),false)].sort()).toEqual(['KeyN','KeyY']);
});
test('a pad plays: buttons hold their keys, the left stick walks and steers, the right one looks',()=>{
 const {input,press,pad,gamepad}=setup();
 // Each frame the game starts its input frame and then polls the pad.
 input.frameStart();press('cross',true);gamepad.poll(1/30,'foot',1000);expect(input.down('ShiftLeft')).toBe(true);expect(gamepad.lastUsed).toBe(1000);
 // Let go the next frame: the frame before saw it held, so it goes.
 input.frameStart();press('cross',false);gamepad.poll(1/30,'foot',1033);expect(input.down('ShiftLeft')).toBe(false);
 // Cross at the wheel is the gas.
 press('cross',true);gamepad.poll(1/30,'vehicle');expect(input.down('KeyW')).toBe(true);press('cross',false);gamepad.poll(1/30,'vehicle');input.frameStart();input.frameStart();
 // A light push walks (the PC's Alt), a full one runs; the stick is the touch stick's analog value, y forward.
 pad.axes=[0,-.4,0,0];gamepad.poll(1/30,'foot');expect(input.stick).toEqual({x:0,y:.4});expect(input.down('AltLeft')).toBe(true);
 pad.axes=[1,-1,0,0];gamepad.poll(1/30,'foot');expect(input.stick!.x).toBeCloseTo(Math.SQRT1_2,5);expect(input.down('AltLeft')).toBe(false);
 // Let go of the stick, and the right stick turns the camera.
 pad.axes=[0,0,.5,0];gamepad.poll(.1,'foot');expect(input.stick).toBeUndefined();expect(input.lookX).toBeCloseTo(.5*LOOK_PIXELS_PER_SECOND*.1,5);
 // A resting stick's drift does nothing.
 input.lookX=0;pad.axes=[.1,.1,.1,-.1];gamepad.poll(.1,'foot');expect(input.stick).toBeUndefined();expect(input.lookX).toBe(0);
 input.dispose();
});
test('under a menu the pad holds no keys: the D-pad moves, cross selects, Start toggles the pause',()=>{
 const {input,press,gamepad}=setup();
 press('down',true);const first=gamepad.poll(1/30,'menu');expect(first).toEqual({start:false,menuMove:1,menuSelect:false});expect(input.down('KeyH')).toBe(false);
 // Held, it moves once.
 expect(gamepad.poll(1/30,'menu').menuMove).toBe(0);press('down',false);
 press('cross',true);expect(gamepad.poll(1/30,'menu').menuSelect).toBe(true);expect(input.down('ShiftLeft')).toBe(false);press('cross',false);
 press('start',true);expect(gamepad.poll(1/30,'foot').start).toBe(true);expect(gamepad.poll(1/30,'foot').start).toBe(false);
 input.dispose();
});
