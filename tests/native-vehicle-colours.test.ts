import {expect,test} from 'vitest';
import {VehicleColourRotation,MAX_COLOUR_VARIATIONS} from '../src/vehicle/nativeVehicleColours';

test('each vehicle of a model advances the shared counter, so its traffic cycles through the carcols line',()=>{
 const rotation=new VehicleColourRotation();
 // The counter starts at zero and the shift is one, so the first car takes variation 1.
 expect([0,1,2,3,4].map(()=>rotation.choose('sadler',4))).toEqual([1,2,3,0,1]);
 // Another model keeps its own counter.
 expect(rotation.choose('taxi',3)).toBe(1);expect(rotation.lastVariation('sadler')).toBe(1);
 // The model name is matched without case.
 expect(rotation.choose('SADLER',4)).toBe(2);
});
test('a model with one variation or none never moves off it',()=>{
 const rotation=new VehicleColourRotation();
 expect([0,1,2].map(()=>rotation.choose('bobcat',1))).toEqual([0,0,0]);
 expect(rotation.choose('nocolours',0)).toBe(0);
 expect(rotation.choose('capped',20)).toBe(1);
 rotation.reset();expect(rotation.lastVariation('bobcat')).toBe(0);
 expect(MAX_COLOUR_VARIATIONS).toBe(8);
});
test("a paint matching the player's own car of that model advances once more",()=>{
 const rotation=new VehicleColourRotation();
 // Variation 1 is the player's, so the car takes 2 instead.
 expect(rotation.choose('sadler',4,{matchesPlayer:v=>v===1})).toBe(2);
 // The re-roll happens once only, even if the next one matches too.
 expect(rotation.choose('sadler',4,{matchesPlayer:()=>true})).toBe(0);
 // With one variation there is nothing to avoid.
 expect(rotation.choose('bobcat',1,{matchesPlayer:()=>true})).toBe(0);
});
test('the caller can shift by more than one, as the native callers could',()=>{
 const rotation=new VehicleColourRotation();
 expect([0,1,2].map(()=>rotation.choose('bus',5,{shift:2}))).toEqual([2,4,1]);
 expect(rotation.choose('bus',5,{shift:0})).toBe(1);
});
