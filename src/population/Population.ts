import type RAPIER from '@dimforge/rapier3d-compat';
import type {Vec3} from '../core/math';
import type {Vehicle} from '../simulation/Simulation';
export type PedestrianState = 'walk' | 'idle' | 'yield' | 'flee';
export interface Pedestrian {
  id: string; body: RAPIER.RigidBody; collider: RAPIER.Collider; controller: RAPIER.KinematicCharacterController;
  position: Vec3; previous: Vec3; heading: number; previousHeading: number; speed: number; phase: number; grounded: boolean;
  state: PedestrianState; direction: number; cruise: number; decisionIn: number; idleIn: number; stateTime: number;
  verticalSpeed: number; motorSpeed: number; desired: { x: number; z: number }; stalled: number; random: () => number;
  appearance: { shirt: number; pants: number; skin: number; width: number; height: number };
}
export interface Population {
 pedestrians:Pedestrian[];
 step(dt:number,vehicles:readonly Vehicle[],player:Vec3):void;
 afterPhysics(dt:number):void;
 reset(exclusions:readonly Vec3[]):void;
}
export function emptyPopulation():Population {return {pedestrians:[],step(){},afterPhysics(){},reset(){}};}
