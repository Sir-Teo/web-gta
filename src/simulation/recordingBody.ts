import RAPIER from '@dimforge/rapier3d-compat';
import type {CarRecordingMatrix,CarRecordingVehicle} from '../engine/carRecordingPlayback';
/* A vehicle body as CVehicleRecording sees it. Native is x east, y north, z up; the renderer is (x, z, -y). A vehicle
 * body's front is its local -z, its right local +x and its up local +y, so the native rows are right-handed
 * (up = right x forward), as CMatrix's are.
 *
 * A playback without car AI sets bDisableCollisionForce and clears bCollidable. CPhysical's collision code then
 * treats the car like an immovable one: other things still hit it and bounce off, and nothing pushes it. Here that is
 * a kinematic body driven by its velocity, which pushes dynamic bodies and is moved by nothing but the recording. */
type V3=[number,number,number];
type Q={x:number;y:number;z:number;w:number};
const toNative=(v:{x:number;y:number;z:number}):V3=>[v.x,-v.z,v.y];
const toBrowser=(v:readonly number[])=>({x:v[0],y:v[2],z:-v[1]});
function rotate(q:Q,v:{x:number;y:number;z:number}){
 const t={x:2*(q.y*v.z-q.z*v.y),y:2*(q.z*v.x-q.x*v.z),z:2*(q.x*v.y-q.y*v.x)};
 return {x:v.x+q.w*t.x+q.y*t.z-q.z*t.y,y:v.y+q.w*t.y+q.z*t.x-q.x*t.z,z:v.z+q.w*t.z+q.x*t.y-q.y*t.x};
}
/** The native matrix of a body's rotation and translation. */
export function nativeMatrixOf(rotation:Q,translation:{x:number;y:number;z:number}):CarRecordingMatrix{
 return {right:toNative(rotate(rotation,{x:1,y:0,z:0})),forward:toNative(rotate(rotation,{x:0,y:0,z:-1})),
  up:toNative(rotate(rotation,{x:0,y:1,z:0})),position:toNative(translation)};
}
const norm=(v:{x:number;y:number;z:number})=>{const l=Math.hypot(v.x,v.y,v.z)||1;return {x:v.x/l,y:v.y/l,z:v.z/l};};
const cross=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
/** The body rotation for native right and forward rows. A recording's rows are bytes, and the interpolation between
 * frames shortens them, so they are made orthonormal first: forward kept, right taken square to it. */
export function rotationFromNativeRows(right:readonly number[],forward:readonly number[]):Q{
 const f=norm(toBrowser(forward)),r0=toBrowser(right),d=r0.x*f.x+r0.y*f.y+r0.z*f.z;
 const X=norm({x:r0.x-f.x*d,y:r0.y-f.y*d,z:r0.z-f.z*d}),Z={x:-f.x,y:-f.y,z:-f.z},Y=cross(Z,X);
 // A rotation matrix's quaternion, its columns X, Y and Z.
 const m00=X.x,m01=Y.x,m02=Z.x,m10=X.y,m11=Y.y,m12=Z.y,m20=X.z,m21=Y.z,m22=Z.z,trace=m00+m11+m22;
 if(trace>0){const s=.5/Math.sqrt(trace+1);return {w:.25/s,x:(m21-m12)*s,y:(m02-m20)*s,z:(m10-m01)*s};}
 if(m00>m11&&m00>m22){const s=2*Math.sqrt(1+m00-m11-m22);return {w:(m21-m12)/s,x:.25*s,y:(m01+m10)/s,z:(m02+m20)/s};}
 if(m11>m22){const s=2*Math.sqrt(1+m11-m00-m22);return {w:(m02-m20)/s,x:(m01+m10)/s,y:.25*s,z:(m12+m21)/s};}
 const s=2*Math.sqrt(1+m22-m00-m11);return {w:(m10-m01)/s,x:(m02+m20)/s,y:(m12+m21)/s,z:.25*s};
}
/** What a playback reaches through a vehicle: its body, whether it is burnt out, and the pedals it drives with. */
export interface RecordedVehicle {
 readonly body:RAPIER.RigidBody;
 readonly wrecked?:boolean;
 /** m_fSteerAngle, m_GasPedal, m_BrakePedal and bIsHandbrakeOn as the recording sets them; undefined gives the car
  * back to its own controls. */
 recordingControls?:{steerAngle:number;gas:number;brake:number;handbrake:boolean};
 /** m_autoPilot.m_vehicleRecordingId. */
 recordingSlot:number;
}
/** CVehicle's members, as CVehicleRecording reads and writes them. Move speeds are native units per 50 fps frame. */
export function recordingVehicle(v:RecordedVehicle):CarRecordingVehicle{
 const controls=()=>v.recordingControls??={steerAngle:0,gas:0,brake:0,handbrake:false};
 return {
  getMatrix:()=>nativeMatrixOf(v.body.rotation(),v.body.translation()),
  setMatrix:matrix=>{v.body.setTranslation(toBrowser(matrix.position),true);v.body.setRotation(rotationFromNativeRows(matrix.right,matrix.forward),true);},
  getMoveSpeed:()=>{const s=toNative(v.body.linvel());return [s[0]/50,s[1]/50,s[2]/50];},
  setMoveSpeed:speed=>{const s=toBrowser(speed);v.body.setLinvel({x:s.x*50,y:s.y*50,z:s.z*50},true);},
  resetTurnSpeed:()=>{v.body.setAngvel({x:0,y:0,z:0},true);},
  setSteerAngle:angle=>{controls().steerAngle=angle;},
  setGasPedal:power=>{controls().gas=power;},
  setBrakePedal:power=>{controls().brake=power;},
  setHandbrake:on=>{controls().handbrake=on;},
  get renderScorched(){return !!v.wrecked;},
  setDisableCollisionForce:on=>{
   const kinematic=v.body.bodyType()===RAPIER.RigidBodyType.KinematicVelocityBased;
   if(on&&!kinematic)v.body.setBodyType(RAPIER.RigidBodyType.KinematicVelocityBased,true);
   // Given back to physics, the car keeps the recording's speed and takes its own controls again.
   else if(!on&&kinematic){const speed=v.body.linvel();v.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);v.body.setLinvel(speed,true);v.recordingControls=undefined;}
  },
  setRecordingId:slot=>{v.recordingSlot=slot;if(slot<0)v.recordingControls=undefined;},
 };
}
