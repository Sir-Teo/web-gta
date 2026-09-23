import {expect,test} from 'vitest';
import {evaluateCarPosition} from '../src/simulation/nativeCarChoice';
test('CPlayerInfo::EvaluateCarPosition: a car ahead at 4 beats one behind at 2',()=>{
 const ahead=evaluateCarPosition(0,0,4),behind=evaluateCarPosition(0,Math.PI,2);
 expect(ahead).toBeCloseTo(6,9);expect(behind).toBeCloseTo(4,9);expect(ahead).toBeGreaterThan(behind);
 // The angle wraps: facing just under 2π and a bearing of 0 are the same direction.
 expect(evaluateCarPosition(2*Math.PI-.01,0,0)).toBeCloseTo(10*(1-.01/(2*Math.PI)),9);
});
