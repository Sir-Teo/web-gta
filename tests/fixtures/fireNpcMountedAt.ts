import type {RAPIER} from './native-render-dependencies';
type V={x:number;y:number;z:number};
/** Drive the public scripted Hunter-gun path from a chosen horizontal muzzle line, preserving its native offset. */
export function fireNpcMountedAt(g:any,source:V,direction:V,rapier:typeof RAPIER){
 return fireMountedAt(g,source,direction,rapier,false);
}
/** The same public scripted Hunter-gun command with its player/NPC attribution supplied by the trial. */
export function fireMountedAt(g:any,source:V,direction:V,rapier:typeof RAPIER,byPlayer:boolean,playerDriver=false){
 const body=g.sim.world.createRigidBody(rapier.RigidBodyDesc.fixed());
 const matrix={right:{x:-direction.z,y:-direction.x,z:0},forward:{x:direction.x,y:-direction.z,z:direction.y},up:{x:0,y:0,z:1},position:{x:source.x-direction.x*4.8,y:-source.z+direction.z*4.8,z:source.y+1.3}};
 try{return g.weapons().fireHunterGun({occupied:playerDriver},body,matrix,151,1,byPlayer);}finally{g.sim.world.removeRigidBody(body);}
}
