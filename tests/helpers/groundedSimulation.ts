import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation as NativeSimulation} from '../../src/simulation/Simulation';
export type {Controls} from '../../src/simulation/Simulation';
export class Simulation extends NativeSimulation {
 constructor(){super();this.world.createCollider(RAPIER.ColliderDesc.heightfield(1,1,new Float32Array(4),{x:1000,y:1,z:1000}));this.world.step();}
}
