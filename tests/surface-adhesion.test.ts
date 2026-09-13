import {expect,test} from 'vitest';
import {readSurfaceAdhesion,surfaceAdhesiveLimit} from '../src/assets/surfaceAdhesion';
import {readSurfaceInfo} from '../src/assets/surfaceInfo';
const material=(group:string)=>readSurfaceInfo(['TEST',group,1,0,'DEFAULT','NONE',...Array(29).fill(0),'NONE'].join(' ')).records[0];
const diagnostic='arbitrary 0.5\nlabels 1.25 2\nare 3.75 4 5\nnot 6 7 8 9\ngroup 10 11 12 13 14\nkeys 15 16 17 18 19 20';
test('preserves positional rows, source line numbers, placeholders and missing cells',()=>{
  const {rows}=readSurfaceAdhesion('\uFEFF ; header\r\n\n'+diagnostic.replace('1.25 2','1.25,---')+'\n');
  expect(rows[0]).toEqual({label:'arbitrary',line:3,cells:[.5]});
  expect(rows[1]).toEqual({label:'labels',line:4,cells:[1.25,'---']});
  expect(rows[5].cells).toEqual([15,16,17,18,19,20]);
});
test('uses road row and wheel column with no name-based reorder or symmetry guess',()=>{
  const {rows}=readSurfaceAdhesion(diagnostic);
  expect(surfaceAdhesiveLimit(rows,material('RUBBER'),material('ROAD'))).toBe(3.75);
  expect(surfaceAdhesiveLimit(rows,material('HARD'),material('WET'))).toBe(16);
  expect(()=>surfaceAdhesiveLimit(rows,material('ROAD'),material('RUBBER'))).toThrow(/explicit/);
  expect(()=>surfaceAdhesiveLimit(rows,material('CUSTOM'),material('ROAD'))).toThrow(/Unknown/);
});
test('keeps raw precision and negative data but rejects unsupported runtime coefficients',()=>{
  const {rows}=readSurfaceAdhesion(diagnostic.replace('0.5','-0.123456789'));
  expect(rows[0].cells[0]).toBe(-.123456789);
  expect(()=>surfaceAdhesiveLimit(rows,material('RUBBER'),material('RUBBER'))).toThrow(/explicit/);
  rows[0].cells[0]=.123456789;
  expect(surfaceAdhesiveLimit(rows,material('RUBBER'),material('RUBBER'))).toBe(Math.fround(.123456789));
  rows[0].cells[0]='---';expect(()=>surfaceAdhesiveLimit(rows,material('RUBBER'),material('RUBBER'))).toThrow(/explicit/);
});
test('bounds the parser and requires complete positional context for lookup',()=>{
  for(const text of ['a 1e99','a\0 1','a 1 2 3 4 5 6 7',diagnostic+'\na 1',' '.repeat(65537),'a '+ 'x'.repeat(64)])expect(()=>readSurfaceAdhesion(text)).toThrow();
  const {rows}=readSurfaceAdhesion('label');expect(rows[0].cells).toEqual([]);
  expect(()=>surfaceAdhesiveLimit(rows,material('RUBBER'),material('ROAD'))).toThrow(/six/);
});
