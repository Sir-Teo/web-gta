import {test,expect,beforeAll} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Group,Mesh,Scene,Vector3} from 'three';
import {interpolateVehiclePose} from '../src/render/vehiclePose';

beforeAll(async()=>{await RAPIER.init();});

test('a moving vehicle body follows its root even when a seat query runs before the render',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0}),body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,1,0));
 const scene=new Scene();scene.matrixAutoUpdate=false;
 // As installNativeCar builds it: a pose root over a static model root over static frames.
 const root=new Group(),model=new Group(),frame=new Group(),mesh=new Mesh();
 for(const o of [model,frame,mesh])o.matrixAutoUpdate=false;
 frame.add(mesh);model.add(frame);root.add(model);scene.add(root);
 const vehicle={body,previous:{x:0,y:1,z:0},previousRotation:{x:0,y:0,z:0,w:1}};
 interpolateVehiclePose(root,vehicle,1);scene.updateMatrixWorld();
 body.setTranslation({x:0,y:1,z:-12},true);
 interpolateVehiclePose(root,vehicle,1);
 // VehicleOccupants seats the driver with localToWorld, which clears the root's dirty flag in three r186.
 root.localToWorld(new Vector3());
 scene.updateMatrixWorld();
 expect(new Vector3().setFromMatrixPosition(mesh.matrixWorld).z).toBeCloseTo(-12);
 world.free();
});

test('a parked vehicle does not recompose its root',()=>{
 const world=new RAPIER.World({x:0,y:0,z:0}),body=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(3,0,0));
 const root=new Group(),vehicle={body,previous:{x:3,y:0,z:0},previousRotation:{x:0,y:0,z:0,w:1}};
 interpolateVehiclePose(root,vehicle,1);
 let composed=0;const original=root.updateMatrix.bind(root);root.updateMatrix=()=>{composed++;original();};
 for(let i=0;i<5;i++)interpolateVehiclePose(root,vehicle,.5);
 expect(composed).toBe(0);
 world.free();
});
