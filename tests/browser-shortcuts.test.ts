import {describe,expect,it} from 'vitest';
import {takesBrowserShortcut} from '../src/input/Input';
const key=(code:string,mods:{altKey?:boolean;ctrlKey?:boolean;shiftKey?:boolean}={})=>({code,altKey:false,ctrlKey:false,shiftKey:false,...mods});
describe('Alt (walk) and Ctrl (fire) held in play',()=>{
 it('keeps the modifier buttons themselves from the browser',()=>{
  for(const code of ['AltLeft','AltRight','ControlLeft','ControlRight'])expect(takesBrowserShortcut(key(code))).toBe(true);
 });
 it('keeps the keys pressed beside them from the browser',()=>{
  expect(takesBrowserShortcut(key('KeyD',{altKey:true}))).toBe(true);
  expect(takesBrowserShortcut(key('ArrowLeft',{altKey:true}))).toBe(true);
  for(const code of ['KeyS','KeyD','KeyF','KeyR'])expect(takesBrowserShortcut(key(code,{ctrlKey:true}))).toBe(true);
 });
 it('leaves plain keys and Ctrl+Shift combinations to their usual handling',()=>{
  expect(takesBrowserShortcut(key('KeyW'))).toBe(false);
  expect(takesBrowserShortcut(key('KeyW',{shiftKey:true}))).toBe(false);
  expect(takesBrowserShortcut(key('KeyI',{ctrlKey:true,shiftKey:true}))).toBe(false);
 });
});
