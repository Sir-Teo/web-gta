import {expect,test} from 'vitest';
import {hoverWheelContact,hoverActive} from '../src/simulation/nativeHoverSuspension';
const line={start:{x:1,y:2,z:5},end:{x:1,y:2,z:4}};
test('a wheel line over water takes its fraction from the water plane: 1 at or under the end, linear between, 0 over the start',()=>{
 expect(hoverWheelContact({...line,waterLevel:undefined})).toBeUndefined();
 // Water at 4.25 with the ground far below: fraction (5 − 4.25)/(5 − 4) = 0.75, the point on the water.
 const c=hoverWheelContact({...line,waterLevel:4.25});
 expect(c!.fraction).toBeCloseTo(.75,9);expect(c!.point).toEqual({x:1,y:2,z:4.25});expect(c!.normal).toEqual({x:0,y:0,z:1});
 expect(hoverWheelContact({...line,waterLevel:3.5})!.fraction).toBe(1);
 expect(hoverWheelContact({...line,waterLevel:5.5})!.fraction).toBe(0);
 // Water more than a unit under the line end is out of reach; water under the ground contact defers to the ground.
 expect(hoverWheelContact({...line,waterLevel:2.9})).toBeUndefined();
 expect(hoverWheelContact({...line,waterLevel:4.25,groundContactZ:4.5})).toBeUndefined();
 expect(hoverWheelContact({...line,waterLevel:4.6,groundContactZ:4.5})!.fraction).toBeCloseTo(.4,9);
 expect(hoverActive(.5,false)).toBe(true);expect(hoverActive(.2,false)).toBe(false);expect(hoverActive(.9,true)).toBe(false);
});
