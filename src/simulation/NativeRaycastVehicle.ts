import type RAPIER from '@dimforge/rapier3d-compat';
import type {Vec3} from '../core/math';
import {requireAsset} from '../assets/binary';
import type {prepareHandling} from './nativeHandling';
import {NativeVehicleForces,type NativeVehiclePlayerInput} from './NativeVehicleForces';
import {createNativeWheelRays} from './nativeWheelRays';
import {sampleNativeWheelGeometry} from './nativeWheelContact';
import {sampleNativeChassis} from './nativeChassis';
import {sampleNativeSuspensionWheels} from './nativeSuspensionContacts';
import {sampleNativeWheelFallbacks} from './nativeWheelFallback';
import {NATIVE_CAR_WHEELS,type CarWheel} from './nativeDriveContacts';
import type {NativeSuspensionLine,NativeSuspensionGroundState} from './nativeSuspension';
import type {SuspensionFrameWheel} from './nativeSuspensionFrame';
import type {WheelSurfaceInput} from './nativeWheelParameters';
import type {NativeCollisionSource} from './nativeCollision';
export interface NativeResolvedRoadWheel {
  ground:Omit<NativeSuspensionGroundState,'timeStep'|'forwardSpeed'|'handlingFlags'>;
  suspension:Pick<SuspensionFrameWheel,'forceLevel'|'bias'|'damping'>;
  surface:WheelSurfaceInput;
  fallback?:{normal:Vec3;groundSpeed:Vec3};
}
export interface NativeRaycastPlayerInput extends Omit<NativeVehiclePlayerInput,'suspension'|'tires'|'fallback'> {
  suspension:Omit<NativeVehiclePlayerInput['suspension'],'wheels'|'timeStep'>;
  tires:Omit<NativeVehiclePlayerInput['tires'],'compression'|'timeStep'|'wheelParameters'>&{wheelParameters:Omit<NativeVehiclePlayerInput['tires']['wheelParameters'],'surfaces'>};
  resolveWheel:(wheel:CarWheel,contact:ReturnType<typeof sampleNativeWheelGeometry>)=>NativeResolvedRoadWheel;
}
/** One native vehicle update after broad-phase refresh, before world integration.
 * The world scheduler steps all vehicles and then advances Rapier once. */
export class NativeRaycastVehicle {
  private rays:ReturnType<typeof createNativeWheelRays>;
  private forces:NativeVehicleForces;
  private lines:Record<CarWheel,NativeSuspensionLine>;
  private flags:number;
  private disposed=false;
  constructor(private world:RAPIER.World,private body:RAPIER.RigidBody,handling:ReturnType<typeof prepareHandling>,lines:Record<CarWheel,NativeSuspensionLine>){
    this.lines=structuredClone(lines);this.flags=handling.values.handlingFlags;
    this.forces=new NativeVehicleForces(body,handling);this.rays=createNativeWheelRays(world,body,this.lines);
  }
  snapshot(){return this.forces.snapshot();}
  /** CAutomobile::NitrousControl and the fitting's state. */
  nitrousControl(...args:Parameters<NativeVehicleForces['nitrousControl']>){this.forces.nitrousControl(...args);}
  fitEndlessNitro(){this.forces.fitEndlessNitro();}
  get nitro(){return {installed:this.forces.nitroInstalled,burning:this.forces.nitroBurning,boosts:this.forces.nitroBoosts};}
  /** Moves one suspension line, as HydraulicControl rewrites the col line, m_aSuspensionSpringLength and
   * m_aSuspensionLineLength: the line starts at `startZ` and runs `lineLength` down, the spring `springLength` of it. */
  setSuspensionLine(wheel:CarWheel,startZ:number,springLength:number,lineLength:number){
   const l=this.lines[wheel],f=Math.fround;l.start.z=f(startZ);l.end.z=f(startZ-lineLength);l.springLength=f(springLength);l.lineLength=f(lineLength);
   const c=this.rays.controller,i=this.rays.indices[wheel];
   c.setWheelChassisConnectionPointCs(i,{x:l.start.x,y:l.start.z,z:-l.start.y});c.setWheelSuspensionRestLength(i,l.springLength);c.setWheelMaxSuspensionTravel(i,l.springLength);
  }
  /** Each wheel's collision line in native world space (start at the upper mount, end below the wheel). */
  wheelLinesWorld(){
    const q=this.body.rotation(),t=this.body.translation();
    const toWorld=(v:{x:number;y:number;z:number})=>{const l={x:v.x,y:v.z,z:-v.y};const ix=q.w*l.x+q.y*l.z-q.z*l.y,iy=q.w*l.y+q.z*l.x-q.x*l.z,iz=q.w*l.z+q.x*l.y-q.y*l.x,iw=-q.x*l.x-q.y*l.y-q.z*l.z;
      const r={x:ix*q.w+iw*-q.x+iy*-q.z-iz*-q.y,y:iy*q.w+iw*-q.y+iz*-q.x-ix*-q.z,z:iz*q.w+iw*-q.z+ix*-q.y-iy*-q.x};return {x:r.x+t.x,y:-(r.z+t.z),z:r.y+t.y};};
    const out={} as Record<CarWheel,{start:{x:number;y:number;z:number};end:{x:number;y:number;z:number}}>;
    for(const wheel of NATIVE_CAR_WHEELS)out[wheel]={start:toWorld(this.lines[wheel].start),end:toWorld(this.lines[wheel].end)};
    return out;
  }
  stepPlayer(seconds:number,input:NativeRaycastPlayerInput,alreadySkidding:boolean,options:{sources?:ReadonlyMap<number,NativeCollisionSource>;filter?:(collider:RAPIER.Collider)=>boolean;hover?:(wheel:CarWheel,line:{start:{x:number;y:number;z:number};end:{x:number;y:number;z:number}},groundContactZ:number|undefined)=>{fraction:number;point:{x:number;y:number;z:number};normal:{x:number;y:number;z:number}}|undefined}={}){
    requireAsset(!this.disposed,'Native raycast vehicle is disposed.');
    requireAsset(Number.isFinite(seconds)&&seconds>0&&seconds<=.06&&Math.abs(seconds-this.world.timestep)<1e-8,'Native vehicle timestep must match the world and be within 60 ms.');
    const timeStep=Math.fround(seconds*50),c=this.rays.controller;
    c.updateVehicle(seconds,undefined,undefined,collider=>collider.parent()?.handle!==this.body.handle&&(options.filter?.(collider)??true));
    const chassis=sampleNativeChassis(this.body);
    const ground={} as Record<CarWheel,NativeSuspensionGroundState>,parameters={} as Record<CarWheel,NativeResolvedRoadWheel['suspension']>,surfaces={} as Record<CarWheel,WheelSurfaceInput>;
    const fallbackSurfaces:Partial<Record<CarWheel,NonNullable<NativeResolvedRoadWheel['fallback']>>>={};
    for(const wheel of NATIVE_CAR_WHEELS){
      // An owned copy, so nothing the step keeps aliases the caller's objects: every field is a number, a flag or a
      // name but the fallback's two vectors (copied by hand, as structuredClone took four times a car each step).
      const r=input.resolveWheel(wheel,sampleNativeWheelGeometry(c,this.rays.indices[wheel],options.sources));
      const resolved:NativeResolvedRoadWheel={ground:{...r.ground},suspension:{...r.suspension},surface:{...r.surface},fallback:r.fallback&&{normal:{...r.fallback.normal},groundSpeed:{...r.fallback.groundSpeed}}};
      ground[wheel]={...resolved.ground,timeStep,forwardSpeed:chassis.forwardSpeed,handlingFlags:this.flags};parameters[wheel]=resolved.suspension;surfaces[wheel]=resolved.surface;
      if(resolved.fallback)fallbackSurfaces[wheel]=resolved.fallback;
    }
    let hover:Partial<Record<CarWheel,{fraction:number;point:{x:number;y:number;z:number};normal:{x:number;y:number;z:number}}>>|undefined;
    if(options.hover){
      const lines=this.wheelLinesWorld(),t=this.body.translation();
      for(const wheel of NATIVE_CAR_WHEELS){
        const index=this.rays.indices[wheel],contact=c.wheelIsInContact(index)?c.wheelContactPoint(index):null;
        const water=options.hover(wheel,lines[wheel],contact?contact.y:undefined);
        if(water)(hover??={})[wheel]={fraction:water.fraction,point:{x:water.point.x-t.x,y:water.point.y+t.z,z:water.point.z-t.y},normal:water.normal};
      }
    }
    const sampled=sampleNativeSuspensionWheels(c,this.rays.indices,this.lines,ground,parameters,options.sources,hover);
    const result=this.forces.stepPlayer({...input,suspension:{...input.suspension,timeStep,wheels:sampled.wheels},
      tires:{...input.tires,timeStep,compression:sampled.compression,wheelParameters:{...input.tires.wheelParameters,surfaces}},
      fallback:sampleNativeWheelFallbacks(this.body,this.lines,fallbackSurfaces)},alreadySkidding);
    return {...result,sampled};
  }
  dispose(){if(!this.disposed){this.disposed=true;this.rays.dispose();}}
}
