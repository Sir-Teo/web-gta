import * as THREE from 'three';
import {NativeImmediateTriangles} from './NativeImmediateTriangles';
/* CVehicle::DoHeadLightBeam (gta-reversed ead3051): a white RwIm3D fan in front of each lit headlight, 3 units
 * long along the forward tilted down by 0.15 (0.5 for forklifts), 0.1 wide at the lamp and 1 wide at the end, faded
 * to nothing at the far edge, additive (SRCALPHA, ONE), no depth write, alpha (1 − |dot(lamp→camera, forward)|) × 32.
 * The bike's Render draws it for the front lamp; CAutomobile::Render is a retail stub, so cars draw both lamps by
 * the same rule (authored), the second lamp at the dummy mirrored across the car's right axis. Renderer space. */
export const HEADLIGHT_BEAM_LENGTH=3,HEADLIGHT_BEAM_TILT=0.15,HEADLIGHT_BEAM_MAX_ALPHA=32;
export interface BeamInput {point:{x:number;y:number;z:number};forward:{x:number;y:number;z:number};up:{x:number;y:number;z:number};camera:{x:number;y:number;z:number};tilt?:number}
const norm=(v:{x:number;y:number;z:number})=>{const l=Math.hypot(v.x,v.y,v.z)||1;return {x:v.x/l,y:v.y/l,z:v.z/l};};
const cross=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
/** One beam's four triangles as flat positions (12 vertices) and byte colours; empty when the alpha rounds to 0. */
export function headlightBeam(input:BeamInput){
 const {point,forward,up,camera}=input,tilt=input.tilt??HEADLIGHT_BEAM_TILT;
 const toCam=norm({x:camera.x-point.x,y:camera.y-point.y,z:camera.z-point.z});
 const alpha=Math.trunc((1-Math.abs(toCam.x*forward.x+toCam.y*forward.y+toCam.z*forward.z))*HEADLIGHT_BEAM_MAX_ALPHA);
 if(alpha<=0)return {positions:[] as number[],colors:[] as number[]};
 const normal=norm({x:forward.x-up.x*tilt,y:forward.y-up.y*tilt,z:forward.z-up.z*tilt});
 const right=norm(cross(normal,toCam));
 const base={x:point.x-forward.x*.1,y:point.y-forward.y*.1,z:point.z-forward.z*.1};
 const at=(n:number,r:number)=>({x:base.x+normal.x*n+right.x*r,y:base.y+normal.y*n+right.y*r,z:base.z+normal.z*n+right.z*r});
 const posn=[at(0,-.05),at(0,.05),at(HEADLIGHT_BEAM_LENGTH,-.5),at(HEADLIGHT_BEAM_LENGTH,.5),at(.2,0)],alphas=[alpha,alpha,0,0,alpha];
 const indices=[0,1,4,1,3,4,2,3,4,0,2,4],positions:number[]=[],colors:number[]=[];
 for(const i of indices){positions.push(posn[i].x,posn[i].y,posn[i].z);colors.push(255,255,255,alphas[i]);}
 return {positions,colors};
}
export interface BeamCar {
 /** The car's world transform. */
 position:{x:number;y:number;z:number};rotation:{x:number;y:number;z:number;w:number};
 /** The headlights dummy in native car space (x right, y forward, z up), or undefined for none. */
 dummy?:{x:number;y:number;z:number};
 /** Broken front lamps, left and right (CDamageManager light status). */
 broken:readonly [boolean,boolean];
 tilt?:number;
}
export class HeadlightBeams {
 private mesh:NativeImmediateTriangles;
 constructor(scene:THREE.Scene,capacity=64){this.mesh=new NativeImmediateTriangles(scene,capacity*12,'Native headlight beams',6.2,false,true);}
 /** Renderer-space lamp point for one side of a native dummy. */
 static lampPoint(car:BeamCar,side:'left'|'right'){
  const d=car.dummy!,x=side==='right'?Math.abs(d.x):-Math.abs(d.x);
  const local=new THREE.Vector3(x,d.z,-d.y).applyQuaternion(new THREE.Quaternion(car.rotation.x,car.rotation.y,car.rotation.z,car.rotation.w));
  return {x:car.position.x+local.x,y:car.position.y+local.y,z:car.position.z+local.z};
 }
 frame(cars:readonly BeamCar[],camera:{x:number;y:number;z:number}){
  const positions:number[]=[],colors:number[]=[];
  for(const car of cars){
   if(!car.dummy)continue;
   const q=new THREE.Quaternion(car.rotation.x,car.rotation.y,car.rotation.z,car.rotation.w);
   const forward=new THREE.Vector3(0,0,-1).applyQuaternion(q),up=new THREE.Vector3(0,1,0).applyQuaternion(q);
   for(const side of ['left','right'] as const){
    if(car.broken[side==='left'?0:1])continue;
    const beam=headlightBeam({point:HeadlightBeams.lampPoint(car,side),forward,up,camera,tilt:car.tilt});
    positions.push(...beam.positions);colors.push(...beam.colors);
   }
  }
  this.mesh.frame({positions,colors});
 }
 get drawn(){return this.mesh.drawn;}
 dispose(){this.mesh.dispose();}
}
