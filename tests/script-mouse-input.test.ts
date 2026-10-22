import {afterEach,expect,test,vi} from 'vitest';
import {Input} from '../src/input/Input';
afterEach(()=>vi.unstubAllGlobals());
function setup(locked=true){
 const canvas=Object.assign(new EventTarget(),{nodeType:1,focus(){},contains(target:unknown){if(target&&!(typeof target==='object'&&'nodeType'in target))throw new TypeError('Expected a Node');return target===this;}}),target=new EventTarget(),document={pointerLockElement:locked?canvas:null};vi.stubGlobal('window',target);vi.stubGlobal('document',document);const input=new Input(canvas as any,()=>{});
 const move=(x:number,y:number)=>{const event=Object.assign(new Event('mousemove'),{movementX:x,movementY:y});target.dispatchEvent(event);};return{input,move,target,canvas};
}
test('script mouse deltas accumulate independently of the camera and drain once per frame',()=>{
 const {input,move}=setup();try{move(4,-8);move(-1,2);expect(input.lookX).toBe(3);expect(input.lookY).toBe(-6);input.lookX=input.lookY=0;expect(input.takeScriptMouseMovement()).toEqual({x:3,y:-6});expect(input.takeScriptMouseMovement()).toEqual({x:0,y:0});}finally{input.dispose();}
});
test('touch/pad view motion remains available to the script and camera in the same frame',()=>{
 const {input}=setup(false);try{input.lookX=12.5;input.lookY=-6.25;expect(input.takeScriptMouseMovement()).toEqual({x:12.5,y:-6.25});expect(input.lookX).toBe(12.5);expect(input.lookY).toBe(-6.25);input.lookX=input.lookY=0;expect(input.takeScriptMouseMovement()).toEqual({x:0,y:0});}finally{input.dispose();}
});
test('menu/outside motion is ignored and focus loss clears a pending script stroke',()=>{
 const {input,move,target}=setup(false);try{move(100,200);expect(input.takeScriptMouseMovement()).toEqual({x:0,y:0});vi.stubGlobal('document',{pointerLockElement:input.canvas});move(4,8);target.dispatchEvent(new Event('blur'));expect(input.takeScriptMouseMovement()).toEqual({x:0,y:0});}finally{input.dispose();}
});
