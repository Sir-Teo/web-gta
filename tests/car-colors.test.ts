import {expect,test} from 'vitest';
import {chooseVehicleColors,readCarColors,resolveCarColors} from '../src/assets/carColors';
const palette='col\n0,0,0 # black\n10,20,30\n40,50,60\n70,80,90\nend\n';
test('two and four slot definitions preserve order, duplicate definitions and explicit variation selection',()=>{
 const data=readCarColors('\uFEFF'+palette+'car\ncar_a,1,2,2,3\nend\ncar4\ncar_b,0,1,2,3\nend\ncar\nCAR_A,3,1\nend');
 expect(data.definitions[0].variants).toEqual([[1,2,0,0],[2,3,0,0]]);
 expect(resolveCarColors(data,'car_a',0)).toMatchObject({indices:[3,1,0,0],colors:[[70,80,90],[10,20,30],[0,0,0],[0,0,0]]});
 expect(resolveCarColors(data,'car_b',0).indices).toEqual([0,1,2,3]);
 const resolved=resolveCarColors(data,'car_b',0);resolved.indices[0]=99;(resolved.colors[0] as unknown as number[])[0]=123;
 expect(data.palette[0].rgb).toEqual([0,0,0]);expect(data.definitions[1].variants[0]).toEqual([0,1,2,3]);
 expect(()=>resolveCarColors(data,'missing',0)).toThrow(/No car colors/);expect(chooseVehicleColors(data,'missing',0)).toMatchObject({indices:[0,0,0,0],colors:[[0,0,0],[0,0,0],[0,0,0],[0,0,0]]});expect(chooseVehicleColors(data,'car_b',0).indices).toEqual([0,1,2,3]);expect(()=>resolveCarColors(data,'car_b',.5)).toThrow(/variation/);
});
test('a malformed palette row keeps its index and reads as LoadVehicleColours scans it',()=>{
 // sscanf "%d %d %d" into zeroed fields stops at the stock typo's '.', so malachite poly is (77, 0, 0).
 const data=readCarColors('col\n0 0 0\n77.93,96\n40 50 60\n300 -1 x\nend\ncar\na 2 0\nb 1 0\nend');
 expect(data.palette).toHaveLength(4);expect(data.palette[1].raw).toBe('77.93,96');expect(data.palette[1].issues).toHaveLength(1);
 expect(data.palette[1].rgb).toEqual([77,0,0]);expect(data.palette[3].rgb).toEqual([44,255,0]);
 expect(resolveCarColors(data,'a',0).colors[0]).toEqual([40,50,60]);expect(resolveCarColors(data,'b',0).colors[0]).toEqual([77,0,0]);
});
test('an index past the 128-entry colour table paints as entry 0 instead of failing the car',()=>{
 // As the stock Moonbeam's `117,227`, against this test's short palette.
 const data=readCarColors(palette+'car\nmoonbeam 3 227 3 1\nend');
 expect(resolveCarColors(data,'moonbeam',0)).toMatchObject({indices:[3,227,0,0]});
 expect(resolveCarColors(data,'moonbeam',0).colors[1]).toEqual([0,0,0]);expect(resolveCarColors(data,'moonbeam',1).colors).toEqual([[70,80,90],[10,20,30],[0,0,0],[0,0,0]]);
});
test('invalid combinations and byte ranges stay explicit; structural and resource limits reject',()=>{
 for(const row of ['a 1','a 1 256','a -1 0','a 1.0 0','a '+Array(17).fill(0).join(' ')]){
  const data=readCarColors(palette+'car\n'+row+'\nend');expect(data.definitions[0].issues).toHaveLength(1);expect(()=>resolveCarColors(data,'a',0)).toThrow(/Unresolved/);
 }
 const missing=readCarColors(palette+'car\na 99 0\nend');expect(()=>resolveCarColors(missing,'a',0)).toThrow(/palette index 99/);
 for(const text of ['unknown','col\n0 0 0','col\n0\0 0 0\nend','col\n'+('0 0 0\n'.repeat(129))+'end'])expect(()=>readCarColors(text)).toThrow();
});

test('extra complete combinations remain inspectable but native selection stops after eight',()=>{
 const data=readCarColors(palette+'car\na '+Array(9).fill('1 2').join(' ')+'\nend');
 expect(data.definitions[0].variants).toHaveLength(9);expect(data.definitions[0].issues).toEqual(['Only the first eight combinations are loaded natively.']);
 expect(resolveCarColors(data,'a',7).indices).toEqual([1,2,0,0]);expect(()=>resolveCarColors(data,'a',8)).toThrow(/variation/);
});
