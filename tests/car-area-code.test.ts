import {expect,test} from 'vitest';
import {WorldCar} from '../src/simulation/WorldCar';

const car=(areaCode:number,scriptVisible=true)=>({areaCode,scriptVisible,car:{root:{visible:true}}} as any);
const show=(c:any,area:number)=>{(WorldCar.prototype as any).showForArea.call(c,area);return c.car.root.visible;};
test('a car shows in the outside world everywhere, in an interior only while that interior shows',()=>{
 expect(show(car(0),0)).toBe(true);expect(show(car(0),3)).toBe(true);
 expect(show(car(3),0)).toBe(false);expect(show(car(3),3)).toBe(true);
 // SET_CAR_VISIBLE false keeps it hidden whatever the area.
 expect(show(car(3,false),3)).toBe(false);
});
