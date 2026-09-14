import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation,type Controls} from './helpers/Simulation';
const controls:Controls={x:0,y:0,sprint:false,jump:false,handbrake:false,cameraYaw:0};
let sim:Simulation;
beforeAll(async()=>{await RAPIER.init();});afterEach(()=>sim?.dispose());
function setup(){sim=new Simulation();const car=sim.vehicles[0];sim.activeVehicle=car;car.body.setTranslation({x:0,y:10,z:0},true);car.body.setRotation({x:0,y:0,z:0,w:1},true);return car;}
test('playable reverse-to-forward input brakes instead of applying forward engine force',()=>{
  const car=setup();car.body.setLinvel({x:0,y:0,z:-10},true);sim.step(1/60,{...controls,y:1});
  expect(car.controller.wheelEngineForce(2)).toBe(0);expect(car.controller.wheelBrake(0)).toBe(170);expect(car.brakeLights).toBe(true);
});
test('playable brake threshold uses projected native speed and maps analog pressure',()=>{
  const car=setup();car.body.setLinvel({x:0,y:0,z:.6},true);sim.step(1/60,{...controls,y:-.5});
  expect(car.controller.wheelEngineForce(2)).toBe(0);expect(car.controller.wheelBrake(0)).toBeCloseTo(170*128/255,4);
  car.body.setRotation({x:0,y:0,z:0,w:1},true);car.body.setLinvel({x:10,y:0,z:0},true);sim.step(1/60,{...controls,y:-1});
  expect(car.controller.wheelEngineForce(2)).toBe(-2600);expect(car.controller.wheelBrake(0)).toBe(0);
});
test('playable steering accumulates native pad input before squaring and recenters through raw state',()=>{
  const car=setup();sim.step(1/60,{...controls,x:1});
  const first=-.48*(1/6)**2;expect(car.steer).toBeCloseTo(first,6);expect(car.controller.wheelSteering(0)).toBeCloseTo(first,6);expect(car.controller.wheelSteering(2)).toBe(0);
  const speed=car.controller.currentVehicleSpeed(),limit=.48/(1+Math.abs(speed)*.045);
  sim.step(1/60,controls);expect(car.steer).toBeCloseTo(-limit*(5/36)**2,6);
});
