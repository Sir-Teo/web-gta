import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Group,Quaternion,Vector3} from 'three';
import {Simulation,type Controls} from '../src/simulation/Simulation';
import {interpolateVehiclePose} from '../src/render/vehiclePose';
import {captureSave,restoreSave} from '../src/persistence/saves';
let sim:Simulation;
const controls:Controls={x:0,y:0,sprint:false,jump:false,handbrake:false,cameraYaw:0};
const yaw=(angle:number)=>new Quaternion().setFromAxisAngle(new Vector3(0,1,0),angle);
beforeAll(async()=>{await RAPIER.init();});afterEach(()=>sim?.dispose());
test('vehicle render interpolates position and shortest-path rotation at the same alpha',()=>{
  sim=new Simulation();const car=sim.vehicles[0],root=new Group();
  car.previous={x:0,y:0,z:0};car.previousRotation=yaw(170*Math.PI/180);
  car.body.setTranslation({x:10,y:2,z:4},true);car.body.setRotation(yaw(-170*Math.PI/180),true);
  interpolateVehiclePose(root,car,0);expect(root.position.x).toBe(0);expect(root.quaternion.angleTo(yaw(170*Math.PI/180))).toBeLessThan(.001);
  interpolateVehiclePose(root,car,.5);expect(root.position.toArray()).toEqual([5,1,2]);expect(root.quaternion.angleTo(yaw(Math.PI))).toBeLessThan(.001);
  interpolateVehiclePose(root,car,1);expect(root.position.x).toBe(10);expect(root.quaternion.angleTo(yaw(-170*Math.PI/180))).toBeLessThan(.001);
});
test('simulation captures pre-step vehicle rotation independently of the live body',()=>{
  sim=new Simulation();const car=sim.vehicles[0];car.body.setTranslation({x:0,y:10,z:0},true);car.body.setRotation(yaw(.4),true);car.body.setAngvel({x:0,y:3,z:0},true);
  const before={...car.body.rotation()};sim.step(1/60,controls);
  expect(car.previousRotation).toEqual(before);expect(car.body.rotation().y).not.toBe(before.y);
});
test('save restore and traffic reset discard old render rotation history',()=>{
  sim=new Simulation();const car=sim.vehicles[0];car.body.setRotation(yaw(.7),true);const save=captureSave(sim);
  car.previousRotation=yaw(-2);car.body.setRotation(yaw(-2),true);restoreSave(sim,save);
  expect(car.previousRotation).toEqual(car.body.rotation());
  const traffic=sim.vehicles.find(v=>v.traffic)!;traffic.previousRotation=yaw(-2);sim.resetTraffic();expect(traffic.previousRotation).toEqual(traffic.body.rotation());
});
