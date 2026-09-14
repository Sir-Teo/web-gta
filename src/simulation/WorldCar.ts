import {initialCarCollisionLighting,nativeCarContactBrightness} from './nativeCarContactLighting';
import {nativeContactLightMultiplier} from './nativeContactLighting';
import {NATIVE_CAR_WHEELS} from './nativeDriveContacts';
import {nativeSurfaceGrip} from './nativeSurfaceGrip';
import type {loadWorldRoadMaterials} from '../assets/worldRoadMaterials';
import RAPIER from '@dimforge/rapier3d-compat';
import type {Scene} from 'three';
import type {Simulation} from './Simulation';
import {installNativeCar,type NativeCarAssets} from './installNativeCar';
import type {NativeRaycastPlayerInput} from './NativeRaycastVehicle';
import type {NativeCollisionSource} from './nativeCollision';
/** Native car lifecycle in the streamed world. Entry is instantaneous pending native enter/exit animation support. */
export class WorldCar {
 readonly car:ReturnType<typeof installNativeCar>;
 readonly modelId:number;
 readonly name:string;
 occupied=false;
 private latch=false;
 private collisionLighting=initialCarCollisionLighting();
 private lastRoad=new Map<string,{normal:{x:number;y:number;z:number};groundSpeed:{x:number;y:number;z:number}}>();
 private input:NativeRaycastPlayerInput;
 private sourceOwner?:ReadonlyMap<number,{source:NativeCollisionSource}>;
 private sources=new Map<number,NativeCollisionSource>();
 constructor(private sim:Simulation,scene:Scene,assets:NativeCarAssets,position:{x:number;y:number;z:number},road:Awaited<ReturnType<typeof loadWorldRoadMaterials>>,heading=0){
  this.modelId=assets.vehicle.id;this.name=assets.vehicle.id===492?'Greenwood':assets.vehicle.model;
  this.car=installNativeCar(sim.world,scene,assets,{position,rotation:{x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)}},{friction:.4,restitution:0});
  const h=assets.handling.values;
  this.input={gravity:{applyGravity:true,disableMoveForce:false,usesCollision:true},airResistance:{},
   pedals:{accelerate:0,brake:0,automaticallyHandbrake:false,handbrake:true,engineOn:true,drowning:false,driveByAim:false,rightShoulder:0,leftShoulder:0,unloadModel:false,forwardAllowed:true,reverseAllowed:true},
   steering:{steeringAxis:0,mouseDeltaX:0,mouseThirdPerson:false,mouseSteeringEnabled:false,vehicleMouseLook:false},steeringControl:{playerStatus:true,tarmacAdhesion:1},
   suspension:{mode:'normal',makeMassTwiceAsBig:false,frameLimit:1,springLimitMultiplier:2},
   tires:{velocityFrequency:1,playerControlled:true,vehicleGrip:{physicsStatus:false,perfectHandling:false,extraPerfectHandling:false,extraHandlingNitros:false,isPlayerVehicle:true,vortex:false,vortexAccelerationBrakeStatus:0},wheelParameters:{coastBrake:0,wheelDamageEffect:1,playerCollisions:false}},
   // Exact native collision material and adhesion matrix; dry weather means wet-byte conversion has no effect.
   resolveWheel:(wheel,contact)=>{if(contact)this.lastRoad.set(wheel,{normal:{...contact.normal},groundSpeed:{...contact.groundSpeed}});return {ground:{status:'normal',sandGroup:false,railTrack:contact?.surface?.material===178,rhino:false,wetRoads:0,rotation:0,wheelSpeed:0},suspension:{forceLevel:h.suspensionForce,bias:wheel.startsWith('front')?h.suspensionBias:1-h.suspensionBias,damping:h.suspensionDamping},surface:nativeSurfaceGrip(contact?.surface?.material??0,road.records,road.rows,0,0,{burst:false}),fallback:this.lastRoad.get(wheel)};}};
 }
 distance(){const a=this.sim.player.position,b=this.car.body.translation();return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);}
 interact(){
  if(this.sim.player.health<=0)return '';
  if(this.occupied){
   if(this.car.body.linvel().x**2+this.car.body.linvel().z**2>4)return 'Stop the car before getting out.';
   const p=this.car.body.translation();
   for(const side of [-1,1]){
    const q=this.car.body.rotation(),local={x:side*2.3,y:0,z:0};
    const x=p.x+(1-2*(q.y*q.y+q.z*q.z))*local.x,z=p.z+2*(q.x*q.z-q.w*q.y)*local.x;
    const hit=this.sim.world.castRay(new RAPIER.Ray({x,y:p.y+3,z},{x:0,y:-1,z:0}),8,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
    if(!hit)continue;const foot={x,y:p.y+3-hit.timeOfImpact+.03,z},center={...foot,y:foot.y+.9};
    if(this.sim.world.intersectionWithShape(center,{x:0,y:0,z:0,w:1},new RAPIER.Capsule(.6,.3),undefined,undefined,this.sim.playerCollider,this.car.body))continue;
    this.occupied=false;this.sim.cameraExcludedBody=undefined;this.sim.playerCollider.setEnabled(true);this.sim.player.position=foot;this.sim.player.previous={...foot};this.sim.playerBody.setTranslation(center,true);this.sim.playerBody.setNextKinematicTranslation(center);this.sim.player.speed=0;this.sim.player.verticalSpeed=0;this.sim.player.grounded=true;return 'On foot';
   }return 'Both doors are blocked.';
  }
  if(this.distance()>4)return `Move closer to the ${this.name} to enter.`;
  this.sim.setCrouched(false);this.occupied=true;this.sim.cameraExcludedBody=this.car.body;this.sim.playerCollider.setEnabled(false);return `${this.name} · W/S drive · A/D steer · Space handbrake · F exit`;
 }
 beforeStep(seconds:number,axes:{x:number;y:number},handbrake:boolean,sources?:ReadonlyMap<number,{source:NativeCollisionSource}>){
  if(sources!==this.sourceOwner){this.sourceOwner=sources;this.sources=new Map([...(sources??[])].map(([id,value])=>[id,value.source]));}
  const nearby=this.occupied||this.distance()<100;this.car.body.setEnabled(nearby);this.car.root.visible=nearby;if(!nearby)return;
  const p=this.input.pedals;p.accelerate=this.occupied&&axes.y>0?255:0;p.brake=this.occupied&&axes.y<0?255:0;p.handbrake=!this.occupied||handbrake;this.input.steering.steeringAxis=this.occupied?axes.x*128:0;
  const result=this.car.stepPlayer(seconds,this.input,this.latch,{sources:this.sources,filter:c=>c.handle!==this.sim.playerCollider.handle});this.latch=result.alreadySkidding;
  for(const wheel of NATIVE_CAR_WHEELS){const lighting=result.sampled.geometry[wheel]?.surface?.light;if(lighting!==undefined)this.collisionLighting[wheel]=lighting;}
 }
 afterStep(){if(!this.occupied)return;const p=this.car.body.translation(),q=this.car.body.rotation(),player=this.sim.player;player.previous={...player.position};player.position={x:p.x,y:p.y,z:p.z};player.heading=Math.atan2(-2*(q.x*q.z+q.w*q.y),-(1-2*(q.x*q.x+q.y*q.y)));player.speed=Math.hypot(this.car.body.linvel().x,this.car.body.linvel().z);player.grounded=true;this.sim.playerBody.setTranslation({x:p.x,y:p.y+.9,z:p.z},true);this.sim.playerBody.setNextKinematicTranslation({x:p.x,y:p.y+.9,z:p.z});}
 setLighting(worldAmbient:readonly number[]|undefined,objectAmbient:readonly number[]|undefined,sunMultiplier:number,night:number){
  const contact=worldAmbient?nativeContactLightMultiplier(worldAmbient,nativeCarContactBrightness(this.collisionLighting,night)):1;
  this.car.setAmbient(objectAmbient,sunMultiplier*contact,contact);
 }
 dispose(){this.car.dispose();}
}
