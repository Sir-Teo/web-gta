import {expect,test} from 'vitest';
import {sampleSun} from '../src/world/sun';

test('visible sun follows the native orbit in placement coordinates independently of lighting',()=>{
  // Native vectors at the four quadrants, rotated (x,y,z) -> (x,z,-y).
  for(const [minutes,vector] of [[0,[.7,-.8,.7]],[360,[1.7,.2,.7]],[720,[.7,1.2,.7]],[1080,[-.3,.2,.7]]] as const){
    const result=sampleSun(minutes),length=Math.hypot(...vector);
    [result.direction.x,result.direction.y,result.direction.z].forEach((v,i)=>expect(v).toBeCloseTo(vector[i]/length,12));
  }
  expect(sampleSun(1440)).toEqual(sampleSun(0));expect(sampleSun(-1)).toEqual(sampleSun(1439));
  expect(sampleSun(0).coreVisible).toBe(false);expect(sampleSun(720).coronaVisible).toBe(true);
  expect(sampleSun(300).coreVisible).toBe(true);expect(sampleSun(300).coronaVisible).toBe(false);
  expect(sampleSun(360).coronaVisible).toBe(true);
});
