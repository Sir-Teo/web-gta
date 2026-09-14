import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Group,Quaternion,Vector3} from 'three';
import {Simulation,type Controls} from './helpers/Simulation';
import {interpolateVehiclePose} from '../src/render/vehiclePose';
import {captureSave,restoreSave} from './fixtures/physics-world/saves';
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

test('restored and reset vehicles synchronize offset collision shapes before physics steps',()=>{
  sim=new Simulation();const car=sim.vehicles[0],save=captureSave(sim);
  const record=save.vehicles.find(v=>v.id===car.id)!;record.position={x:70,y:4,z:40};record.rotation=yaw(Math.PI/2);
  const local=Array.from({length:car.body.numColliders()},(_,i)=>({position:{...car.body.collider(i).translationWrtParent()!},rotation:{...car.body.collider(i).rotationWrtParent()!}}));
  restoreSave(sim,save);
  expect(car.body.collider(0).intersectsShape(new RAPIER.Ball(.1),record.position,{x:0,y:0,z:0,w:1})).toBe(true);
  for(let i=0;i<local.length;i++){
    const collider=car.body.collider(i),expected=new Vector3(local[i].position.x,local[i].position.y,local[i].position.z).applyQuaternion(yaw(Math.PI/2)).add(new Vector3(70,4,40));
    expect(new Vector3().copy(collider.translation()).distanceTo(expected)).toBeLessThan(1e-5);
    expect(new Quaternion().copy(collider.rotation()).angleTo(yaw(Math.PI/2).multiply(new Quaternion().copy(local[i].rotation)))).toBeLessThan(.001);
    expect(collider.translationWrtParent()).toEqual(local[i].position);expect(collider.rotationWrtParent()).toEqual(local[i].rotation);
  }
  const traffic=sim.vehicles.find(v=>v.traffic)!;traffic.body.setTranslation({x:120,y:20,z:120},true);sim.world.step();sim.resetTraffic();
  expect(traffic.body.collider(0).translation()).toEqual(traffic.body.translation());
  expect(traffic.body.collider(0).rotation()).toEqual(traffic.body.rotation());
});

test('camera obstruction sees a restored car before physics and excludes the occupied car',()=>{
  sim=new Simulation();const car=sim.vehicles[0],save=captureSave(sim);
  const record=save.vehicles.find(v=>v.id===car.id)!;
  record.position={x:70,y:4,z:40};record.rotation=yaw(0);
  restoreSave(sim,save);
  const origin={x:70,y:4,z:35},direction={x:0,y:0,z:1};
  expect(sim.cameraDistance(origin,direction,10)).toBeLessThan(3);
  // At roof height only the offset cabin collider obstructs the boom.
  expect(sim.cameraDistance({...origin,y:4.8},direction,10)).toBeLessThan(4.1);
  car.body.setEnabled(false);
  expect(sim.cameraDistance(origin,direction,10)).toBe(10);
  car.body.setEnabled(true);
  sim.activeVehicle=car;
  expect(sim.cameraDistance(origin,direction,10)).toBe(10);
});

test('camera uses relocated pedestrian colliders and chooses the closest actor',()=>{
  sim=new Simulation();
  const origin={x:70,y:4,z:30},direction={x:0,y:0,z:1};
  const car=sim.vehicles[0],ped=sim.population.pedestrians[0];
  car.body.setTranslation({x:70,y:4,z:38},true);
  ped.body.setTranslation({x:70,y:4,z:34},true);
  sim.world.propagateModifiedBodyPositionsToColliders();
  const near=sim.cameraDistance(origin,direction,12);
  expect(near).toBeGreaterThan(3);expect(near).toBeLessThan(3.6);
  ped.collider.setEnabled(false);
  expect(sim.cameraDistance(origin,direction,12)).toBeGreaterThan(near+1);
});
