import {expect,test} from 'vitest';
import {showsStatUpdate,statNameKey} from '../src/ui/nativeStatUpdate';
const base={widescreen:false,helpShowing:false,capped:false,current:500};
test('DisplayScriptStatUpdateMessage shows the listed stats moving by more than 1',()=>{
 expect(showsStatUpdate({...base,stat:22,value:5})).toBe(true);
 expect(showsStatUpdate({...base,stat:22,value:1})).toBe(false);
 // Bike skill is not in the reversed switch.
 expect(showsStatUpdate({...base,stat:229,value:10})).toBe(false);
 expect(showsStatUpdate({...base,stat:64,value:.5})).toBe(true);
 expect(showsStatUpdate({...base,stat:22,value:5,widescreen:true})).toBe(false);
 expect(showsStatUpdate({...base,stat:22,value:5,helpShowing:true})).toBe(false);
 expect(showsStatUpdate({...base,stat:23,value:5,capped:true,current:1000})).toBe(false);
 expect(statNameKey(22)).toBe('STAT022');
});
