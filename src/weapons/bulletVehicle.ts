import type {Vec3} from '../core/math';
import type {WorldCar} from '../simulation/WorldCar';

/** CWorld::bIncludeCarTyres during CWeapon::FireInstantHit, for any shooter: the nearest car wheel sphere the shot
 * line meets before `reach`. `direction` is a unit vector. */
export function bulletTyreHit(cars:Iterable<WorldCar>,source:Vec3,direction:Vec3,reach:number){
 let best:{car:WorldCar;wheel:number;t:number}|undefined;
 for(const car of cars){
  if(car.wrecked||!car.car.body.isEnabled())continue;
  // FireInstantHit: a wheel piece is a hit only when BurstTyre would take it, so a burst or missing tyre, a Rhino's
  // and bTyresDontBurst leave the vehicle to the ordinary ray (or let the shot pass).
  if(car.modelId===432||car.tyresDontBurst)continue;
  const c=car.car.body.translation();if(Math.hypot(c.x-source.x,c.y-source.y,c.z-source.z)>reach+4)continue;
  for(const sphere of car.wheelSpheres()){
   if((car.damageState?.wheels[sphere.wheel]??0)!==0)continue;
   const oc={x:source.x-sphere.center.x,y:source.y-sphere.center.y,z:source.z-sphere.center.z};
   const b=oc.x*direction.x+oc.y*direction.y+oc.z*direction.z,k=oc.x*oc.x+oc.y*oc.y+oc.z*oc.z-sphere.radius*sphere.radius,disc=b*b-k;
   if(disc<0)continue;
   const t=-b-Math.sqrt(disc);
   if(t>=0&&t<(best?.t??reach))best={car,wheel:sphere.wheel,t};
  }
 }
 return best;
}

/** CWeapon::DoBulletImpact's vehicle push: ApplyForce(normal x k x min(1, mass / 1000)) at the hit point, k -20 for
 * the Desert Eagle and minigun, -4 for the shotgun and SPAS-12, -10 otherwise. */
export function pushShotVehicle(car:WorldCar,normal:Vec3,point:Vec3,weapon:number){
 const k=weapon===24||weapon===38?-20:weapon===25||weapon===27?-4:-10,{mass,turnMass}=car.nativeBody,f=k*Math.min(1,mass/1000);
 const force={x:normal.x*f,y:normal.y*f,z:normal.z*f},body=car.car.body,com=body.worldCom(),v=body.linvel(),w=body.angvel();
 const r={x:point.x-com.x,y:point.y-com.y,z:point.z-com.z},torque={x:r.y*force.z-r.z*force.y,y:r.z*force.x-r.x*force.z,z:r.x*force.y-r.y*force.x};
 // Native units per frame: 50 times that in m/s and rad/s.
 body.setLinvel({x:v.x+force.x/mass*50,y:v.y+force.y/mass*50,z:v.z+force.z/mass*50},true);
 body.setAngvel({x:w.x+torque.x/turnMass*50,y:w.y+torque.y/turnMass*50,z:w.z+torque.z/turnMass*50},true);
}
