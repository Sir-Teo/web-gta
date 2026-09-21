import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';

let sim:Simulation;
beforeAll(async()=>RAPIER.init());
afterEach(()=>sim?.dispose());

test('a player made safe takes nothing from anything, and takes damage again once it is off',()=>{
 sim=new Simulation();sim.respawn={x:0,y:.03,z:0};sim.resetPlayer();
 sim.player.health=100;sim.player.armour=0;
 sim.damagePlayer(30);
 expect(sim.player.health).toBeLessThan(100);
 const hurt=sim.player.health;
 // CPlayerInfo::MakePlayerSafe clears CPlayerData::m_bCanBeDamaged and sets every physicalFlags proof, so
 // nothing reaches the player at all — not even damage that bypasses armour.
 sim.playerCanBeDamaged=false;
 sim.damagePlayer(1000,true);
 expect(sim.player.health).toBe(hurt);
 sim.playerCanBeDamaged=true;
 sim.damagePlayer(10);
 expect(sim.player.health).toBeLessThan(hurt);
});
