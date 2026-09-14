import {bindNativeCarPaint,type NativeCarColors} from '../render/nativeCarPaint';
import RAPIER from '@dimforge/rapier3d-compat';
import {Group,Matrix4,Quaternion,Vector3,type Scene,type Object3D} from 'three';
import type {Simulation} from './Simulation';
import type {openStaticWorldVehicles} from '../assets/staticWorldVehicles';
import {modelObject} from '../assets/ModelObjects';
import {nativeAmbientState} from '../assets/nativeMaterial';
import {installNativeVehicleBody} from './nativeVehicleBody';
import {prepareHandling} from './nativeHandling';
import {interpolateVehiclePose} from '../render/vehiclePose';
import {planeFlight,type PlaneControls} from './planeFlight';
import {requireAsset} from '../assets/binary';
import {stepPlaneWheelRoll,type PlaneWheelRoll} from './planeWheelRoll';
export const PLAYABLE_PLANES:Readonly<Record<number,string>>={476:'Rustler',511:'Beagle',512:'Cropduster',513:'Stuntplane',519:'Shamal',553:'Nevada',593:'Dodo'};
type Assets=Awaited<ReturnType<Awaited<ReturnType<typeof openStaticWorldVehicles>>['load']>>;
export class WorldPlane {
 readonly body:RAPIER.RigidBody;readonly root=new Group();readonly name:string;readonly modelId:number;
 occupied=false;gearUp=false;throttle=0;grounded=true;stall=false;airspeed=0;altitude=0;
 private physical:ReturnType<typeof installNativeVehicleBody>;private visual:ReturnType<typeof modelObject>;private ambient=nativeAmbientState();
 private previous:{x:number;y:number;z:number};private previousRotation:RAPIER.Rotation;
 private moving:{object:Object3D;base:Matrix4;kind:string}[]=[];private wheels:RAPIER.Collider[]=[];private propAngle=0;
 private inputs:PlaneControls={throttle:0,pitch:0,roll:0,rudder:0,brake:false};
 private rollingWheels:{object:Object3D;base:Matrix4;radius:number;previous:number;roll:PlaneWheelRoll}[]=[];
 constructor(private sim:Simulation,scene:Scene,readonly assets:Assets,position:{x:number;y:number;z:number},heading=0,colors?:NativeCarColors){
  requireAsset(PLAYABLE_PLANES[assets.vehicle.id]&&assets.collision&&assets.flyingHandling&&!assets.missingTextures.length,'Unresolved fixed-wing aircraft resources.');
  this.modelId=assets.vehicle.id;this.name=PLAYABLE_PLANES[this.modelId];
  this.physical=installNativeVehicleBody(sim.world,assets.collision!,prepareHandling(assets.handling,assets.flyingHandling!.handlingId),{position,rotation:{x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)}},{friction:.05,restitution:0});this.body=this.physical.body;
  const model={...assets.model,atomics:assets.model.atomics.map(a=>({...a,flags:/(_dam|_vlo|moving_prop)/i.test(assets.model.frames[a.frame].name)?0:a.flags}))};
  // Native plane models reuse a main wheel atomic at empty wheel dummy frames.
  const wheelAtomic=model.atomics.find(a=>/^wheel(?:\d|_[lr])?$/.test(model.frames[a.frame].name));
  if(wheelAtomic){for(const [index,frame] of model.frames.entries())if(/^wheel_.*_dummy$/.test(frame.name)&&!model.atomics.some(a=>{let at=a.frame;while(at>=0){if(at===index)return true;at=model.frames[at].parent;}return false;}))model.atomics.push({...wheelAtomic,frame:index});}
  this.visual=modelObject(model,assets.textures,undefined,undefined,{worldLighting:true,ambient:this.ambient});if(colors)bindNativeCarPaint(this.visual.materialBindings,assets.textures.find(t=>t.name==='vehiclelights128')).setColors(colors);this.root.add(this.visual.root);scene.add(this.root);
  this.visual.root.updateMatrixWorld(true);
  const seen=new Set<string>();
  this.visual.root.traverse(object=>{
   const name=object.name.toLowerCase();if(object.userData.nativeFrame===undefined)return;
   if(/^(static_prop|aileron_|elevator|rudder$|gear_)/.test(name))this.moving.push({object,base:object.matrix.clone(),kind:name});
   if(/^wheel_.*_dummy$/.test(name)){
    const p=new Vector3().setFromMatrixPosition(object.matrixWorld); // root is identity here; visual basis already converts native axes.
    const key=[p.x,p.y,p.z].map(n=>n.toFixed(2)).join(',');if(seen.has(key))return;seen.add(key);
    const radius=Math.max(.15,(assets.vehicle.frontWheelSize??.6)*.5);
    this.rollingWheels.push({object,base:object.matrix.clone(),radius,previous:0,roll:{angle:0,speed:0}});
    this.wheels.push(sim.world.createCollider(RAPIER.ColliderDesc.ball(radius).setTranslation(p.x,p.y,p.z).setDensity(0).setFriction(.02).setRestitution(0),this.body));
   }
  });
  this.previous={...position};this.previousRotation={...this.body.rotation()};this.update(1);
 }
 distance(){const p=this.sim.player.position,b=this.body.translation();return Math.hypot(p.x-b.x,p.y-b.y,p.z-b.z);}
 interact(){
  if(this.sim.player.health<=0)return '';
  if(this.occupied){
   if(!this.grounded||new Vector3().copy(this.body.linvel()).length()>2)return 'Land and stop before leaving the plane.';
   const p=this.body.translation(),q=new Quaternion().copy(this.body.rotation());
   for(const side of [-1,1]){
    const out=new Vector3(side*(this.assets.collision!.bounds.max[0]+1.5),2,0).applyQuaternion(q).add(new Vector3().copy(p));
    const hit=this.sim.world.castRay(new RAPIER.Ray(out,{x:0,y:-1,z:0}),12,true,RAPIER.QueryFilterFlags.ONLY_FIXED);if(!hit)continue;
    const foot={x:out.x,y:out.y-hit.timeOfImpact+.04,z:out.z},center={...foot,y:foot.y+.9};
    if(this.sim.world.intersectionWithShape(center,{x:0,y:0,z:0,w:1},new RAPIER.Capsule(.6,.3),undefined,undefined,this.sim.playerCollider,this.body))continue;
    this.occupied=false;this.throttle=0;this.sim.cameraExcludedBody=undefined;this.sim.playerCollider.setEnabled(true);this.sim.player.position=foot;this.sim.player.previous={...foot};this.sim.playerBody.setTranslation(center,true);this.sim.playerBody.setNextKinematicTranslation(center);this.sim.player.speed=0;this.sim.player.verticalSpeed=0;this.sim.player.grounded=true;return 'On foot';
   }return 'No clear ground beside the plane.';
  }
  if(this.distance()>Math.max(5,this.assets.collision!.bounds.radius))return `Move closer to the ${this.name}.`;
  this.sim.setCrouched(false);this.occupied=true;this.sim.playerCollider.setEnabled(false);this.sim.cameraExcludedBody=this.body;this.afterStep();return `${this.name} · W/S throttle · ↑/↓ pitch · A/D bank · Q/E rudder · G gear · Space brake · F exit`;
 }
 toggleGear(){if(!this.assets.model.frames.some(f=>f.name.startsWith('gear_')))return 'This aircraft has fixed landing gear.';if(this.grounded)return 'Take off before retracting the landing gear.';this.gearUp=!this.gearUp;for(const c of this.wheels)c.setEnabled(!this.gearUp);return `Landing gear ${this.gearUp?'up':'down'}`;}
 beforeStep(dt:number,input:{throttle:number;pitch:number;roll:number;rudder:number;brake:boolean}){
  const nearby=this.occupied||this.distance()<250;this.body.setEnabled(nearby);this.root.visible=nearby;if(!nearby)return;
  this.previous={...this.body.translation()};this.previousRotation={...this.body.rotation()};
  const p=this.body.translation(),hit=this.sim.world.castRay(new RAPIER.Ray(p,{x:0,y:-1,z:0}),3000,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
  this.altitude=hit?hit.timeOfImpact:Math.max(0,p.y);const clearance=Math.max(1.5,-this.assets.collision!.bounds.min[2]+.8);this.grounded=!!hit&&hit.timeOfImpact<clearance;
  if(this.occupied)this.throttle=Math.max(0,Math.min(1,this.throttle+input.throttle*dt*.4));else this.throttle=0;
  this.inputs={throttle:this.throttle,pitch:this.occupied?input.pitch:0,roll:this.occupied?input.roll:0,rudder:this.occupied?input.rudder:0,brake:!this.occupied||input.brake};
  const result=planeFlight(this.body.linvel(),this.body.rotation(),this.inputs,this.assets.flyingHandling!,this.gearUp,this.grounded);this.airspeed=result.speed;this.stall=result.stall;
  const forwardSpeed=-new Vector3().copy(this.body.linvel()).applyQuaternion(new Quaternion().copy(this.body.rotation()).invert()).z;
  for(const wheel of this.rollingWheels){wheel.previous=wheel.roll.angle;wheel.roll=stepPlaneWheelRoll(wheel.roll,forwardSpeed,wheel.radius,this.grounded&&!this.gearUp,dt);}
  const v=this.body.linvel();this.body.setLinvel({x:v.x+result.acceleration.x*dt,y:v.y+result.acceleration.y*dt,z:v.z+result.acceleration.z*dt},true);
  this.body.setAngvel(result.angular,true);this.propAngle=(this.propAngle+dt*(5+this.throttle*90))%(Math.PI*2);
 }
 afterStep(){if(!this.occupied)return;const p=this.body.translation(),q=this.body.rotation(),player=this.sim.player;player.previous={...player.position};player.position={...p};player.heading=Math.atan2(-2*(q.x*q.z+q.w*q.y),-(1-2*(q.x*q.x+q.y*q.y)));player.speed=this.airspeed;player.grounded=this.grounded;this.sim.playerBody.setTranslation({x:p.x,y:p.y+.9,z:p.z},true);this.sim.playerBody.setNextKinematicTranslation({x:p.x,y:p.y+.9,z:p.z});}
 update(alpha:number){
  for(const wheel of this.rollingWheels){wheel.object.visible=!this.gearUp;wheel.object.matrix.copy(wheel.base).multiply(new Matrix4().makeRotationX(wheel.previous+(wheel.roll.angle-wheel.previous)*alpha));}
  interpolateVehiclePose(this.root,{body:this.body,previous:this.previous,previousRotation:this.previousRotation},alpha);
  for(const {object,base,kind} of this.moving){object.visible=!kind.startsWith('gear_')||!this.gearUp;const angle=kind.startsWith('static_prop')?this.propAngle:kind.startsWith('aileron')?this.inputs.roll*.3*(kind.endsWith('_l')?1:-1):kind.startsWith('elevator')?this.inputs.pitch*.3:kind==='rudder'?this.inputs.rudder*.3:0;object.matrix.copy(base).multiply(kind.startsWith('static_prop')?new Matrix4().makeRotationY(angle):kind==='rudder'?new Matrix4().makeRotationZ(angle):new Matrix4().makeRotationX(angle));}
 }
 setLighting(rgb:readonly number[]|undefined,multiplier:number,night:number){if(rgb)this.ambient.color.value.set(rgb[0]*multiplier,rgb[1]*multiplier,rgb[2]*multiplier);this.ambient.enabled.value=!!rgb;this.visual.setNight(night);}
 snapshot(){return {modelId:this.modelId,name:this.name,occupied:this.occupied,gearUp:this.gearUp,throttle:this.throttle,grounded:this.grounded,stall:this.stall,airspeed:this.airspeed,altitude:this.altitude,position:{...this.body.translation()},rotation:{...this.body.rotation()},velocity:{...this.body.linvel()}};}
 dispose(){this.root.removeFromParent();this.visual.dispose();this.physical.dispose();}
}
