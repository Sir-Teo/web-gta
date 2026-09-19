import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation as NativeSimulation} from '../../src/simulation/Simulation';
export type {Controls} from '../../src/simulation/Simulation';
export class Simulation extends NativeSimulation {
 // A solid floor with its top at y 0, the player placed just above it. A capsule that starts inside the character
 // controller's 0.025 skin is never pushed out and sinks through the floor.
 constructor(){super();this.world.createCollider(RAPIER.ColliderDesc.cuboid(500,.5,500).setTranslation(0,-.5,0));this.respawn={x:0,y:.03,z:0};this.resetPlayer();this.world.step();}
}
