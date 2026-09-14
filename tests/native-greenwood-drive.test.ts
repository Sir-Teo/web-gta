import {openAsBlob,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Scene,Vector3} from 'three';
import {readImgIndex,readImgEntry} from '../src/assets/img';
import {readDff} from '../src/assets/dff';
import {readVehicleIde} from '../src/assets/vehicleIde';
import {readHandling} from '../src/assets/handling';
import {prepareHandling} from '../src/simulation/nativeHandling';
import {installNativeCar} from '../src/simulation/installNativeCar';
import type {NativeRaycastPlayerInput} from '../src/simulation/NativeRaycastVehicle';

test.skipIf(!process.env.GTA_CONTENT_DIR).each([{hz:30,sign:-1},{hz:30,sign:1},{hz:60,sign:-1},{hz:60,sign:1}])('original Greenwood settles, drives and brakes at $hz Hz / steering $sign',async({hz,sign})=>{
 await RAPIER.init();const depot=process.env.GTA_CONTENT_DIR!,archive=await openAsBlob(join(depot,'gta3.img')),entries=await readImgIndex(archive);
 const model=readDff(await readImgEntry(archive,entries.find(e=>e.name==='greenwoo.dff')!));
 const vehicle=readVehicleIde(readFileSync(join(depot,'vehicles/vehicles.ide'),'utf8')).records.find(r=>r.id===492)!;
 const row=readHandling(readFileSync(join(depot,'vehicles/handling.cfg'),'utf8')).records.find(r=>r.name===vehicle.handling)!;
 // Explicit inspected enum VT_GREENWOOD=68 (not inferred from vehicle ID or row order).
 const handling=prepareHandling(row,68),h=handling.values,world=new RAPIER.World({x:0,y:-9.81,z:0}),scene=new Scene();world.timestep=1/hz;
 world.createCollider(RAPIER.ColliderDesc.cuboid(1000,.1,1000).setTranslation(0,-.1,0));
 const car=installNativeCar(world,scene,{model,vehicle,handling,collision:model.embeddedCollisions![0]},
  {position:{x:0,y:1,z:0},rotation:{x:0,y:0,z:0,w:1}},{friction:.4,restitution:0});
 const input:NativeRaycastPlayerInput={
  gravity:{applyGravity:true,disableMoveForce:false,usesCollision:true},airResistance:{},
  pedals:{accelerate:0,brake:0,automaticallyHandbrake:false,handbrake:false,engineOn:true,drowning:false,driveByAim:false,rightShoulder:0,leftShoulder:0,unloadModel:false,forwardAllowed:true,reverseAllowed:true},
  steering:{steeringAxis:0,mouseDeltaX:0,mouseThirdPerson:false,mouseSteeringEnabled:false,vehicleMouseLook:false},
  steeringControl:{playerStatus:true,tarmacAdhesion:1},
  suspension:{mode:'normal',makeMassTwiceAsBig:false,frameLimit:1,springLimitMultiplier:2},
  tires:{velocityFrequency:1,playerControlled:true,vehicleGrip:{physicsStatus:false,perfectHandling:false,extraPerfectHandling:false,extraHandlingNitros:false,isPlayerVehicle:true,vortex:false,vortexAccelerationBrakeStatus:0},wheelParameters:{coastBrake:0,wheelDamageEffect:1,playerCollisions:false}},
  // Controlled diagnostic road: unit dry adhesion and level stationary fallback.
  // This is not a claim of native SURFINFO resolution for an included world area.
  resolveWheel:wheel=>({ground:{status:'normal',sandGroup:false,railTrack:false,rhino:false,wetRoads:0,rotation:0,wheelSpeed:0},suspension:{forceLevel:h.suspensionForce,bias:wheel.startsWith('front')?h.suspensionBias:1-h.suspensionBias,damping:h.suspensionDamping},surface:{adhesiveLimit:1,wetMultiplier:1,offRoad:false,burst:false},fallback:{normal:{x:0,y:0,z:1},groundSpeed:{x:0,y:0,z:0}}}),
 };
 let latch=false;world.step();
 const step=()=>{const result=car.stepPlayer(1/hz,input,latch);latch=result.alreadySkidding;world.step();car.update(1);expect([car.body.translation(),car.body.rotation(),car.body.linvel(),car.body.angvel()].flatMap(v=>Object.values(v)).every(Number.isFinite)).toBe(true);return result;};
 try{
  for(let i=0;i<hz*3;i++)step();const settled={...car.body.translation()};
  // Match the renderer traversal before querying matrix-owned imported frames.
  scene.updateMatrixWorld(true);
  // The native front/rear axle offsets differ slightly, allowing a small rest pitch.
  for(const name of ['wheel_lf_dummy','wheel_rf_dummy','wheel_lb_dummy','wheel_rb_dummy'])expect(Math.abs(car.root.getObjectByName(name)!.getWorldPosition(new Vector3()).y-.35)).toBeLessThan(.001);
  input.pedals.accelerate=255;for(let i=0;i<hz*3;i++)step();const peak=-car.body.linvel().z,brakeStart={...car.body.translation()};
  expect(car.wheelSnapshot().frontLeft.rotation).toBeLessThan(-1);expect(car.wheelSnapshot().rearRight.rotation).toBeLessThan(-1);
  input.pedals.accelerate=0;input.pedals.brake=255;let brakeTicks=0;
  while(-car.body.linvel().z>.6&&brakeTicks<hz*5){step();brakeTicks++;}
  const stopped={...car.body.translation()};console.log(JSON.stringify({hz,settled,peak,brakeStart,stopped,brakeTicks,velocity:car.body.linvel(),sources:car.sources.size}));
  // Four equal springs balance native gravity: stress=.008/(4*1.1*.5*.016).
  const equilibrium=.35-(-.35+.32)+(.32+.2)*(1-.008/(4*1.1*.5*.016));
  expect(settled.y).toBeCloseTo(equilibrium,4);expect(peak).toBeGreaterThan(3);expect(settled.z-brakeStart.z).toBeGreaterThan(3);expect(brakeTicks).toBeLessThan(hz*5);expect(Math.abs(car.body.linvel().z)).toBeLessThan(.6);
  expect(brakeStart.z-stopped.z).toBeGreaterThan(1);expect(brakeStart.z-stopped.z).toBeLessThan(6);
  expect(Math.abs(stopped.x)).toBeLessThan(.1);expect(car.sources.size).toBe(20);expect(car.root.position.toArray()).toEqual([stopped.x,stopped.y,stopped.z]);
  input.pedals.brake=0;input.pedals.accelerate=255;input.steering.steeringAxis=sign*64;
  for(let i=0;i<hz*3;i++)step();const turned={...car.body.translation()};
  expect(car.wheelSnapshot().frontLeft.steering*sign).toBeLessThan(0);expect(car.wheelSnapshot().rearRight.steering).toBe(0);
  expect((turned.x-stopped.x)*sign).toBeGreaterThan(.1);expect(car.snapshot().steering.raw*sign).toBeLessThan(0);
  expect(turned.y).toBeGreaterThan(.5);expect(turned.y).toBeLessThan(1);
  console.log(JSON.stringify({hz,sign,turned,rotation:car.body.rotation()}));
 }finally{car.dispose();expect(scene.children).toHaveLength(0);expect(world.bodies.len()).toBe(0);expect(world.colliders.len()).toBe(1);world.free();}
});
