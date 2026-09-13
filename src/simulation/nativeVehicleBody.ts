import RAPIER from '@dimforge/rapier3d-compat';
import type {Vec3} from '../core/math';
import type {ColModel} from '../assets/col';
import {requireAsset} from '../assets/binary';
import type {prepareHandling} from './nativeHandling';
import type {NativeCollisionSource} from './nativeCollision';
/** Dynamic COL adapter. Pose uses browser axes; source geometry/COM convert once.
 * Rapier contact friction/restitution are explicit approximations, not SURFINFO. */
export function installNativeVehicleBody(world:RAPIER.World,model:ColModel,handling:ReturnType<typeof prepareHandling>,pose:{position:Vec3;rotation:RAPIER.Rotation},contact:{friction:number;restitution:number}){
  const h=handling.values,p=pose.position,q=pose.rotation;
  requireAsset([p.x,p.y,p.z,q.x,q.y,q.z,q.w,h.mass,h.turnMass,h.centerOfMassX,h.centerOfMassY,h.centerOfMassZ,contact.friction,contact.restitution].every(n=>Number.isFinite(Math.fround(n))),'Nonfinite vehicle body input.');
  requireAsset(h.mass>0&&h.turnMass>0&&Math.abs(q.x*q.x+q.y*q.y+q.z*q.z+q.w*q.w-1)<1e-5&&contact.friction>=0&&contact.restitution>=0&&contact.restitution<=1,'Invalid vehicle mass, pose or collision response.');
  requireAsset(model.spheres.length+model.boxes.length+Number(model.mesh.indices.length>0)>0,'Vehicle requires physical collision geometry.');
  requireAsset(model.spheres.length+model.boxes.length<=4096&&model.mesh.indices.length<=1500000,'Vehicle collision geometry exceeds limits.');
  model=structuredClone(model);
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x,p.y,p.z).setRotation(q).setGravityScale(0).setLinearDamping(0).setAngularDamping(0).setCcdEnabled(true)
    .setAdditionalMassProperties(h.mass,{x:h.centerOfMassX,y:h.centerOfMassZ,z:-h.centerOfMassY},{x:h.turnMass,y:h.turnMass,z:h.turnMass},{x:0,y:0,z:0,w:1}));
  const sources=new Map<number,NativeCollisionSource>();let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;sources.clear();if(body.isValid())world.removeRigidBody(body);};
  const add=(desc:RAPIER.ColliderDesc,source:NativeCollisionSource)=>{const collider=world.createCollider(desc.setDensity(0).setFriction(contact.friction).setRestitution(contact.restitution),body);sources.set(collider.handle,source);};
  try{
    model.spheres.forEach((sphere,index)=>{requireAsset(Number.isFinite(Math.fround(sphere.radius))&&sphere.radius>0&&sphere.center.length===3&&sphere.center.every(n=>Number.isFinite(Math.fround(n))),'Invalid vehicle collision sphere.');add(RAPIER.ColliderDesc.ball(sphere.radius).setTranslation(sphere.center[0],sphere.center[2],-sphere.center[1]),{kind:'sphere',index,surface:sphere.surface});});
    model.boxes.forEach((box,index)=>{
      const half=box.max.map((n,i)=>(n-box.min[i])/2),center=box.max.map((n,i)=>(n+box.min[i])/2);
      requireAsset(half.every(n=>Number.isFinite(n)&&n>0)&&center.every(Number.isFinite),'Invalid vehicle collision box.');
      add(RAPIER.ColliderDesc.cuboid(half[0],half[2],half[1]).setTranslation(center[0],center[2],-center[1]),{kind:'box',index,surface:box.surface});
    });
    if(model.mesh.indices.length){
      const m=model.mesh,vertices=new Float32Array(m.positions.length);
      requireAsset(vertices.length%3===0&&m.indices.length%3===0&&m.indices.every(i=>i<vertices.length/3)&&m.positions.every(Number.isFinite),'Invalid vehicle collision mesh.');
      for(let i=0;i<vertices.length;i+=3){vertices[i]=m.positions[i];vertices[i+1]=m.positions[i+2];vertices[i+2]=-m.positions[i+1];}
      add(RAPIER.ColliderDesc.trimesh(vertices,m.indices),{kind:'mesh',mesh:m});
    }
    body.recomputeMassPropertiesFromColliders();
  }catch(error){dispose();throw error;}
  return {body,sources,dispose};
}
