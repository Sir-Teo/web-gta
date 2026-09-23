import RAPIER from '@dimforge/rapier3d-compat';
import {Box3,Matrix4,Quaternion,Vector3,type Object3D,type Scene} from 'three';
/** CAutomobile::SpawnFlyingComponent collision types. */
export const FLYING={bumper:0,wheel:1,door:2,bonnet:3,boot:4,panel:5} as const;
interface Debris {object:Object3D;body:RAPIER.RigidBody;removeAt:number}
/** Browser-wide CObject::nNoTempObjects. */
let temporaryObjects=0;
const NATIVE_GRAVITY=.008*50*50;
/** Temporary 10 kg component objects thrown off damaged cars (mass 10, turn mass 25, air resistance 0.97, elasticity 0.1).
 * They collide with static scenery only, standing in for m_pEntityIgnoredCollision and the TEMPCOL models. */
export class FlyingComponents {
 private items:Debris[]=[];private seconds=0;
 constructor(private world:RAPIER.World,private scene:Scene){}
 get count(){return this.items.length;}
 /** `car` values are browser-space: m/s, rad/s and unit axes. */
 spawn(source:{object:Object3D;matrixWorld:Matrix4},type:number,car:{position:{x:number;y:number;z:number};velocity:{x:number;y:number;z:number};angularVelocity:{x:number;y:number;z:number};up:Vector3;wrecked:boolean;camera?:Vector3}){
  if(temporaryObjects>=150)return undefined;
  const position=new Vector3(),rotation=new Quaternion(),scale=new Vector3();source.matrixWorld.decompose(position,rotation,scale);
  const object=source.object;object.matrixAutoUpdate=true;object.position.copy(position);object.quaternion.copy(rotation);
  const bounds=new Box3();object.updateMatrixWorld(true);
  for(const child of object.children){child.updateMatrixWorld(true);const geometry=(child as {geometry?:{boundingBox:Box3|null;computeBoundingBox():void}}).geometry;if(!geometry)continue;if(!geometry.boundingBox)geometry.computeBoundingBox();bounds.union(geometry.boundingBox!.clone().applyMatrix4(child.matrix));}
  if(bounds.isEmpty())return undefined;
  temporaryObjects++;
  const lifetime=temporaryObjects<=10?20:temporaryObjects<=20?10:4;
  const up=car.up,flipped=up.y<0,v=car.velocity,speed2D=Math.hypot(v.x,v.z)/50;
  // Native z (browser y) rule, in units per frame converted to m/s.
  const vy=v.y<=0?(flipped&&(type===FLYING.bonnet||type===FLYING.boot)?(.04-v.y/50*1.5)*50:v.y/4):v.y*1.5;
  const direction=position.clone().sub(new Vector3(car.position.x,car.position.y,car.position.z)).normalize();
  if(type===FLYING.bonnet||type===FLYING.boot){direction.add(up);if(!flipped)position.addScaledVector(up,speed2D);}
  const velocity=new Vector3(v.x*.75,vy,v.z*.75).addScaledVector(direction,.1*50);
  if(car.wrecked&&car.camera){const toCamera=car.camera.clone().sub(new Vector3(car.position.x,car.position.y,car.position.z));if(direction.dot(toCamera)>-.5){toCamera.normalize();toCamera.y+=.3;velocity.addScaledVector(toCamera,.5*50);}}
  const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x,position.y,position.z).setRotation(rotation).setLinvel(velocity.x,velocity.y,velocity.z)
   .setAngvel({x:car.angularVelocity.x*2,y:car.angularVelocity.y*2,z:car.angularVelocity.z*2}).setLinearDamping(-50*Math.log(type===FLYING.wheel?.99:.97)).setAngularDamping(-50*Math.log(.97)).setGravityScale(NATIVE_GRAVITY/9.81).setCcdEnabled(true));
  // The body carries the component frame's world rotation, so the box is expressed in native frame space.
  const size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
  const desc=RAPIER.ColliderDesc.cuboid(Math.max(.03,size.x/2),Math.max(.03,size.y/2),Math.max(.03,size.z/2)).setTranslation(center.x,center.y,center.z).setMass(10).setRestitution(.1).setFriction(.6).setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.DYNAMIC_FIXED);
  this.world.createCollider(desc,body);
  this.scene.add(object);this.items.push({object,body,removeAt:this.seconds+lifetime});return body;
 }
 step(dt:number){
  this.seconds+=dt;
  this.items=this.items.filter(item=>{if(item.removeAt>this.seconds)return true;this.remove(item);return false;});
 }
 sync(){for(const {object,body} of this.items){const p=body.translation(),q=body.rotation();object.position.set(p.x,p.y,p.z);object.quaternion.set(q.x,q.y,q.z,q.w);}}
 snapshot(){return this.items.map(item=>({position:{...item.body.translation()},sleeping:item.body.isSleeping(),remaining:item.removeAt-this.seconds}));}
 private remove(item:Debris){item.object.removeFromParent();this.world.removeRigidBody(item.body);temporaryObjects=Math.max(0,temporaryObjects-1);}
 dispose(){for(const item of this.items)this.remove(item);this.items=[];}
}
