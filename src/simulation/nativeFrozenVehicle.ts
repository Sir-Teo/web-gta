import RAPIER from '@dimforge/rapier3d-compat';
/** FREEZE_CAR_POSITION holds motion without removing the vehicle from world collision. Rapier's kinematic body
 * represents that physical constraint; the prior body mode is restored when the script releases it. */
const held=new WeakMap<RAPIER.RigidBody,{type:RAPIER.RigidBodyType}>();
export function syncFrozenVehicle(body:RAPIER.RigidBody,frozen:boolean,preserveKinematic=false){
 const state=held.get(body);
 if(!frozen&&!state)return false;
 if(!body.isValid())return false;
 if(frozen){
  if(!state)held.set(body,{type:body.bodyType()});
  else if(body.bodyType()!==RAPIER.RigidBodyType.KinematicPositionBased)state.type=body.bodyType();
  if(body.bodyType()!==RAPIER.RigidBodyType.KinematicPositionBased)body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);
  body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true);
  body.setNextKinematicTranslation(body.translation());body.setNextKinematicRotation(body.rotation());
 }else if(state){
  // Playback may have taken a different body mode while frozen. An attachment can own the same kinematic mode;
  // the host tells release to leave it in place rather than restoring the pre-attachment dynamic mode.
  if(!preserveKinematic&&body.bodyType()===RAPIER.RigidBodyType.KinematicPositionBased)body.setBodyType(state.type,true);
  held.delete(body);
 }
 return frozen;
}
