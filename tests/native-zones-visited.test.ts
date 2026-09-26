import {expect,test} from 'vitest';
import {NativeZonesVisited,zoneSquare} from '../src/world/nativeZonesVisited';
test('squares are 600 units, x from the west and y from the north, clamped to the map',()=>{
 expect(zoneSquare(-3000,3000)).toBe(0);expect(zoneSquare(-3000,-3000)).toBe(9);expect(zoneSquare(2999,-2999)).toBe(99);
 // Grove Street, native (2495, -1687): column 9, row 9 - 2 = 7.
 expect(zoneSquare(2495,-1687)).toBe(97);expect(zoneSquare(9000,-9000)).toBe(99);
});
test('the player\'s square is revealed once he has been outside for more than 5 s, not while off the map',()=>{
 const z=new NativeZonesVisited();
 z.update(0,2495,-1687,false,false);z.update(4000,2495,-1687,true,false);z.update(5000,2495,-1687,true,false);
 expect(z.revealed).toBe(0);
 z.update(5001,2495,-1687,true,true);expect(z.revealed).toBe(0);
 z.update(5001,2495,-1687,true,false);expect(z.revealed).toBe(1);expect(z.wasVisited(2400,-1500)).toBe(true);
 z.update(6000,2495,-1687,true,false);expect(z.revealed).toBe(1);
 // Indoors resets the count.
 z.update(7000,0,0,false,false);z.update(11000,0,0,true,false);expect(z.wasVisited(0,0)).toBe(false);
 z.update(12001,0,0,true,false);expect(z.wasVisited(0,0)).toBe(true);
});
test('short-range blips show on the map only in visited squares until more than 80 are, and the grid saves',()=>{
 const z=new NativeZonesVisited();
 expect(z.blipRevealed(0,0,false)).toBe(true);expect(z.blipRevealed(0,0,true)).toBe(false);
 const restored=new NativeZonesVisited();expect(restored.load('1'.repeat(81)+'0'.repeat(19))).toBe(true);
 expect(restored.revealed).toBe(81);expect(restored.blipRevealed(2999,-2999,true)).toBe(true);
 z.update(0,0,0,true,false);z.update(6000,0,0,true,false);
 const copy=new NativeZonesVisited();copy.load(z.save());expect(copy.wasVisited(0,0)).toBe(true);expect(copy.revealed).toBe(1);
 expect(copy.load('x')).toBe(false);
});
