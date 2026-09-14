import {readFileSync} from 'node:fs';
import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Scene,Matrix4,Mesh} from 'three';
import {readDff} from '../src/assets/dff';
import {readCol} from '../src/assets/col';
import {readVehicleIde} from '../src/assets/vehicleIde';
import {readHandling} from '../src/assets/handling';
import {prepareHandling} from '../src/simulation/nativeHandling';
import {installNativeCar} from '../src/simulation/installNativeCar';
let world:RAPIER.World;
beforeAll(async()=>{await RAPIER.init();});afterEach(()=>world?.free());
function assets(){
  const model=readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff')));
  for(const [name,x,y] of [['wheel_lf_dummy',-1,2],['wheel_lb_dummy',-1,-2],['wheel_rf_dummy',1,2],['wheel_rb_dummy',1,-2]] as const)model.frames.push({name,parent:0,matrix:new Matrix4().makeTranslation(x,y,0).toArray()});
  model.atomics.push({...model.atomics[0],frame:model.frames.findIndex(f=>f.name==='wheel_rf_dummy')});
  return {model,collision:readCol(new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v3.col')))[0],
    vehicle:readVehicleIde('cars\n492 diagnostic diagnostic car TEST TEST null normal 10 0 0 -1 1 1\nend').records[0],
    handling:prepareHandling(readHandling('TEST 1000 2000 0 0 0 0 75 .8 .9 .5 5 180 24 10 R P 8 .6 0 35 1.2 .15 .02 .25 -.25 .5 0 .25 .7 12345 0 0 1 2 3').records[0],0)};
}
const pose={position:{x:10,y:3,z:-20},rotation:{x:0,y:0,z:0,w:1}},response={friction:.4,restitution:0};
test('car assembly owns model, collision and controller and interpolates the shared chassis pose',()=>{
  world=new RAPIER.World({x:0,y:-9.81,z:0});const scene=new Scene(),car=installNativeCar(world,scene,assets(),pose,response);
  expect(scene.children).toContain(car.root);expect(car.sources.size).toBe(3);expect(car.root.position.toArray()).toEqual([10,3,-20]);
  for(const name of ['wheel_lf_dummy','wheel_lb_dummy','wheel_rf_dummy','wheel_rb_dummy'])expect(car.root.getObjectByName(name)!.children.filter(c=>c instanceof Mesh)).toHaveLength(1);
  expect(car.root.children[0].rotation.x).toBeCloseTo(-Math.PI/2,7);expect(car.snapshot().previousGas).toBe(0);
  car.body.setTranslation({x:20,y:3,z:-20},true);car.update(.5);expect(car.root.position.x).toBe(15);
  let disposedGeometry=false;car.root.traverse(o=>{if(o instanceof Mesh)o.geometry.addEventListener('dispose',()=>{disposedGeometry=true;});});
  car.dispose();car.dispose();expect(disposedGeometry).toBe(true);expect(scene.children).toHaveLength(0);expect(world.bodies.len()).toBe(0);expect(world.colliders.len()).toBe(0);
  expect(()=>car.update(1)).toThrow(/disposed/);
});
test('invalid wheel geometry rejects before installing scene or physical objects',()=>{
  world=new RAPIER.World({x:0,y:0,z:0});const scene=new Scene(),a=assets();a.model.frames.pop();
  expect(()=>installNativeCar(world,scene,a,pose,response)).toThrow(/wheel_rb_dummy/);expect(scene.children).toHaveLength(0);expect(world.bodies.len()).toBe(0);
});
test('a transformed scene root rejects instead of separating visible and physical poses',()=>{
  world=new RAPIER.World({x:0,y:0,z:0});const scene=new Scene();scene.position.x=2;
  expect(()=>installNativeCar(world,scene,assets(),pose,response)).toThrow(/untransformed/);expect(world.bodies.len()).toBe(0);
});
test('visual installation failure rolls back the already-created controller and chassis',()=>{
  world=new RAPIER.World({x:0,y:0,z:0});const scene=new Scene(),a=assets();a.model.frames[0].matrix[12]=1e8;
  expect(()=>installNativeCar(world,scene,a,pose,response)).toThrow(/coordinate limit/);
  expect(scene.children).toHaveLength(0);expect(world.bodies.len()).toBe(0);expect(world.colliders.len()).toBe(0);
});
test('car assembly applies and updates instance paint and rejects repaint after disposal',()=>{
 world=new RAPIER.World({x:0,y:0,z:0});const a=assets();
 a.model.geometries.forEach(g=>{g.flags|=64;g.materials.forEach(m=>m.color=[60,255,0,255]);});
 const car=installNativeCar(world,new Scene(),{...a,colors:[[10,20,30],[0,0,0],[0,0,0],[0,0,0]]},pose,response);
 const materials=new Set<any>();car.root.traverse(o=>{if(o instanceof Mesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});
 for(const m of materials)expect(m.color.toArray()).toEqual([10/255,20/255,30/255]);
 car.setColors([[40,50,60],[0,0,0],[0,0,0],[0,0,0]]);for(const m of materials)expect(m.color.toArray()).toEqual([40/255,50/255,60/255]);
 car.dispose();expect(()=>car.setColors([[0,0,0],[0,0,0],[0,0,0],[0,0,0]])).toThrow(/disposed/);
});
