import {expect,test} from 'vitest';
import {copReturnsToCar,lawVehicleWaits} from '../src/simulation/WorldPolice';

test('cops get back in beside their car while the suspect drives off in another vehicle',()=>{
 const base={wanted:2,carUsable:true,copToCar:3};
 // 5.48 m/s is |moveSpeed|² × TimeStep × 50 = 1 at 30 fps.
 expect(copReturnsToCar({...base,suspectCar:{speed:10,distanceToCop:6}})).toBe(true);
 expect(copReturnsToCar({...base,suspectCar:{speed:5,distanceToCop:6}})).toBe(false);
 expect(copReturnsToCar({...base,suspectCar:{speed:5,distanceToCop:11}})).toBe(true);
 expect(copReturnsToCar({...base,copToCar:4,suspectCar:{speed:10,distanceToCop:30}})).toBe(false);
 // On foot, or in a wrecked, burning or overturned police car, they keep up the pursuit.
 expect(copReturnsToCar(base)).toBe(false);
 expect(copReturnsToCar({...base,carUsable:false,suspectCar:{speed:10,distanceToCop:6}})).toBe(false);
});

test('a clear wanted level sends cops back to cars within the go-to-door range',()=>{
 expect(copReturnsToCar({wanted:0,carUsable:true,copToCar:30})).toBe(true);
 expect(copReturnsToCar({wanted:0,carUsable:true,copToCar:50})).toBe(false);
 expect(copReturnsToCar({wanted:0,carUsable:false,copToCar:5})).toBe(false);
});

test('law vehicles wait at the water\'s edge (CCarAI::UpdateCarAI TEMPACT_WAIT)',()=>{
 expect(lawVehicleWaits({wanted:2,unitBoat:false,player:'swimming'})).toBe(true);
 expect(lawVehicleWaits({wanted:2,unitBoat:false,player:'boat'})).toBe(true);
 expect(lawVehicleWaits({wanted:2,unitBoat:false,player:'land'})).toBe(false);
 expect(lawVehicleWaits({wanted:2,unitBoat:true,player:'land'})).toBe(true);
 expect(lawVehicleWaits({wanted:2,unitBoat:true,player:'swimming'})).toBe(false);
 expect(lawVehicleWaits({wanted:2,unitBoat:false,player:'aircraft'})).toBe(false);
 expect(lawVehicleWaits({wanted:0,unitBoat:false,player:'swimming'})).toBe(false);
});
