import {expect,test} from 'vitest';
import {showsStatUpdate,statNameKey,statUpdateBar} from '../src/ui/nativeStatUpdate';
const base={widescreen:false,helpShowing:false,capped:false,current:500};
test('DisplayScriptStatUpdateMessage shows the listed stats moving by more than 1',()=>{
 expect(showsStatUpdate({...base,stat:22,value:5})).toBe(true);
 expect(showsStatUpdate({...base,stat:22,value:1})).toBe(false);
 // Bike skill is in the switch's second group, with flying, lung capacity, cycling and luck.
 expect(showsStatUpdate({...base,stat:229,value:10})).toBe(true);
 expect(showsStatUpdate({...base,stat:233,value:1})).toBe(false);
 // Girlfriend progress on a bar of 100 whatever the change, pimping of 10, gang strength of the group's size.
 expect(statUpdateBar({...base,stat:252,value:.5})).toBe(100);
 expect(statUpdateBar({...base,stat:210,value:1})).toBe(10);
 expect(statUpdateBar({...base,stat:336,value:1,maxGroup:4})).toBe(4);
 expect(statUpdateBar({...base,stat:120,value:5})).toBeUndefined();
 expect(showsStatUpdate({...base,stat:64,value:.5})).toBe(true);
 expect(showsStatUpdate({...base,stat:22,value:5,widescreen:true})).toBe(false);
 expect(showsStatUpdate({...base,stat:22,value:5,helpShowing:true})).toBe(false);
 expect(showsStatUpdate({...base,stat:23,value:5,capped:true,current:1000})).toBe(false);
 expect(statNameKey(22)).toBe('STAT022');
});
