import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {PED_SOLVER_GROUPS} from '../src/simulation/solverGroups';

beforeAll(async()=>{await RAPIER.init();});

test('SET_CHAR_COLLISION on the player takes the capsule out of every contact and puts it back, still on foot',()=>{
 const sim=new Simulation();
 sim.setPlayerUsesCollision(false);
 expect(sim.playerCollider.collisionGroups()).toBe(0);expect(sim.playerCollider.solverGroups()).toBe(0);
 // The capsule stays enabled: the game reads an enabled capsule as the player being on foot.
 expect(sim.playerCollider.isEnabled()).toBe(true);
 sim.setPlayerUsesCollision(true);
 expect(sim.playerCollider.collisionGroups()).toBe(0xffffffff);expect(sim.playerCollider.solverGroups()).toBe(PED_SOLVER_GROUPS);
});
