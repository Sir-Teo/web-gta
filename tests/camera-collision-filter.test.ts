import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {currentShapeCast} from '../src/simulation/currentShapeCast';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

beforeAll(()=>RAPIER.init());
test('the camera cast can pass through chosen bodies and fixed colliders',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0});
 const wall=world.createCollider(RAPIER.ColliderDesc.cuboid(1,5,.2).setTranslation(0,0,-8));
 const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,0,-4));world.createCollider(RAPIER.ColliderDesc.cuboid(1,1,.2),body);
 world.step();
 const ball=new RAPIER.Ball(.2),cast=(ignore?:Parameters<typeof currentShapeCast>[10])=>currentShapeCast(world,{x:0,y:0,z:0},{x:0,y:0,z:0,w:1},{x:0,y:0,z:-1},ball,.03,12,undefined,undefined,undefined,ignore);
 expect(cast()).toBeCloseTo(3.6,1);
 expect(cast({body:b=>b.handle===body.handle})).toBeCloseTo(7.6,1);
 expect(cast({body:()=>true,fixed:c=>c.handle===wall.handle})).toBeUndefined();
 world.free();
});
test('CheckCameraCollisionPeds hides a ped within 1 unit of the camera that reaches its near clip, for the frame',()=>{
 const ped=(x:number,z:number)=>({view:{root:{visible:true}},actor:{player:{position:{x,y:0,z}}}});
 const close=ped(.3,-.2),behind=ped(3,0);
 const fake={people:[close,behind],cameraHidden:[] as unknown[]};
 // Camera at head height looking along -z; the close ped's spheres straddle the near plane.
 (WorldPedestrians.prototype as any).hideNearCamera.call(fake,{x:0,y:1.4,z:0},{x:0,y:0,z:-1},.08);
 expect(close.view.root.visible).toBe(false);expect(behind.view.root.visible).toBe(true);
 (WorldPedestrians.prototype as any).restoreCameraHidden.call(fake);
 expect(close.view.root.visible).toBe(true);
 // A ped a little ahead of the near clip stays drawn.
 const ahead=ped(0,-.9),f2={people:[ahead],cameraHidden:[] as unknown[]};
 (WorldPedestrians.prototype as any).hideNearCamera.call(f2,{x:0,y:1.4,z:0},{x:0,y:0,z:-1},.08);
 expect(ahead.view.root.visible).toBe(true);
});
