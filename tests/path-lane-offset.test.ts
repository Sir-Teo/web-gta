import {expect,test} from 'vitest';
import {pathLaneOffset} from '../src/assets/pathLaneOffset';
test('opposite-lane branch takes precedence and depends on same-direction lane count',()=>{
 for(let oppositeLanes=1;oppositeLanes<=7;oppositeLanes++)for(let sameLanes=0;sameLanes<=7;sameLanes++){
  for(const width of [-8,0,7.9375])expect(pathLaneOffset({oppositeLanes,sameLanes,width})).toBe(.5-sameLanes/2);
 }
});
test('same-direction-only roads retain signed fixed-point width in the lane adjustment',()=>{
 for(let sameLanes=1;sameLanes<=7;sameLanes++){
  expect(pathLaneOffset({oppositeLanes:0,sameLanes,width:5.4})).toBe(0);
  expect(pathLaneOffset({oppositeLanes:0,sameLanes,width:0})).toBe(.5);
  expect(pathLaneOffset({oppositeLanes:0,sameLanes,width:-5.4})).toBe(1);
  expect(pathLaneOffset({oppositeLanes:0,sameLanes,width:43/16})).toBeCloseTo(.2511574074,9);
 }
});
test('zero-lane records preserve the source fallback independently of width',()=>{
 for(const width of [-8,0,7.9375])expect(pathLaneOffset({oppositeLanes:0,sameLanes:0,width})).toBe(.5);
});
