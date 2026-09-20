import {expect,test} from 'vitest';
import {SpecificDrivers,CAB_DRIVER_MODELS} from '../src/simulation/nativeCarDrivers';

test('special cars take their own driver and the Freeway a biker on a third of the draws each',()=>{
 const drivers=new SpecificDrivers(()=>0.5);
 expect(drivers.forCar('stretch',1)).toBe('wmych');
 expect(drivers.forCar('MRWHOOP',1)).toBe('wmoice');
 expect(drivers.forCar('securica',1)).toBe('wmysgrd');
 expect(drivers.forCar('pizzaboy',1)).toBe('wmypizz');
 expect(drivers.forCar('bmx',1)).toBe('wmybmx');
 expect(drivers.forCar('greenwoo',1)).toBeUndefined();
 expect(drivers.forCar(undefined,1)).toBeUndefined();
 expect(new SpecificDrivers(()=>0.1).forCar('freeway',1)).toBe('bikera');
 expect(new SpecificDrivers(()=>0.4).forCar('freeway',1)).toBe('bikerb');
 expect(new SpecificDrivers(()=>0.9).forCar('freeway',1)).toBeUndefined();
});
test('the cab driver is drawn per city and kept until the city changes',()=>{
 const drivers=new SpecificDrivers(()=>0.9);
 expect(drivers.forCar('taxi',1)).toBe(CAB_DRIVER_MODELS[0][1]);
 expect(drivers.forCar('cabbie',1)).toBe(CAB_DRIVER_MODELS[0][1]);
 // The countryside keeps the last cab driver.
 expect(drivers.forCar('taxi',0)).toBe(CAB_DRIVER_MODELS[0][1]);
 expect(drivers.forCar('taxi',2)).toBe(CAB_DRIVER_MODELS[1][1]);
 expect(drivers.forCar('taxi',3)).toBe(CAB_DRIVER_MODELS[2][1]);
 expect(drivers.forCar('taxi',3)).toBe(CAB_DRIVER_MODELS[2][1]);
 // Before any city the original's index 0 names the first Los Santos cab driver.
 expect(new SpecificDrivers(()=>0.9).forCar('cabbie',0)).toBe(CAB_DRIVER_MODELS[0][0]);
});
