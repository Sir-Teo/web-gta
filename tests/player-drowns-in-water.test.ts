import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
beforeAll(async()=>{await RAPIER.init();});

// CPlayerPed::HandlePlayerBreath with bDrownsInWater clear (SET_CHAR_DROWNS_IN_WATER false): the breath does not run
// down, and the drowning damage event it raises instead is dropped by CEventDamage, so the player never drowns.
test('a player who does not drown keeps his breath and his health under water',()=>{
 const sim=new Simulation();
 sim.player.breath=0;sim.player.health=100;
 sim.handlePlayerBreath(1);
 expect(sim.player.health).toBeLessThan(100);
 const hurt=sim.player.health;
 sim.playerDrownsInWater=false;sim.player.breath=50;
 for(let i=0;i<60;i++)sim.handlePlayerBreath(1/30);
 expect(sim.player.health).toBe(hurt);expect(sim.player.breath).toBe(50);
});
